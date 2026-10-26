import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  CarImageClient,
  buildVehicleAltText,
  seedVehicleImages,
  seedCachedImages,
} from '../src/image-client.js';

describe('CarImageClient and Image Seeder', () => {
  const originalFetch = global.fetch;
  let tempStorageDir: string;

  beforeEach(() => {
    tempStorageDir = path.join(os.tmpdir(), `test_images_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(tempStorageDir, { recursive: true });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (fs.existsSync(tempStorageDir)) {
      fs.rmSync(tempStorageDir, { recursive: true, force: true });
    }
  });

  describe('Configuration and Alt Text', () => {
    it('throws when CAR_IMAGE_API_KEY is missing or empty', () => {
      expect(() => new CarImageClient({ apiKey: '' })).toThrow(/CAR_IMAGE_API_KEY is required/i);
    });

    it('builds descriptive alt text with year, make, model and view angle', () => {
      const alt = buildVehicleAltText({
        make: 'Honda',
        model: 'City',
        year: 2024,
        view: 'front-3-4',
      });
      expect(alt).toBe('2024 Honda City, front three-quarter view');
    });

    it('builds alt text without view angle when not specified', () => {
      const alt = buildVehicleAltText({
        make: 'Tata Motors',
        model: 'Nexon',
        year: 2023,
      });
      expect(alt).toBe('2023 Tata Motors Nexon');
    });
  });

  describe('API Requests and Authentication Security', () => {
    it('sends Bearer token header and avoids passing API key in query params', async () => {
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url.toString();
        capturedHeaders = (init?.headers || {}) as Record<string, string>;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/webp' }),
          arrayBuffer: async () => Buffer.from('fake-webp-binary-data'),
        } as any;
      });

      const client = new CarImageClient({
        apiKey: 'cimg_test_secret_key_12345',
        storageDir: tempStorageDir,
      });

      const result = await client.fetchAndCacheImage({
        make: 'Hyundai',
        model: 'Creta',
        year: 2024,
        view: 'front-3-4',
      });

      expect(capturedUrl).toContain('https://carimage.dev/api/v1/images/car?');
      expect(capturedUrl).toContain('make=Hyundai');
      expect(capturedUrl).toContain('model=Creta');
      expect(capturedUrl).toContain('year=2024');
      expect(capturedUrl).not.toContain('cimg_test_secret_key_12345');
      expect(capturedHeaders['Authorization']).toBe('Bearer cimg_test_secret_key_12345');
      expect(result).not.toBeNull();
      expect(result?.url).toMatch(/^\/images\/vehicles\/.+\.webp$/);
      expect(result?.altText).toBe('2024 Hyundai Creta, front three-quarter view');
    });

    it('returns null on 404 Not Found without throwing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () => 'Vehicle not in catalog',
      });

      const client = new CarImageClient({
        apiKey: 'cimg_test_key',
        storageDir: tempStorageDir,
      });

      const result = await client.fetchAndCacheImage({
        make: 'UnknownMake',
        model: 'RareModel',
        year: 2020,
      });

      expect(result).toBeNull();
    });

    it('throws sanitized error on 401 Unauthorized without exposing key', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        text: async () => 'Invalid token provided',
      });

      const client = new CarImageClient({
        apiKey: 'cimg_super_sensitive_secret_9999',
        storageDir: tempStorageDir,
      });

      await expect(
        client.fetchAndCacheImage({ make: 'Honda', model: 'Amaze', year: 2024 })
      ).rejects.toThrow(/Unauthorized: Invalid or expired CAR_IMAGE_API_KEY/i);
    });

    it('throws sanitized error on 402 Payment Required for depleted credits', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        statusText: 'Payment Required',
        headers: new Headers(),
        text: async () => 'Account credits exhausted',
      });

      const client = new CarImageClient({
        apiKey: 'cimg_test_key',
        storageDir: tempStorageDir,
      });

      await expect(
        client.fetchAndCacheImage({ make: 'Honda', model: 'Amaze', year: 2024 })
      ).rejects.toThrow(/Credits exhausted/i);
    });

    it('falls back to catalog resolve when direct lookup returns 404 and fetches using vehicle id', async () => {
      const calls: string[] = [];
      // Create valid WebP header: 'RIFF....WEBP'
      const validWebP = Buffer.alloc(32);
      validWebP.write('RIFF', 0);
      validWebP.writeUInt32LE(24, 4);
      validWebP.write('WEBP', 8);

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const u = url.toString();
        calls.push(u);
        if (u.includes('/images/car?') && u.includes('make=Maruti+Suzuki')) {
          return { ok: false, status: 404, statusText: 'Not Found', headers: new Headers() } as any;
        }
        if (u.includes('/images/resolve')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                params: { vehicle_id: 'veh_test_swift123', make: 'suzuki', model: 'swift', year: 2024 },
                confidence: 'high',
              },
            }),
          } as any;
        }
        if (u.includes('/images/car?') && u.includes('vehicle=veh_test_swift123')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'image/webp' }),
            arrayBuffer: async () => validWebP,
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const client = new CarImageClient({
        apiKey: 'cimg_test_key',
        storageDir: tempStorageDir,
      });

      const res = await client.fetchAndCacheImage({
        make: 'Maruti Suzuki',
        model: 'Swift',
        year: 2024,
      });

      expect(res).not.toBeNull();
      expect(calls.some((c) => c.includes('/images/resolve'))).toBe(true);
      expect(calls.some((c) => c.includes('vehicle=veh_test_swift123'))).toBe(true);
      expect(res?.url).toBe('/images/vehicles/maruti_suzuki_swift_2024.webp');

      // Verify manifest exists and does not contain API key
      const manifestPath = path.join(tempStorageDir, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.images['maruti_suzuki_swift_2024.webp']).toBeDefined();
      expect(manifest.images['maruti_suzuki_swift_2024.webp'].resolvedVehicleId).toBe('veh_test_swift123');
      expect(JSON.stringify(manifest)).not.toContain('cimg_test_key');
    });

    it('rejects corrupt non-image payloads such as HTML or JSON error bodies', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () => Buffer.from('<!DOCTYPE html><html><body>Error</body></html>'),
      });

      const client = new CarImageClient({
        apiKey: 'cimg_test_key',
        storageDir: tempStorageDir,
      });

      await expect(
        client.fetchAndCacheImage({ make: 'Honda', model: 'City', year: 2024 })
      ).rejects.toThrow(/Invalid image binary signature/i);
    });
  });

  describe('Local Caching', () => {
    it('returns cached local image on subsequent calls without dispatching HTTP fetch', async () => {
      let fetchCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        fetchCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/webp' }),
          arrayBuffer: async () => Buffer.from('mock-image-bytes'),
        } as any;
      });

      const client = new CarImageClient({
        apiKey: 'cimg_test_key',
        storageDir: tempStorageDir,
      });

      const first = await client.fetchAndCacheImage({
        make: 'Kia',
        model: 'Seltos',
        year: 2024,
      });
      expect(fetchCount).toBe(1);
      expect(first).not.toBeNull();

      // Second call for the same vehicle
      const second = await client.fetchAndCacheImage({
        make: 'Kia',
        model: 'Seltos',
        year: 2024,
      });
      expect(fetchCount).toBe(1); // Cached! No additional network fetch
      expect(second?.url).toBe(first?.url);
    });
  });

  describe('seedVehicleImages integration with mock pool', () => {
    it('seeds cover images for unseeded vehicles and skips on rerun', async () => {
      const mockVehicles = [
        { id: 'veh-1', make: 'Honda', model: 'City' },
        { id: 'veh-2', make: 'Hyundai', model: 'Creta' },
      ];

      const insertedImages: any[] = [];
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          if (sql.includes('FROM vehicles v')) {
            // Unseeded vehicles query
            const unseeded = mockVehicles.filter(
              (v) => !insertedImages.some((img) => img.vehicleId === v.id)
            );
            return { rows: unseeded };
          }
          if (sql.includes('INSERT INTO vehicle_images')) {
            insertedImages.push({
              vehicleId: params?.[0],
              url: params?.[1],
              altText: params?.[2],
              displayOrder: params?.[3],
            });
            return { rows: [{ id: 'img-uuid' }] };
          }
          return { rows: [] };
        }),
      } as any;

      const mockImageClient = {
        fetchAndCacheImage: vi.fn().mockImplementation(async ({ make, model, year }) => ({
          url: `/images/vehicles/${make}_${model}.webp`,
          altText: `${year} ${make} ${model}, front three-quarter view`,
        })),
      } as any;

      const seedMap = new Map([
        ['Honda:City', 2024],
        ['Hyundai:Creta', 2024],
      ]);

      const result1 = await seedVehicleImages({
        pool: mockPool,
        imageClient: mockImageClient,
        yearMap: seedMap,
        maxImages: 10,
      });

      expect(result1.imagesInserted).toBe(2);
      expect(result1.imagesSkipped).toBe(0);
      expect(insertedImages).toHaveLength(2);
      expect(insertedImages[0].displayOrder).toBe(0);

      // Rerun - all vehicles now have images
      const result2 = await seedVehicleImages({
        pool: mockPool,
        imageClient: mockImageClient,
        yearMap: seedMap,
        maxImages: 10,
      });

      expect(result2.imagesInserted).toBe(0);
      expect(result2.imagesSkipped).toBe(0);
    });

    it('seedCachedImages populates database from pre-cached manifest without external API calls', async () => {
      const mockManifest = {
        version: 1,
        updatedAt: '2026-10-26T00:00:00Z',
        images: {
          'honda_city_2024.webp': {
            url: '/images/vehicles/honda_city_2024.webp',
            make: 'Honda',
            model: 'City',
            year: 2024,
            view: 'front-3-4',
            format: 'webp',
          },
          'hyundai_creta_2024.webp': {
            url: '/images/vehicles/hyundai_creta_2024.webp',
            make: 'Hyundai',
            model: 'Creta',
            year: 2024,
            view: 'front-3-4',
            format: 'webp',
          },
        },
      };

      const manifestPath = path.join(tempStorageDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(mockManifest, null, 2), 'utf8');

      const mockVehicles = [
        { id: 'v-honda-city', make: 'Honda', model: 'City' },
        { id: 'v-hyundai-creta', make: 'Hyundai', model: 'Creta' },
      ];

      const insertedRecords: any[] = [];
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          if (sql.includes('SELECT id FROM vehicles')) {
            const make = params?.[0];
            const model = params?.[1];
            const found = mockVehicles.find(
              (v) => v.make.toLowerCase() === String(make).toLowerCase() && v.model.toLowerCase() === String(model).toLowerCase()
            );
            return { rows: found ? [{ id: found.id }] : [] };
          }
          if (sql.includes('INSERT INTO vehicle_images')) {
            insertedRecords.push({
              vehicleId: params?.[0],
              url: params?.[1],
              altText: params?.[2],
              displayOrder: params?.[3],
            });
            return { rowCount: 1 };
          }
          return { rows: [] };
        }),
      } as any;

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const result = await seedCachedImages({
        pool: mockPool,
        manifestPath,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.imagesInserted).toBe(2);
      expect(result.imagesSkipped).toBe(0);
      expect(insertedRecords).toHaveLength(2);
      expect(insertedRecords[0].vehicleId).toBe('v-honda-city');
      expect(insertedRecords[0].url).toBe('/images/vehicles/honda_city_2024.webp');
      expect(insertedRecords[0].altText).toBe('2024 Honda City, front three-quarter view');
    });
  });
});

