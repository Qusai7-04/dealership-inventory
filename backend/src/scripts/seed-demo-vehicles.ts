import path from 'node:path';
import { seedVehicles } from '../seeder.js';
import { closePool } from '../db.js';

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

async function main() {
  try {
    const demoPath = path.resolve(__dirname, '../../data/fictional-demo-vehicles.seed.json');
    console.log(`Seeding deterministic fictional demo catalogue from ${demoPath}...`);
    const result = await seedVehicles(undefined, demoPath);
    console.log(
      `Fictional demo catalogue seeding complete: ${result.vehiclesInserted} inserted, ${result.vehiclesSkipped} skipped, ${result.receiptsCreated} opening receipts created.`
    );
  } catch (err: any) {
    console.error('Fictional demo catalogue seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('seed-demo-vehicles.ts') || process.argv[1].endsWith('seed-demo-vehicles.js'))
) {
  main();
}
