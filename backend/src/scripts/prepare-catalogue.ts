import fs from 'node:fs';
import path from 'node:path';
import { parseCsv, cleanAndDeduplicate, curateCatalogue } from '../dataset-cleaner.js';

export function runPrepareCatalogue(csvPath?: string) {
  const defaultPath = path.resolve(process.cwd(), 'reference-docs/Car Data India.csv');
  const alternatePath = path.resolve(process.cwd(), '../reference-docs/Car Data India.csv');
  const sourcePath = csvPath || (fs.existsSync(defaultPath) ? defaultPath : alternatePath);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Car Data India.csv not found at ${sourcePath}`);
  }

  const csvContent = fs.readFileSync(sourcePath, 'utf8');
  const rawRows = parseCsv(csvContent);
  const { cleaned, skipped } = cleanAndDeduplicate(rawRows);
  const curated = curateCatalogue(cleaned, 35);

  const outDir = path.resolve(process.cwd(), 'data');
  const backendOutDir = path.resolve(process.cwd(), 'backend/data');
  const targetDir = fs.existsSync(backendOutDir) ? backendOutDir : (fs.existsSync(outDir) ? outDir : path.resolve(process.cwd(), 'data'));

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetFile = path.join(targetDir, 'vehicles.seed.json');
  fs.writeFileSync(targetFile, JSON.stringify(curated, null, 2), 'utf8');

  // Also ensure backend/data has it if run from root
  const secondaryDir = path.resolve(process.cwd(), 'backend/data');
  if (fs.existsSync(path.resolve(process.cwd(), 'backend')) && !fs.existsSync(secondaryDir)) {
    fs.mkdirSync(secondaryDir, { recursive: true });
  }
  if (fs.existsSync(secondaryDir)) {
    fs.writeFileSync(path.join(secondaryDir, 'vehicles.seed.json'), JSON.stringify(curated, null, 2), 'utf8');
  }

  const report = {
    totalRawRows: rawRows.length,
    skippedRowsCount: skipped.length,
    distinctMakeModelPairs: cleaned.length,
    curatedSampleCount: curated.length,
    categoriesFound: Array.from(new Set(curated.map((c) => c.category))),
    makesIncluded: Array.from(new Set(curated.map((c) => c.make))),
    priceRange: [
      Math.min(...curated.map((c) => c.price)),
      Math.max(...curated.map((c) => c.price)),
    ],
    inStockCount: curated.filter((c) => c.opening_quantity > 0).length,
    outOfStockCount: curated.filter((c) => c.opening_quantity === 0).length,
    outputFile: targetFile,
  };

  return report;
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('prepare-catalogue.ts') || process.argv[1].endsWith('prepare-catalogue.js'))
) {
  const report = runPrepareCatalogue();
  console.log('Catalogue Preparation Report:', JSON.stringify(report, null, 2));
}
