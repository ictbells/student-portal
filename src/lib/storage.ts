/**
 * Build a URL for a file on the Laravel public disk.
 * Paths are stored as relative keys (e.g. applications/6/….png).
 * Must hit the API host — not the student app base (/student/).
 */
export function storageUrl(path?: string | null) {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;

  const clean = path.replace(/^\//, '');
  const storagePath = clean.startsWith('storage/') ? clean : `storage/${clean}`;

  const configured = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  // In Vite dev, API is usually on :8000; empty VITE_API_URL must not resolve under /student/
  const apiBase = configured || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

  if (apiBase) {
    return `${apiBase}/${storagePath}`;
  }

  // Production same-origin: root-absolute so Vite/Apache base `/student/` is not prefixed
  return `/${storagePath}`;
}
