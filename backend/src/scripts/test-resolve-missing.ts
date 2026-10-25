import path from 'node:path';
import { getPool, closePool } from '../db.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    const repositoryRoot = path.basename(process.cwd()) === 'backend'
      ? path.resolve(process.cwd(), '..')
      : process.cwd();
    process.loadEnvFile(path.join(repositoryRoot, '.env'));
  } catch {
    // Ignore when .env does not exist
  }
}

async function resolveQuery(apiKey: string, query: string): Promise<{ vehicleId: string; make: string; model: string; year: number } | null> {
  try {
    const res = await fetch('https://carimage.dev/api/v1/images/resolve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const p = json?.data?.params;
    if (p?.vehicle_id) {
      return { vehicleId: p.vehicle_id, make: p.make, model: p.model, year: p.year ?? 2024 };
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveCar(apiKey: string, make: string, model: string) {
  const candidateQueries = [
    `${make} ${model}`,
    `${make.replace(/Maruti Suzuki/i, 'Suzuki')} ${model}`,
    `${make.replace(/Maruti Suzuki/i, 'Maruti')} ${model}`,
    `${make.replace(/Tata Motors/i, 'Tata')} ${model}`,
  ];

  for (const q of candidateQueries) {
    const match = await resolveQuery(apiKey, q);
    if (match) {
      return { ...match, matchedQuery: q };
    }
  }
  return null;
}

async function main() {
  const apiKey = process.env.CAR_IMAGE_API_KEY;
  if (!apiKey) {
    console.error('No CAR_IMAGE_API_KEY');
    process.exit(1);
  }

  const pool = getPool();
  try {
    const unseeded = await pool.query<{ id: string; make: string; model: string }>(
      `SELECT v.id, v.make, v.model
       FROM vehicles v
       LEFT JOIN vehicle_images img ON img.vehicle_id = v.id AND img.display_order = 0
       WHERE v.deleted_at IS NULL AND img.id IS NULL
       ORDER BY v.make ASC, v.model ASC`
    );

    console.log(`Checking resolution for all ${unseeded.rows.length} unseeded vehicles...`);
    let resolvedCount = 0;
    let failedCount = 0;

    for (const v of unseeded.rows) {
      const match = await resolveCar(apiKey, v.make, v.model);
      if (match) {
        resolvedCount++;
        console.log(`  [RESOLVED] ${v.make} ${v.model} -> vehicle_id: ${match.vehicleId} via "${match.matchedQuery}"`);
      } else {
        failedCount++;
        console.log(`  [UNRESOLVED] ${v.make} ${v.model} -> Not found in carimage.dev`);
      }
    }

    console.log(`\nResults: ${resolvedCount} resolved, ${failedCount} unresolved.`);
  } finally {
    await closePool();
  }
}

main();
