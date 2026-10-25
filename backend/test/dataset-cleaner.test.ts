import { describe, expect, it } from 'vitest';
import {
  parseCsv,
  cleanAndDeduplicate,
  curateCatalogue,
  type RawVehicleRecord,
} from '../src/dataset-cleaner.js';

describe('Dataset cleaner and catalogue curation', () => {
  const sampleCsv = `Car_ID,Brand,Model,Year,Fuel_Type,Transmission,Price,Mileage,Engine_CC,Seating_Capacity,Service_Cost,Color,Owner_Type,State,Insurance_Status,Manufacturing_Plant,Number_of_Repairs,Previous_Accidents,Body_Type
1,Toyota,Innova,2024,CNG,Manual,2020000,27.3,800,4,24100,Green,Second,Tamil Nadu,Insured,Pune,2,4,Sedan
2,Kia,EV6,2023,Diesel,Manual,1770000,16.4,2500,7,18800,Blue,Third,Delhi,Not Insured,Manesar,8,4,Convertible
3,Maruti Suzuki,Dzire,2016,Petrol,Manual,3430000,17.6,2000,6,24700,Grey,First,Tamil Nadu,Insured,Surat,2,1,Sedan
4,Toyota,Innova,2020,Diesel,Manual,1800000,15.0,2400,7,20000,White,First,Delhi,Insured,Pune,1,0,MUV
5,,Carnival,2022,Diesel,Automatic,3500000,14.0,2200,7,25000,Black,First,Goa,Insured,Pune,0,0,MUV
6,Honda,,2021,Petrol,Manual,1200000,18.0,1500,5,15000,Red,First,Delhi,Insured,Sanand,0,0,Sedan
7,Honda,City,2018,Petrol,Manual,-5000,18.0,1500,5,15000,Red,First,Delhi,Insured,Sanand,0,0,Sedan
8,honda,city,2024,Petrol,Manual,1450000,18.5,1500,5,12000,White,First,Delhi,Insured,Sanand,0,0,Sedan
9,BMW,X5,2023,Petrol,Automatic,9500000,12.0,3000,5,40000,Blue,First,Mumbai,Insured,Chennai,0,0,SUV
10,Tata Motors,Nexon,2022,Electric,Automatic,1500000,20.0,0,5,8000,Teal,First,Delhi,Insured,Pune,0,0,UnknownType
`;

  it('parses valid CSV rows and trims whitespace', () => {
    const rows = parseCsv(sampleCsv);
    expect(rows.length).toBe(10);
    expect(rows[0].Brand).toBe('Toyota');
    expect(rows[0].Model).toBe('Innova');
    expect(rows[0].Body_Type).toBe('Sedan');
    expect(rows[0].Year).toBe('2024');
    expect(rows[0].Price).toBe('2020000');
  });

  it('deduplicates case-insensitively, picks newest year, maps categories, and reports skipped records', () => {
    const rows = parseCsv(sampleCsv);
    const result = cleanAndDeduplicate(rows);

    expect(result.skipped.length).toBe(3); // missing brand (row 5), missing model (row 6), negative price (row 7)
    expect(result.skipped.map((s) => s.reason)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Missing required fields'),
        expect.stringContaining('Invalid or non-positive price'),
      ])
    );

    // Innova appeared twice (2024 Sedan and 2020 MUV). The 2024 row must be chosen.
    const innova = result.cleaned.find(
      (c) => c.make.toLowerCase() === 'toyota' && c.model.toLowerCase() === 'innova'
    );
    expect(innova).toBeDefined();
    expect(innova?.year).toBe(2024);
    expect(innova?.category).toBe('Sedan');
    expect(innova?.price).toBe(2020000);

    // Honda City appeared with casing 'honda city' 2024. Brand/model casing should be preserved cleanly.
    const city = result.cleaned.find(
      (c) => c.make.toLowerCase() === 'honda' && c.model.toLowerCase() === 'city'
    );
    expect(city).toBeDefined();
    expect(city?.make).toBe('Honda');
    expect(city?.model).toBe('City');
    expect(city?.year).toBe(2024);

    // BMW acronym casing preserved
    const bmw = result.cleaned.find((c) => c.make === 'BMW');
    expect(bmw).toBeDefined();

    // Unknown category mapped to Other
    const nexon = result.cleaned.find((c) => c.model === 'Nexon');
    expect(nexon?.category).toBe('Other');
  });

  it('curates a deterministic sample with balanced categories and deterministic opening stock', () => {
    const rows: RawVehicleRecord[] = [
      { Car_ID: '1', Brand: 'Honda', Model: 'City', Year: '2024', Price: '1200000', Body_Type: 'Sedan' },
      { Car_ID: '2', Brand: 'Honda', Model: 'Amaze', Year: '2023', Price: '800000', Body_Type: 'Sedan' },
      { Car_ID: '3', Brand: 'Hyundai', Model: 'Creta', Year: '2024', Price: '1500000', Body_Type: 'SUV' },
      { Car_ID: '4', Brand: 'Hyundai', Model: 'Venue', Year: '2023', Price: '1000000', Body_Type: 'SUV' },
      { Car_ID: '5', Brand: 'Maruti Suzuki', Model: 'Swift', Year: '2024', Price: '700000', Body_Type: 'Hatchback' },
      { Car_ID: '6', Brand: 'Maruti Suzuki', Model: 'Baleno', Year: '2023', Price: '750000', Body_Type: 'Hatchback' },
      { Car_ID: '7', Brand: 'Kia', Model: 'EV6', Year: '2024', Price: '6000000', Body_Type: 'Coupe' },
      { Car_ID: '8', Brand: 'Toyota', Model: 'Innova', Year: '2024', Price: '2500000', Body_Type: 'MUV' },
    ];

    const { cleaned } = cleanAndDeduplicate(rows);
    const curated = curateCatalogue(cleaned, 6);

    expect(curated.length).toBe(6);
    // Every curated item has an explicit openingQuantity (number >= 0)
    for (const item of curated) {
      expect(typeof item.opening_quantity).toBe('number');
      expect(item.opening_quantity).toBeGreaterThanOrEqual(0);
      expect(item.year).toBeGreaterThanOrEqual(2000);
      expect(item.price).toBeGreaterThan(0);
      expect(item.category).toBeTruthy();
    }

    // Contains both in-stock and zero-stock records for demonstration
    const hasZeroStock = curated.some((c) => c.opening_quantity === 0);
    const hasPositiveStock = curated.some((c) => c.opening_quantity > 0);
    expect(hasZeroStock).toBe(true);
    expect(hasPositiveStock).toBe(true);
  });
});
