export function storageUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  return `${base}/storage/${path.replace(/^\//, '')}`;
}
