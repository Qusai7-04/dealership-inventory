import path from 'node:path';
import { seedVehicleImages } from '../image-client.js';
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
  if (!process.env.CAR_IMAGE_API_KEY) {
    console.warn(
      'Notice: CAR_IMAGE_API_KEY is not set in environment. Image seeding skipped.'
    );
    return;
  }

  try {
    console.log('Seeding vehicle images from carimage.dev (up to 30 unseeded vehicles)...');
    const result = await seedVehicleImages({ maxImages: 30 });
    console.log(
      `Image seeding complete: ${result.imagesInserted} images inserted, ${result.imagesSkipped} skipped.`
    );
  } catch (err: any) {
    console.error('Image seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('seed-images.ts') || process.argv[1].endsWith('seed-images.js'))
) {
  main();
}
