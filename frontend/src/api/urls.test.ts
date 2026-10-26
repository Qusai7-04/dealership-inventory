import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { assetUrl } from './urls';
import { createApiClient } from './client';

describe('Asset and API URL helpers', () => {
  const originalApiBase = import.meta.env.VITE_API_BASE_URL;

  beforeEach(() => {
    // Simulate production Vercel deployment where VITE_API_BASE_URL points to the backend serverless deployment
    import.meta.env.VITE_API_BASE_URL = 'https://creaseline-backend.vercel.app';
  });

  afterEach(() => {
    if (originalApiBase === undefined) {
      delete import.meta.env.VITE_API_BASE_URL;
    } else {
      import.meta.env.VITE_API_BASE_URL = originalApiBase;
    }
  });

  it('resolves root-relative image paths to the frontend static origin without VITE_API_BASE_URL prefix', () => {
    const url = assetUrl('/images/vehicles/honda_city_2024.webp');
    expect(url).toBe('/images/vehicles/honda_city_2024.webp');
    expect(url).not.toContain('creaseline-backend.vercel.app');
  });

  it('normalizes relative image paths without leading slash to the frontend static origin', () => {
    const url = assetUrl('images/vehicles/hyundai_creta_2024.webp');
    expect(url).toBe('/images/vehicles/hyundai_creta_2024.webp');
    expect(url).not.toContain('creaseline-backend.vercel.app');
  });

  it('preserves absolute HTTP and HTTPS URLs unmodified', () => {
    expect(assetUrl('https://images.unsplash.com/photo-123.jpg')).toBe('https://images.unsplash.com/photo-123.jpg');
    expect(assetUrl('http://cdn.example.com/cars/sedan.webp')).toBe('http://cdn.example.com/cars/sedan.webp');
  });

  it('preserves data URIs unmodified', () => {
    const dataUri = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA';
    expect(assetUrl(dataUri)).toBe(dataUri);
  });

  it('handles empty strings gracefully', () => {
    expect(assetUrl('')).toBe('');
  });

  it('strictly maintains separation between static frontend assets and backend API endpoints', async () => {
    // Static vehicle assets must resolve to frontend origin
    const vehicleAsset = assetUrl('/images/vehicles/tata_motors_nexon_2024.webp');
    expect(vehicleAsset).toBe('/images/vehicles/tata_motors_nexon_2024.webp');

    // API requests must target the configured backend base URL
    const fetchCalls: string[] = [];
    const mockFetcher = (async (input: RequestInfo | URL) => {
      fetchCalls.push(String(input));
      return new Response(JSON.stringify({ vehicles: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const apiClient = createApiClient({
      baseUrl: import.meta.env.VITE_API_BASE_URL,
      fetcher: mockFetcher,
    });

    await apiClient.get('/api/vehicles');

    // Verify separation: API call uses backend origin, image URL uses frontend origin
    expect(fetchCalls[0]).toBe('https://creaseline-backend.vercel.app/api/vehicles');
    expect(vehicleAsset).not.toContain('creaseline-backend.vercel.app');
  });
});
