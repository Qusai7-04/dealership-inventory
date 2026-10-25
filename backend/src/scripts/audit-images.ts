import fs from 'node:fs';
import path from 'node:path';
import { getPool, closePool } from '../db.js';

import { resolvePublicImagesPath } from '../app.js';

async function main() {
  const pool = getPool();
  try {
    const vRes = await pool.query('SELECT count(*) FROM vehicles WHERE deleted_at IS NULL');
    const imgRes = await pool.query('SELECT count(*) FROM vehicle_images');
    const mappedRes = await pool.query(`
      SELECT v.id, v.make, v.model, v.quantity, img.url, img.alt_text
      FROM vehicles v
      LEFT JOIN vehicle_images img ON img.vehicle_id = v.id AND img.display_order = 0
      WHERE v.deleted_at IS NULL
      ORDER BY v.make, v.model
    `);

    console.log(`Active vehicles: ${vRes.rows[0].count}`);
    console.log(`Image records in DB: ${imgRes.rows[0].count}`);

    const storageDir = path.join(resolvePublicImagesPath(), 'vehicles');
    console.log(`Checking physical storage: ${storageDir}`);
    const physicalFiles = fs.existsSync(storageDir) ? fs.readdirSync(storageDir) : [];
    console.log(`Physical files on disk: ${physicalFiles.length}`);

    let missingImages = 0;
    let missingFiles = 0;
    let validImages = 0;

    for (const r of mappedRes.rows) {
      if (!r.url) {
        missingImages++;
        console.log(`  [MISSING_DB_IMAGE] ${r.make} ${r.model} (qty: ${r.quantity})`);
      } else {
        const filename = path.basename(r.url);
        const exists = fs.existsSync(path.join(storageDir, filename));
        if (!exists) {
          missingFiles++;
          console.log(`  [FILE_NOT_FOUND] ${r.make} ${r.model} -> URL: ${r.url} (File: ${filename} missing on disk)`);
        } else {
          validImages++;
          console.log(`  [OK] ${r.make} ${r.model} -> ${r.url}`);
        }
      }
    }

    console.log(`\nSummary:`);
    console.log(`  Valid mapped images with files on disk: ${validImages}`);
    console.log(`  Vehicles with DB URL but file missing: ${missingFiles}`);
    console.log(`  Vehicles with no image in DB: ${missingImages}`);
  } catch (err: any) {
    console.error('Audit failed:', err.message);
  } finally {
    await closePool();
  }
}

main();
