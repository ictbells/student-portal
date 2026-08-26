import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/toast';
import { Button, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';

export default function TranscriptRequestCallback() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const reference = searchParams.get('reference') || searchParams.get('trxref') || '';
  const toast = useToast();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>(token && reference ? 'verifying' : 'failed');
  const [message, setMessage] = useState(
    token && reference ? 'Confirming your transcript payment…' : 'Missing payment reference or request token.',
  );
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !reference) return;
    let cancelled = false;
    api
      .get(`/api/transcript-requests/${encodeURIComponent(token)}/verify/${encodeURIComponent(reference)}`)
      .then(({ data }) => {
        if (cancelled) return;
        setStatus('success');
        setAmount(data.request?.amount ?? data.payment?.amount ?? null);
        setMessage('Payment confirmed. Registry will email you when your official transcript is ready.');
        toast.success('Transcript payment confirmed');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setStatus('failed');
        setMessage(err.response?.data?.message || 'We could not confirm this payment.');
      });
    return () => { cancelled = true; };
  }, [token, reference, toast]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Bells crest" className="h-10 w-10 rounded-full bg-white ring-1 ring-slate-200" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Student portal</p>
            <p className="text-sm font-semibold text-slate-900 truncate">Official transcript payment</p>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            {status === 'success' ? 'Payment confirmed' : status === 'failed' ? 'Payment not confirmed' : 'Confirming payment'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
          {amount != null && status === 'success' && (
            <p className="mt-3 text-sm font-medium text-slate-800">Amount: {formatNaira(amount)}</p>
          )}
          {status === 'verifying' ? (
            <div className="mt-6 flex justify-center text-slate-500">
              <Spinner label="Confirming…" />
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              <Link
                to={token ? `/transcript-request?token=${encodeURIComponent(token)}` : '/transcript-request'}
                className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
              >
                View request status
              </Link>
              <Button type="button" onClick={() => { window.location.href = `${import.meta.env.BASE_URL}login`.replace('//', '/'); }} className="w-full border border-slate-200 bg-white text-slate-700">
                Go to sign in
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
