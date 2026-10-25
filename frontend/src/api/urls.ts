export function assetUrl(path: string) {
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
