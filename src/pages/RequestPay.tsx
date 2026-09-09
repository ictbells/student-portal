import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { networkErrorMessage } from '../api';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink, authPrimaryClass } from '../layout/AuthLayout';
import { Alert, Button, Input, Label, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';
import { startOnlineCheckout } from '../lib/onlinePayment';

type Offer = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  instructions?: string | null;
  fee?: { name?: string; amount?: number; category?: string } | null;
};

type Meta = {
  enabled?: boolean;
  university?: string;
  offers?: Offer[];
  collect_instructions?: string;
  unavailable_reason?: string | null;
};

type LookupResult = {
  student: { name?: string; matric_number?: string; email?: string };
  offers: Offer[];
};

type PublicRequest = {
  token?: string;
  status?: string;
  purpose?: string | null;
  delivery_mode?: string | null;
  downloadable?: boolean;
  amount?: number | null;
  invoice_number?: string | null;
  invoice_status?: string | null;
  ready_at?: string | null;
  offer?: { id?: number; name?: string; slug?: string; description?: string | null; instructions?: string | null } | null;
};

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

const selectClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500';
const textareaClass = `${selectClass} min-h-[96px]`;

export default function RequestPayPage() {
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const tokenFromUrl = searchParams.get('token') || '';

  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [nin, setNin] = useState('');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [offerId, setOfferId] = useState<number | ''>('');
  const [purpose, setPurpose] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<PublicRequest | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const offers = lookup?.offers?.length ? lookup.offers : (meta?.offers || []);
  const selectedOffer = offers.find((o) => o.id === offerId);

  useEffect(() => {
    api
      .get<Meta>('/api/public-pay/meta')
      .then(({ data }) => setMeta(data))
      .catch(() => setMeta({ enabled: false, unavailable_reason: 'Unable to load request options.' }))
      .finally(() => setMetaLoading(false));
  }, []);

  useEffect(() => {
    if (!tokenFromUrl) return;
    setStatusLoading(true);
    api
      .get<PublicRequest>(`/api/public-pay/${encodeURIComponent(tokenFromUrl)}`)
      .then(({ data }) => setRequest(data))
      .catch((err: any) => toast.error(err.response?.data?.message || 'Request not found.'))
      .finally(() => setStatusLoading(false));
  }, [tokenFromUrl, toast]);

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    setLookingUp(true);
    setLookup(null);
    setOfferId('');
    try {
      const { data } = await api.post<LookupResult>('/api/public-pay/lookup', { nin: nin.trim() });
      setLookup(data);
      setContactEmail(data.student.email || '');
      if (data.offers.length === 1) setOfferId(data.offers[0].id);
      toast.success('Student record matched');
    } catch (err: any) {
      toast.error(err.response?.data?.message || networkErrorMessage(err) || 'Lookup failed');
    } finally {
      setLookingUp(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!offerId) {
      toast.error('Select a service');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/public-pay', {
        nin: nin.trim(),
        offer_id: offerId,
        purpose: purpose.trim() || null,
        contact_email: contactEmail.trim() || null,
      });
      setRequest(data.request);
      const reference = data.payment?.reference;
      if (data.payment?.authorization_url) {
        await startOnlineCheckout(data.payment);
        return;
      }
      if (reference) {
        await api.get(
          `/api/public-pay/${encodeURIComponent(data.request.token)}/verify/${encodeURIComponent(reference)}`,
        );
        const refreshed = await api.get(`/api/public-pay/${encodeURIComponent(data.request.token)}`);
        setRequest(refreshed.data);
        toast.success('Payment confirmed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || networkErrorMessage(err) || 'Could not start payment');
    } finally {
      setSubmitting(false);
    }
  }

  function downloadArtifact() {
    if (!request?.token) return;
    window.location.href = `${apiBase()}/api/public-pay/${encodeURIComponent(request.token)}/download`;
  }

  if (metaLoading) {
    return (
      <AuthLayout title="Request & pay" subtitle="Loading…">
        <div className="flex justify-center py-10 text-slate-500"><Spinner label="Loading…" /></div>
      </AuthLayout>
    );
  }

  if (tokenFromUrl || request) {
    const row = request;
    return (
      <AuthLayout
        title="Request status"
        subtitle={row?.offer?.name || 'Track your request and payment'}
        footer={<AuthLink to="/request-pay">Start another request</AuthLink>}
      >
        {statusLoading || !row ? (
          <div className="flex justify-center py-10 text-slate-500"><Spinner label="Loading…" /></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm space-y-2">
              <p><span className="text-slate-500">Service:</span> <span className="font-medium text-slate-900">{row.offer?.name || '—'}</span></p>
              <p><span className="text-slate-500">Status:</span> <span className="font-medium text-slate-900">{row.status?.replace(/_/g, ' ')}</span></p>
              <p><span className="text-slate-500">Amount:</span> <span className="font-medium text-slate-900">{row.amount != null ? formatNaira(row.amount) : '—'}</span></p>
              {row.invoice_number ? <p><span className="text-slate-500">Invoice:</span> {row.invoice_number}</p> : null}
              {row.purpose ? <p><span className="text-slate-500">Purpose:</span> {row.purpose}</p> : null}
            </div>
            {row.status === 'awaiting_payment' ? (
              <Button
                type="button"
                className={authPrimaryClass}
                onClick={async () => {
                  try {
                    const { data } = await api.post(`/api/public-pay/${encodeURIComponent(row.token!)}/pay`);
                    if (data.payment?.authorization_url) {
                      await startOnlineCheckout(data.payment);
                      return;
                    }
                    const reference = data.payment?.reference;
                    if (reference) {
                      await api.get(
                        `/api/public-pay/${encodeURIComponent(row.token!)}/verify/${encodeURIComponent(reference)}`,
                      );
                      const refreshed = await api.get(`/api/public-pay/${encodeURIComponent(row.token!)}`);
                      setRequest(refreshed.data);
                      toast.success('Payment confirmed');
                    }
                  } catch (err: any) {
                    toast.error(err.response?.data?.message || 'Payment could not be started');
                  }
                }}
              >
                Pay now
              </Button>
            ) : null}
            {row.downloadable ? (
              <Button type="button" className={authPrimaryClass} onClick={downloadArtifact}>
                Download document
              </Button>
            ) : null}
            {row.status === 'ready' && row.delivery_mode === 'collect' && meta?.collect_instructions ? (
              <Alert>{meta.collect_instructions}</Alert>
            ) : null}
            <Link to="/login" className="block text-center text-sm text-sky-700 hover:underline">Back to sign in</Link>
          </div>
        )}
      </AuthLayout>
    );
  }

  if (!meta?.enabled) {
    return (
      <AuthLayout title="Request & pay" subtitle="Services outside portal login" footer={<AuthLink to="/login">Back to sign in</AuthLink>}>
        <Alert>{meta?.unavailable_reason || 'Public request & pay is not available right now.'}</Alert>
        <p className="mt-4 text-sm text-slate-600">
          Looking for an official transcript?{' '}
          <Link to="/transcript-request" className="text-sky-700 hover:underline">Request a transcript</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Request & pay"
      subtitle="Request a service and pay online without signing in"
      footer={<AuthLink to="/login">Back to sign in</AuthLink>}
    >
      <div className="space-y-6">
        {!lookup ? (
          <form onSubmit={onLookup} className="space-y-4">
            <p className="text-sm text-slate-600">
              Enter your NIN to match your student or alumni record, then choose a service and pay.
            </p>
            {offers.length > 0 ? (
              <ul className="space-y-2 text-sm text-slate-700">
                {offers.map((offer) => (
                  <li key={offer.id} className="rounded-lg border border-slate-200 px-3 py-2">
                    <p className="font-medium text-slate-900">{offer.name}</p>
                    {offer.description ? <p className="text-slate-600 mt-0.5">{offer.description}</p> : null}
                    {offer.fee?.amount != null ? (
                      <p className="mt-1 text-sky-800 font-medium">{formatNaira(offer.fee.amount)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <div>
              <Label htmlFor="nin">NIN</Label>
              <Input id="nin" value={nin} onChange={(e) => setNin(e.target.value)} inputMode="numeric" maxLength={11} required placeholder="11-digit NIN" />
            </div>
            <Button type="submit" className={authPrimaryClass} disabled={lookingUp}>
              {lookingUp ? 'Looking up…' : 'Continue'}
            </Button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
              <p className="font-medium text-slate-900">{lookup.student.name}</p>
              <p className="text-slate-600">{lookup.student.matric_number}</p>
              <button type="button" className="mt-2 text-sky-700 hover:underline text-sm" onClick={() => setLookup(null)}>
                Use a different NIN
              </button>
            </div>
            <div>
              <Label htmlFor="offer">Service</Label>
              <select id="offer" className={selectClass} value={offerId} onChange={(e) => setOfferId(e.target.value ? Number(e.target.value) : '')} required>
                <option value="">Select a service…</option>
                {offers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.name}{offer.fee?.amount != null ? ` — ${formatNaira(offer.fee.amount)}` : ''}
                  </option>
                ))}
              </select>
              {selectedOffer?.instructions ? <p className="mt-1 text-xs text-slate-500">{selectedOffer.instructions}</p> : null}
            </div>
            <div>
              <Label htmlFor="email">Contact email</Label>
              <Input id="email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="purpose">Purpose (optional)</Label>
              <textarea id="purpose" className={textareaClass} value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={255} />
            </div>
            <Button type="submit" className={authPrimaryClass} disabled={submitting}>
              {submitting ? 'Starting payment…' : 'Pay online'}
            </Button>
          </form>
        )}
        <p className="text-sm text-slate-600">
          Official transcript?{' '}
          <Link to="/transcript-request" className="text-sky-700 hover:underline">Go to transcript request</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
