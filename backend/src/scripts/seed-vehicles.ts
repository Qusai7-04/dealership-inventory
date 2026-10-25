import { seedVehicles } from '../seeder.js';
import { closePool } from '../db.js';

async function main() {
  try {
    console.log('Seeding vehicles and reconciling opening stock receipts...');
    const result = await seedVehicles();
    console.log(
      `Vehicle seeding completed successfully: ${result.vehiclesInserted} inserted, ${result.vehiclesSkipped} skipped, ${result.receiptsCreated} opening receipts created.`
    );
  } catch (err: any) {
    console.error('Vehicle seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (process.argv[1] && (process.argv[1].endsWith('seed-vehicles.ts') || process.argv[1].endsWith('seed-vehicles.js'))) {
  main();
}
