export type PaymentGatewayProvider = 'paystack' | 'wema';

export type PaymentInitializeResponse = {
  reference?: string;
  authorization_url?: string | null;
  demo?: boolean;
  payment_id?: number;
  provider?: PaymentGatewayProvider;
  checkout?: {
    api_key: string;
    business_id: string;
    amount: number;
    currency?: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
    callback_url?: string;
    metadata?: Record<string, string>;
  };
};

const ALATPAY_SCRIPT = 'https://web.alatpay.ng/js/alatpay.js';

let alatpayScriptPromise: Promise<void> | null = null;

function loadAlatpayScript(): Promise<void> {
  if (typeof window !== 'undefined' && (window as Window & { Alatpay?: unknown }).Alatpay) {
    return Promise.resolve();
  }
  if (alatpayScriptPromise) return alatpayScriptPromise;
  alatpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${ALATPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Wema Bank checkout could not be loaded.')));
      return;
    }
    const script = document.createElement('script');
    script.src = ALATPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      alatpayScriptPromise = null;
      reject(new Error('Wema Bank checkout could not be loaded.'));
    };
    document.head.appendChild(script);
  });
  return alatpayScriptPromise;
}

function transactionIdFromResponse(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null;
  const row = response as Record<string, unknown>;
  const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : null;
  const candidates = [row.transactionId, row.id, data?.id, data?.transactionId];
  for (const value of candidates) {
    if (typeof value === 'string' && value !== '') return value;
  }
  return null;
}

function isAlatpaySuccess(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;
  const row = response as Record<string, unknown>;
  if (row.status === true) return true;
  const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : null;
  const status = String(data?.status || row.status || '').toLowerCase();
  return ['completed', 'successful', 'success', 'paid'].includes(status);
}

async function openAlatpayCheckout(data: PaymentInitializeResponse): Promise<void> {
  const checkout = data.checkout;
  if (!checkout || !data.reference) {
    throw new Error('Payment could not be started.');
  }
  await loadAlatpayScript();
  const Alatpay = (window as Window & { Alatpay?: { setup: (opts: Record<string, unknown>) => { show: () => void } } }).Alatpay;
  if (!Alatpay?.setup) {
    throw new Error('Wema Bank checkout could not be started.');
  }

  await new Promise<void>((resolve, reject) => {
    const popup = Alatpay.setup({
      apiKey: checkout.api_key,
      businessId: checkout.business_id,
      email: checkout.email,
      firstName: checkout.first_name,
      lastName: checkout.last_name,
      phone: checkout.phone || undefined,
      amount: checkout.amount,
      currency: checkout.currency || 'NGN',
      metadata: checkout.metadata || { orderId: data.reference as string },
      onTransaction: (response: unknown) => {
        if (!isAlatpaySuccess(response)) {
          reject(new Error('Payment was not completed.'));
          return;
        }
        const callback = checkout.callback_url || `${window.location.origin}/payments/callback`;
        const url = new URL(callback, window.location.origin);
        url.searchParams.set('reference', data.reference as string);
        const txId = transactionIdFromResponse(response);
        if (txId) url.searchParams.set('transactionId', txId);
        window.location.href = url.toString();
        resolve();
      },
      onClose: () => {
        reject(new Error('Payment was cancelled.'));
      },
    });
    popup.show();
  });
}

export async function startOnlineCheckout(
  data: PaymentInitializeResponse | null | undefined,
  options?: { verifyDemo?: (reference: string) => Promise<unknown> },
): Promise<'demo' | 'redirected'> {
  if (!data) {
    throw new Error('Payment could not be started.');
  }
  if (data.demo) {
    if (!data.reference) {
      throw new Error('Payment could not be started.');
    }
    if (options?.verifyDemo) {
      await options.verifyDemo(data.reference);
    }
    return 'demo';
  }
  if (data.authorization_url) {
    window.location.href = data.authorization_url;
    return 'redirected';
  }
  if (data.provider === 'wema' && data.checkout) {
    await openAlatpayCheckout(data);
    return 'redirected';
  }
  throw new Error('Payment could not be started.');
}

export function paymentVerifyPath(reference: string, transactionId?: string | null): string {
  const base = `/api/payments/verify/${encodeURIComponent(reference)}`;
  if (!transactionId) return base;
  return `${base}?transactionId=${encodeURIComponent(transactionId)}`;
}
