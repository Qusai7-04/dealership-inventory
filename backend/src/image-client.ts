import fs from 'node:fs';
import path from 'node:path';
import type pg from 'pg';
import { getPool } from './db.js';

export interface VehicleImageRequest {
  make: string;
  model: string;
  year?: number;
  view?: string;
  color?: string;
  width?: number;
  height?: number;
  format?: string;
}

export interface ImageClientOptions {
  apiKey?: string;
  storageDir?: string;
  baseUrl?: string;
}

export interface SeedVehicleImagesOptions {
  pool?: pg.Pool;
  imageClient?: CarImageClient;
  yearMap?: Map<string, number>;
  maxImages?: number;
}

export interface SeedImagesResult {
  imagesInserted: number;
  imagesSkipped: number;
}

const VIEW_DESCRIPTIONS: Record<string, string> = {
  'front-3-4': 'front three-quarter view',
  'front': 'front view',
  'side': 'side view',
  'rear-3-4': 'rear three-quarter view',
  'rear': 'rear view',
  'front-3-4-right': 'front three-quarter right view',
  'side-right': 'side right view',
  'rear-3-4-right': 'rear three-quarter right view',
};

export function buildVehicleAltText(req: {
  make: string;
  model: string;
  year?: number;
  view?: string;
}): string {
  const parts: string[] = [];
  if (req.year) {
    parts.push(String(req.year));
  }
  parts.push(req.make.trim());
  parts.push(req.model.trim());

  const prefix = parts.join(' ');
  if (req.view && VIEW_DESCRIPTIONS[req.view]) {
    return `${prefix}, ${VIEW_DESCRIPTIONS[req.view]}`;
  }
  return prefix;
}

export function sanitizeImageFilename(make: string, model: string, year?: number, ext = 'webp'): string {
  const clean = `${make}_${model}_${year || 'latest'}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  return `${clean}.${ext}`;
}

export class CarImageClient {
  private readonly apiKey: string;
  private readonly storageDir: string;
  private readonly baseUrl: string;

  constructor(options: ImageClientOptions = {}) {
    const rawKey = options.apiKey ?? process.env.CAR_IMAGE_API_KEY;
    if (!rawKey || rawKey.trim() === '') {
      throw new Error('CAR_IMAGE_API_KEY is required to initialize CarImageClient');
    }
    this.apiKey = rawKey.trim();
    this.baseUrl = options.baseUrl ?? 'https://carimage.dev/api/v1';

    if (options.storageDir) {
      this.storageDir = options.storageDir;
    } else {
      const candidates = [
        path.resolve(process.cwd(), 'backend/public/images/vehicles'),
        path.resolve(process.cwd(), 'public/images/vehicles'),
      ];
      this.storageDir = fs.existsSync(path.resolve(process.cwd(), 'backend'))
        ? candidates[0]
        : candidates[1];
    }

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async resolveCar(make: string, model: string): Promise<{ vehicleId: string; make: string; model: string; year?: number } | null> {
    const candidateQueries = [
      `${make} ${model}`,
      `${make.replace(/Maruti Suzuki/i, 'Suzuki')} ${model}`,
      `${make.replace(/Maruti Suzuki/i, 'Maruti')} ${model}`,
      `${make.replace(/Tata Motors/i, 'Tata')} ${model}`,
    ];

    for (const q of candidateQueries) {
      try {
        const res = await fetch(`${this.baseUrl}/images/resolve`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query: q }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const json: any = await res.json();
          const p = json?.data?.params;
          if (p?.vehicle_id) {
            return {
              vehicleId: p.vehicle_id,
              make: p.make ?? make,
              model: p.model ?? model,
              year: p.year,
            };
          }
        }
      } catch {
        // Proceed to next candidate
      }
    }
    return null;
  }

  private async saveAndValidateImage(
    response: Response,
    localFilePath: string,
    publicUrl: string,
    altText: string,
    meta?: { make: string; model: string; year?: number; view?: string; resolvedVehicleId?: string }
  ): Promise<{ url: string; altText: string }> {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 12) {
      throw new Error('Image response payload too small to be a valid image');
    }

    const preview = buffer.toString('utf8', 0, Math.min(buffer.length, 60)).replace(/\s+/g, ' ');
    const isHtmlOrJson = preview.startsWith('<') || preview.startsWith('{');

    const isWebP = (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
      || buffer.toString('ascii').toLowerCase().includes('webp')
      || buffer.toString('ascii').toLowerCase().includes('image');
    const isPng = (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47)
      || buffer.toString('ascii').toLowerCase().includes('png');
    const isJpeg = (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF);

    if (isHtmlOrJson || (!isWebP && !isPng && !isJpeg)) {
      throw new Error(`Invalid image binary signature received: ${preview}`);
    }

    // Atomic write to avoid partial or corrupted files
    const tempPath = `${localFilePath}.${Date.now()}.${Math.random().toString(36).substring(7)}.tmp`;
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, localFilePath);

    // Update manifest.json with diagnostic metadata (never storing secrets or tokens)
    try {
      const manifestPath = path.join(this.storageDir, 'manifest.json');
      let manifest: { version: number; updatedAt: string; images: Record<string, any> } = {
        version: 1,
        updatedAt: new Date().toISOString(),
        images: {},
      };
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch {
          // ignore corrupted manifest
        }
      }
      const filename = path.basename(localFilePath);
      manifest.updatedAt = new Date().toISOString();
      manifest.images = manifest.images || {};
      manifest.images[filename] = {
        url: publicUrl,
        make: meta?.make,
        model: meta?.model,
        year: meta?.year,
        view: meta?.view ?? 'front-3-4',
        resolvedVehicleId: meta?.resolvedVehicleId,
        source: 'carimage.dev',
        fileSizeBytes: buffer.length,
        format: isWebP ? 'webp' : isPng ? 'png' : 'jpeg',
        createdAt: new Date().toISOString(),
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    } catch {
      // Manifest update should not break image fetch
    }

    return { url: publicUrl, altText };
  }

  async fetchAndCacheImage(
    req: VehicleImageRequest
  ): Promise<{ url: string; altText: string } | null> {
    const format = req.format ?? 'webp';
    const filename = sanitizeImageFilename(req.make, req.model, req.year, format);
    const localFilePath = path.join(this.storageDir, filename);
    const publicUrl = `/images/vehicles/${filename}`;
    const altText = buildVehicleAltText(req);

    // 1. Check local cache first to avoid spending credits
    if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
      return { url: publicUrl, altText };
    }

    // 2. Prepare request URL
    const params = new URLSearchParams({
      make: req.make.trim(),
      model: req.model.trim(),
      view: req.view ?? 'front-3-4',
      format,
      w: String(req.width ?? 800),
      h: String(req.height ?? 600),
      trim: '1',
    });

    if (req.year) {
      params.set('year', String(req.year));
    }
    if (req.color) {
      params.set('color', req.color);
    }

    const targetUrl = `${this.baseUrl}/images/car?${params.toString()}`;

    // 3. Dispatch direct request with Bearer authorization header
    let response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'image/webp, image/png, image/jpeg, */*',
      },
      signal: AbortSignal.timeout(60000),
    });

    let resolvedVehicleId: string | undefined;

    // 4. On 404, fall back to catalog resolve with alias candidates before giving up
    if (response.status === 404) {
      const resolved = await this.resolveCar(req.make, req.model);
      if (resolved?.vehicleId) {
        resolvedVehicleId = resolved.vehicleId;
        const resolvedParams = new URLSearchParams({
          vehicle: resolved.vehicleId,
          view: req.view ?? 'front-3-4',
          format,
          w: String(req.width ?? 800),
          h: String(req.height ?? 600),
          trim: '1',
        });
        if (req.color) resolvedParams.set('color', req.color);

        const retryUrl = `${this.baseUrl}/images/car?${resolvedParams.toString()}`;
        response = await fetch(retryUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'image/webp, image/png, image/jpeg, */*',
          },
          signal: AbortSignal.timeout(60000),
        });
      }
    }

    if (response.status === 404) {
      return null;
    }

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid or expired CAR_IMAGE_API_KEY');
    }

    if (response.status === 402) {
      throw new Error('Payment Required: Credits exhausted on carimage.dev account');
    }

    if (response.status === 429) {
      throw new Error('Too Many Requests: Rate limit exceeded on carimage.dev');
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`carimage.dev request failed with status ${response.status}: ${errText}`);
    }

    // 5. Save and validate image bytes atomically
    return this.saveAndValidateImage(response, localFilePath, publicUrl, altText, {
      make: req.make,
      model: req.model,
      year: req.year,
      view: req.view,
      resolvedVehicleId,
    });
  }
}

export async function seedVehicleImages(
  options: SeedVehicleImagesOptions = {}
): Promise<SeedImagesResult> {
  const pool = options.pool ?? getPool();
  const maxImages = options.maxImages ?? 30;

  let imageClient = options.imageClient;
  if (!imageClient) {
    imageClient = new CarImageClient();
  }

  // Load year map if not passed
  let yearMap = options.yearMap;
  if (!yearMap) {
    yearMap = new Map<string, number>();
    const seedCandidates = [
      path.resolve(process.cwd(), 'data/vehicles.seed.json'),
      path.resolve(process.cwd(), 'backend/data/vehicles.seed.json'),
    ];
    for (const cand of seedCandidates) {
      if (fs.existsSync(cand)) {
        try {
          const items: any[] = JSON.parse(fs.readFileSync(cand, 'utf8'));
          for (const item of items) {
            if (item.make && item.model && item.year) {
              yearMap.set(`${item.make}:${item.model}`.toLowerCase(), Number(item.year));
            }
          }
        } catch {
          // ignore
        }
        break;
      }
    }
  }

  // Fetch vehicles that do not currently have a cover image (display_order = 0)
  const unseeded = await pool.query<{ id: string; make: string; model: string }>(
    `SELECT v.id, v.make, v.model
     FROM vehicles v
     LEFT JOIN vehicle_images img ON img.vehicle_id = v.id AND img.display_order = 0
     WHERE v.deleted_at IS NULL AND img.id IS NULL
     ORDER BY v.make ASC, v.model ASC
     LIMIT $1`,
    [maxImages]
  );

  let imagesInserted = 0;
  let imagesSkipped = 0;

  for (let i = 0; i < unseeded.rows.length; i++) {
    const veh = unseeded.rows[i];
    const key = `${veh.make}:${veh.model}`.toLowerCase();
    const year = yearMap.get(key) ?? 2024;

    console.log(`[${i + 1}/${unseeded.rows.length}] Fetching image for ${veh.make} ${veh.model} (${year})...`);
    if (i > 0) {
      await new Promise((res) => setTimeout(res, 300));
    }

    try {
      const result = await imageClient.fetchAndCacheImage({
        make: veh.make,
        model: veh.model,
        year,
        view: 'front-3-4',
      });

      if (!result) {
        console.log(`  - No image found for ${veh.make} ${veh.model}`);
        imagesSkipped++;
        continue;
      }

      await pool.query(
        `INSERT INTO vehicle_images (vehicle_id, url, alt_text, display_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (vehicle_id, display_order) DO UPDATE
         SET url = EXCLUDED.url, alt_text = EXCLUDED.alt_text`,
        [veh.id, result.url, result.altText, 0]
      );
      console.log(`  ✓ Saved image: ${result.url}`);
      imagesInserted++;
    } catch (err: any) {
      console.warn(`  ! Error fetching image for ${veh.make} ${veh.model}: ${err.message}`);
      imagesSkipped++;
    }
  }

  return { imagesInserted, imagesSkipped };
}

export interface SeedCachedImagesOptions {
  pool?: pg.Pool;
  manifestPath?: string;
}

export async function seedCachedImages(
  options: SeedCachedImagesOptions = {}
): Promise<SeedImagesResult> {
  const pool = options.pool ?? getPool();

  let manifestPath = options.manifestPath;
  if (!manifestPath) {
    const candidates = [
      path.resolve(process.cwd(), 'backend/public/images/vehicles/manifest.json'),
      path.resolve(process.cwd(), 'public/images/vehicles/manifest.json'),
      path.resolve(__dirname, '../public/images/vehicles/manifest.json'),
      path.resolve(__dirname, '../../public/images/vehicles/manifest.json'),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        manifestPath = cand;
        break;
      }
    }
  }

  if (!manifestPath || !fs.existsSync(manifestPath)) {
    throw new Error('Manifest file manifest.json could not be resolved for cached images seeding.');
  }

  const rawManifest = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(rawManifest);
  const images = manifest.images || {};

  let imagesInserted = 0;
  let imagesSkipped = 0;

  for (const [filename, meta] of Object.entries<any>(images)) {
    if (!meta.make || !meta.model) {
      imagesSkipped++;
      continue;
    }

    const vehRes = await pool.query<{ id: string }>(
      `SELECT id FROM vehicles
       WHERE lower(make) = lower($1) AND lower(model) = lower($2) AND deleted_at IS NULL
       LIMIT 1`,
      [meta.make.trim(), meta.model.trim()]
    );

    if (vehRes.rows.length === 0) {
      imagesSkipped++;
      continue;
    }

    const vehicleId = vehRes.rows[0].id;
    const url = meta.url || `/images/vehicles/${filename}`;
    const altText = buildVehicleAltText({
      make: meta.make,
      model: meta.model,
      year: meta.year ? Number(meta.year) : undefined,
      view: meta.view,
    });

    await pool.query(
      `INSERT INTO vehicle_images (vehicle_id, url, alt_text, display_order)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (vehicle_id, display_order) DO UPDATE
       SET url = EXCLUDED.url, alt_text = EXCLUDED.alt_text`,
      [vehicleId, url, altText]
    );

    imagesInserted++;
  }

  return { imagesInserted, imagesSkipped };
}
