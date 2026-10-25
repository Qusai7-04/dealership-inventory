export interface RawVehicleRecord {
  Car_ID?: string;
  Brand?: string;
  Model?: string;
  Year?: string;
  Price?: string;
  Body_Type?: string;
  [key: string]: unknown;
}

export interface CleanedVehicleRecord {
  make: string;
  model: string;
  year: number;
  price: number;
  category: string;
}

export interface SkippedRecordReport {
  row: number | string;
  make?: string;
  model?: string;
  reason: string;
}

export interface SeedVehicleRecord {
  make: string;
  model: string;
  category: string;
  price: number;
  year: number;
  opening_quantity: number;
}

const CATEGORY_MAP: Record<string, string> = {
  suv: 'SUV',
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  coupe: 'Coupe',
  convertible: 'Convertible',
  muv: 'MPV',
  mpv: 'MPV',
  truck: 'Truck',
};

// Known abbreviations or casings
const PRESERVED_TOKENS: Record<string, string> = {
  bmw: 'BMW',
  ev6: 'EV6',
  'wr-v': 'WR-V',
  i10: 'i10',
  i20: 'i20',
  xuv300: 'XUV300',
  xuv700: 'XUV700',
  mg: 'MG',
  cng: 'CNG',
};

export function normalizeName(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const words = trimmed.split(/\s+/);
  const normalizedWords = words.map((word) => {
    const lower = word.toLowerCase();
    if (PRESERVED_TOKENS[lower]) {
      return PRESERVED_TOKENS[lower];
    }
    // Check hyphenated parts like WR-V
    if (word.includes('-')) {
      return word
        .split('-')
        .map((part) => {
          const partLower = part.toLowerCase();
          return PRESERVED_TOKENS[partLower] ?? (part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
        })
        .join('-');
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return normalizedWords.join(' ');
}

export function parseCsv(csvContent: string): RawVehicleRecord[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const records: RawVehicleRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record: RawVehicleRecord = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] !== undefined ? values[j].trim() : '';
    }
    records.push(record);
  }

  return records;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function cleanAndDeduplicate(rows: RawVehicleRecord[]): {
  cleaned: CleanedVehicleRecord[];
  skipped: SkippedRecordReport[];
} {
  const skipped: SkippedRecordReport[] = [];
  // Key: lower(make)||lower(model) -> candidate record
  const map = new Map<string, CleanedVehicleRecord>();

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowId = row.Car_ID || idx + 1;
    const rawBrand = typeof row.Brand === 'string' ? row.Brand.trim() : '';
    const rawModel = typeof row.Model === 'string' ? row.Model.trim() : '';
    const rawBody = typeof row.Body_Type === 'string' ? row.Body_Type.trim() : '';
    const rawYear = typeof row.Year === 'string' ? row.Year.trim() : String(row.Year || '');
    const rawPrice = typeof row.Price === 'string' ? row.Price.trim() : String(row.Price || '');

    if (!rawBrand || !rawModel || !rawBody) {
      skipped.push({
        row: rowId,
        make: rawBrand,
        model: rawModel,
        reason: 'Missing required fields (Brand, Model, or Body_Type)',
      });
      continue;
    }

    const year = parseInt(rawYear, 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      skipped.push({
        row: rowId,
        make: rawBrand,
        model: rawModel,
        reason: `Invalid Year value: "${rawYear}"`,
      });
      continue;
    }

    const price = parseFloat(rawPrice);
    if (isNaN(price) || price <= 0 || price > 9_999_999_999.99) {
      skipped.push({
        row: rowId,
        make: rawBrand,
        model: rawModel,
        reason: `Invalid or non-positive price: "${rawPrice}"`,
      });
      continue;
    }

    const make = normalizeName(rawBrand);
    const model = normalizeName(rawModel);
    const category = CATEGORY_MAP[rawBody.toLowerCase()] || 'Other';
    const key = `${make.toLowerCase()}||${model.toLowerCase()}`;

    const candidate: CleanedVehicleRecord = {
      make,
      model,
      year,
      price: Math.round(price * 100) / 100,
      category,
    };

    if (!map.has(key)) {
      map.set(key, candidate);
    } else {
      const existing = map.get(key)!;
      // Deterministic rule: prefer the most recent year, then higher price
      if (candidate.year > existing.year || (candidate.year === existing.year && candidate.price > existing.price)) {
        map.set(key, candidate);
      }
    }
  }

  const cleaned = Array.from(map.values()).sort((a, b) => {
    const makeCompare = a.make.localeCompare(b.make);
    return makeCompare !== 0 ? makeCompare : a.model.localeCompare(b.model);
  });

  return { cleaned, skipped };
}

export function curateCatalogue(cleaned: CleanedVehicleRecord[], targetCount = 35): SeedVehicleRecord[] {
  // Sort deterministically
  const sorted = [...cleaned].sort((a, b) => {
    const cmp = a.make.localeCompare(b.make);
    return cmp !== 0 ? cmp : a.model.localeCompare(b.model);
  });

  // Balanced selection across makes and categories
  const byMake = new Map<string, CleanedVehicleRecord[]>();
  for (const car of sorted) {
    if (!byMake.has(car.make)) byMake.set(car.make, []);
    byMake.get(car.make)!.push(car);
  }

  const selected: CleanedVehicleRecord[] = [];
  const makes = Array.from(byMake.keys()).sort();
  let round = 0;

  while (selected.length < targetCount && round < 10) {
    let addedInRound = false;
    for (const make of makes) {
      const cars = byMake.get(make)!;
      if (round < cars.length) {
        selected.push(cars[round]);
        addedInRound = true;
        if (selected.length >= targetCount) break;
      }
    }
    if (!addedInRound) break;
    round++;
  }

  // Deterministic opening stock quantities to provide realistic demo catalog:
  // Mix of zero-stock (unavailable) and positive stock (some low-stock <=3, some normal stock)
  const quantityPattern = [5, 2, 0, 8, 3, 10, 0, 4, 1, 6, 12, 0];

  return selected.map((car, index) => ({
    make: car.make,
    model: car.model,
    category: car.category,
    price: car.price,
    year: car.year,
    opening_quantity: quantityPattern[index % quantityPattern.length],
  }));
}
