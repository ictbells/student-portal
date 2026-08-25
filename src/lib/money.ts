/** Format Naira amounts like ₦26,250 (no trailing decimals). */
export function formatNaira(
  value: number | string | null | undefined,
  fallback = '—',
): string {
  if (value == null || value === '') return fallback;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}
