import path from 'node:path';
import { seedCachedImages } from '../image-client.js';
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
    console.log('Associating pre-cached vehicle images from local manifest...');
    const result = await seedCachedImages();
    console.log(
      `Cached image seeding complete: ${result.imagesInserted} images associated, ${result.imagesSkipped} skipped.`
    );
  } catch (err: any) {
    console.error('Cached image seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('seed-cached-images.ts') || process.argv[1].endsWith('seed-cached-images.js'))
) {
  main();
}
