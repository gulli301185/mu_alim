export const API_BASE = import.meta.env.VITE_API_URL ?? '';

/** Resolve image paths from backend `/uploads` or absolute URLs. */
export function assetUrl(path: string | undefined | null, fallback = '') {
  if (!path) return fallback;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  if (path.startsWith('/uploads/')) {
    return `${API_BASE}${path}`;
  }
  return path;
}

/** CSS `url("...")` helper for background images. */
export function assetCssUrl(path: string | undefined | null, fallback = '') {
  const resolved = assetUrl(path, fallback);
  return resolved ? `url("${resolved}")` : 'none';
}
