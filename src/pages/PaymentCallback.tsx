import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/toast';
import { Button, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';
import { paymentVerifyPath } from '../lib/onlinePayment';

type PaymentKind = 'wallet' | 'application_fee' | 'acceptance_fee' | 'invoice';

function kindFromReference(reference: string | null): PaymentKind {
  if (reference?.startsWith('PSK-W-') || reference?.startsWith('WEMA-W-')) return 'wallet';
  return 'invoice';
}

function kindFromPayment(payment: any, fallback: PaymentKind): PaymentKind {
  const category = String(payment?.invoice?.category || payment?.purpose || '');
  if (category === 'wallet_topup') return 'wallet';
  if (category === 'application_fee') return 'application_fee';
  if (category === 'acceptance_fee') return 'acceptance_fee';
  if (category) return 'invoice';
  return fallback;
}

function copyFor(kind: PaymentKind, isStudent?: boolean) {
  switch (kind) {
    case 'wallet':
      return {
        eyebrow: 'Campus wallet',
        verifyingTitle: 'Confirming wallet funding',
        verifying: 'Please wait while we credit your campus wallet.',
        successTitle: 'Wallet funded',
        success: 'The amount has been added to your campus wallet. Open transaction history to view your funding receipt.',
        failedTitle: 'Wallet funding not confirmed',
        failed: 'We could not confirm this top-up. If money left your account, wait a moment and check your wallet, or contact the bursary.',
        cta: 'View transaction history',
        path: '/invoices',
      };
    case 'application_fee':
      return {
        eyebrow: 'Admissions',
        verifyingTitle: 'Confirming application fee',
        verifying: 'Please wait while we confirm your application fee payment.',
        successTitle: 'Application fee paid',
        success: 'You can continue your application form.',
        failedTitle: 'Application fee not confirmed',
        failed: 'We could not confirm this payment. If money left your account, contact admissions.',
        cta: 'Continue application',
        path: '/wizard',
      };
    case 'acceptance_fee':
      return {
        eyebrow: 'Admissions',
        verifyingTitle: 'Confirming acceptance fee',
        verifying: 'Please wait while we confirm your acceptance fee payment.',
        successTitle: 'Acceptance fee paid',
        success: 'Come to campus with your original documents for physical clearance. Your student record opens after staff clear you.',
        failedTitle: 'Acceptance fee not confirmed',
        failed: 'We could not confirm this payment. If money left your account, contact admissions.',
        cta: isStudent ? 'Go to dashboard' : 'View status',
        path: isStudent ? '/' : '/status',
      };
    default:
      return {
        eyebrow: 'Transaction history',
        verifyingTitle: 'Confirming payment',
        verifying: 'Please wait while we confirm this payment.',
        successTitle: 'Payment confirmed',
        success: 'This charge has been recorded. You can view or download the receipt from transaction history.',
        failedTitle: 'Payment not confirmed',
        failed: 'We could not confirm this payment. If money left your account, check transaction history or contact the bursary.',
        cta: 'View transaction history',
        path: '/invoices',
      };
  }
}

function CheckIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
    </svg>
  );
}

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const transactionId = searchParams.get('transactionId') || searchParams.get('transaction_id');
  const guessedKind = kindFromReference(reference);
  const [kind, setKind] = useState<PaymentKind>(guessedKind);
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>(reference ? 'verifying' : 'failed');
  const [payment, setPayment] = useState<any>(null);
  const [error, setError] = useState<string | null>(reference ? null : 'No payment reference was returned.');
  const nav = useNavigate();
  const { auth, refresh } = useAuth();
  const toast = useToast();

  const copy = useMemo(() => copyFor(kind, !!auth?.is_student), [kind, auth?.is_student]);

  useEffect(() => {
    if (!reference) return;

    let cancelled = false;
    api.get(paymentVerifyPath(reference, transactionId))
      .then(async (res) => {
        try {
          await refresh();
        } catch {
          /* still show the receipt */
        }
        if (cancelled) return;
        const me = await api.get('/api/me').then((r) => r.data).catch(() => null);
        const nextKind = kindFromPayment(res.data, guessedKind);
        setKind(nextKind);
        setPayment(res.data);
        setStatus('success');
        toast.success(copyFor(nextKind, !!me?.is_student).successTitle);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err.response?.data?.message || copyFor(guessedKind).failed);
        setStatus('failed');
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per reference
  }, [reference, transactionId]);

  const amount = payment?.amount ?? payment?.invoice?.amount;
  const receipt = payment?.receipt_no;
  const invoiceNo = payment?.invoice?.number;
  const description = payment?.invoice?.category
    ? String(payment.invoice.category).replaceAll('_', ' ')
    : kind === 'wallet'
      ? 'Wallet top-up'
      : 'Payment';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Bells crest" className="h-10 w-10 rounded-full bg-white ring-1 ring-slate-200" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Student portal</p>
            <p className="text-sm font-semibold text-slate-900 truncate">Bells University of Technology</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 mb-2">{copy.eyebrow}</p>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm shadow-slate-200/40">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${
                  status === 'success'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                    : status === 'failed'
                      ? 'bg-red-50 text-red-700 ring-red-100'
                      : 'bg-sky-50 text-sky-700 ring-sky-100'
                }`}
              >
                {status === 'success' ? <CheckIcon /> : status === 'failed' ? <AlertIcon /> : (
                  <span className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                  {status === 'success' ? copy.successTitle : status === 'failed' ? copy.failedTitle : copy.verifyingTitle}
                </h1>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {status === 'success' ? copy.success : status === 'failed' ? (error || copy.failed) : copy.verifying}
                </p>
              </div>
            </div>

            <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/70">
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <dt className="text-slate-500">Type</dt>
                <dd className="font-medium text-slate-900 capitalize">{description}</dd>
              </div>
              {amount != null && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <dt className="text-slate-500">Amount</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{formatNaira(amount)}</dd>
                </div>
              )}
              {reference && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <dt className="text-slate-500">Reference</dt>
                  <dd className="font-mono text-xs sm:text-sm text-slate-800 break-all text-right">{reference}</dd>
                </div>
              )}
              {receipt && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <dt className="text-slate-500">Receipt</dt>
                  <dd className="font-mono text-xs sm:text-sm text-slate-800">{receipt}</dd>
                </div>
              )}
              {invoiceNo && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <dt className="text-slate-500">Invoice</dt>
                  <dd className="font-mono text-xs sm:text-sm text-slate-800">{invoiceNo}</dd>
                </div>
              )}
            </dl>

            <div className="mt-6 space-y-2">
              {status === 'verifying' ? (
                <div className="flex justify-center py-2 text-slate-500">
                  <Spinner label="Confirming…" />
                </div>
              ) : (
                <>
                  <Button onClick={() => nav(copy.path)} className="w-full bg-sky-600 hover:bg-sky-700 text-white shadow-sm">
                    {copy.cta}
                  </Button>
                  {kind !== 'invoice' && (
                    <Button onClick={() => nav('/invoices')} className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
                      View transaction history
                    </Button>
                  )}
                  <Button onClick={() => nav('/')} className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
                    Go to home
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
