export const PHONE_HINT =
  'Nigerian (0803 123 4567) or international (+1 202 555 0100).';

export const PHONE_ERROR =
  'Enter a valid Nigerian or international phone number (e.g. 0803 123 4567 or +1 202 555 0100).';

export function normalizePhone(raw?: string | null): string | null {
  const compact = String(raw || '')
    .trim()
    .replace(/[\s().-]+/g, '')
    .replace(/^00/, '+');
  if (!compact) return null;
  if (/^0\d{10}$/.test(compact)) return `+234${compact.slice(1)}`;
  if (/^2340\d{10}$/.test(compact)) return `+234${compact.slice(4)}`;
  if (/^234\d{10}$/.test(compact)) return `+${compact}`;
  if (/^\+2340\d{10}$/.test(compact)) return `+234${compact.slice(5)}`;
  if (/^\+234\d{10}$/.test(compact)) return compact;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) {
    return compact.startsWith('+234') ? null : compact;
  }
  return null;
}

export function isValidPhone(raw?: string | null): boolean {
  return normalizePhone(raw) !== null;
}
