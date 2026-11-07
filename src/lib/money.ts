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

/** Format an amount in the invoice or wallet currency. Dollars keep cents. */
export function formatMoney(
  value: number | string | null | undefined,
  currency: string | null | undefined = 'NGN',
  fallback = '—',
): string {
  if (String(currency || 'NGN').toUpperCase() === 'USD') {
    if (value == null || value === '') return fallback;
    const amount = Number(value);
    if (!Number.isFinite(amount)) return fallback;
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return formatNaira(value, fallback);
}
