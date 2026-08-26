import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { networkErrorMessage } from '../api';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink, authPrimaryClass } from '../layout/AuthLayout';
import { Alert, Button, Input, Label, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';

type Meta = {
  enabled?: boolean;
  university?: string;
  fee?: { name?: string; amount?: number } | null;
  delivery_modes?: string[];
  collect_instructions?: string;
  unavailable_reason?: string | null;
};

type ProgrammeOption = {
  id: number;
  name: string;
  code?: string | null;
  study_level?: string | null;
  department?: string | null;
  is_current?: boolean;
};

type LookupResult = {
  student: { name?: string; matric_number?: string };
  programmes: ProgrammeOption[];
  fee?: { name?: string; amount?: number };
};

type PublicRequest = {
  token?: string;
  status?: string;
  copies?: number;
  program?: { id?: number; name?: string; code?: string | null } | null;
  delivery_mode?: string | null;
  downloadable?: boolean;
  amount?: number | null;
  invoice_number?: string | null;
  invoice_status?: string | null;
  ready_at?: string | null;
};

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

export default function TranscriptRequestPage() {
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const tokenFromUrl = searchParams.get('token') || '';

  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [matric, setMatric] = useState('');
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [programId, setProgramId] = useState<number | ''>('');
  const [copies, setCopies] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<PublicRequest | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    api
      .get<Meta>('/api/transcript-requests/meta')
      .then(({ data }) => setMeta(data))
      .catch(() => setMeta({ enabled: false, unavailable_reason: 'Unable to load transcript request settings.' }))
      .finally(() => setMetaLoading(false));
  }, []);

  useEffect(() => {
    if (!tokenFromUrl) return;
    setStatusLoading(true);
    api
      .get<PublicRequest>(`/api/transcript-requests/${encodeURIComponent(tokenFromUrl)}`)
      .then(({ data }) => setRequest(data))
      .catch(() => toast.error('Could not load that request reference.'))
      .finally(() => setStatusLoading(false));
  }, [tokenFromUrl, toast]);

  const feeLabel = useMemo(() => {
    const fee = lookup?.fee || meta?.fee;
    if (!fee) return null;
    return `${fee.name || 'Official transcript'} — ${formatNaira(fee.amount || 0)}`;
  }, [lookup, meta]);

  const verifyIdentity = async (e: FormEvent) => {
    e.preventDefault();
    setLookingUp(true);
    setLookup(null);
    setProgramId('');
    try {
      const { data } = await api.post<LookupResult>('/api/transcript-requests/lookup', {
        matric_number: matric.trim(),
        email: email.trim(),
      });
      setLookup(data);
      const current = data.programmes.find((p) => p.is_current) || data.programmes[0];
      if (current) setProgramId(current.id);
      toast.success('Identity verified. Select the programme for this transcript.');
    } catch (err: unknown) {
      toast.error(networkErrorMessage(err, 'Unable to verify matric and email'));
    } finally {
      setLookingUp(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!programId) {
      toast.error('Select a programme.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/transcript-requests', {
        matric_number: matric.trim(),
        email: email.trim(),
        program_id: programId,
        copies,
        purpose: purpose.trim() || undefined,
      });
      setRequest(data.request);
      const payment = data.payment;
      if (payment?.demo && payment?.reference) {
        await api.get(
          `/api/transcript-requests/${encodeURIComponent(data.request.token)}/verify/${encodeURIComponent(payment.reference)}`,
        );
        const refreshed = await api.get(`/api/transcript-requests/${encodeURIComponent(data.request.token)}`);
        setRequest(refreshed.data);
        toast.success('Payment recorded (demo). Registry will process your request.');
      } else if (payment?.authorization_url) {
        window.location.href = payment.authorization_url;
        return;
      } else {
        toast.success('Request created. Complete payment to continue.');
      }
    } catch (err: unknown) {
      toast.error(networkErrorMessage(err, 'Unable to submit transcript request'));
    } finally {
      setSubmitting(false);
    }
  };

  const download = () => {
    if (!request?.token || !request.downloadable) return;
    window.location.href = `${apiBase()}/api/transcript-requests/${encodeURIComponent(request.token)}/download`;
  };

  if (metaLoading) {
    return (
      <AuthLayout title="Official transcript" subtitle="Loading…">
        <div className="flex justify-center py-10 text-slate-500">
          <Spinner label="Loading…" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Official transcript request"
      subtitle="Request a signed copy from Registry. Payment is required before processing."
      footer={(
        <p className="text-slate-500">
          Need your grades online only?{' '}
          <AuthLink to="/login">Sign in</AuthLink>
          {' '}for an unofficial transcript.
        </p>
      )}
    >
      {meta && !meta.enabled && (
        <div className="mb-5">
          <Alert tone="warning">
            {meta.unavailable_reason || 'Official transcript requests are not available right now.'}
          </Alert>
        </div>
      )}

      {feeLabel && meta?.enabled && (
        <div className="mb-5 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
          <p className="font-medium">{feeLabel}</p>
          <p className="mt-1 text-sky-800/80">Verify your identity, choose the programme, then pay online with Paystack.</p>
        </div>
      )}

      {(statusLoading || request) && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm">
          {statusLoading ? (
            <Spinner label="Loading request…" />
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Request status</p>
              <p className="mt-1 font-semibold text-slate-900 capitalize">{(request?.status || '').replaceAll('_', ' ')}</p>
              {request?.program?.name && (
                <p className="mt-1 text-slate-700">Programme: {request.program.name}</p>
              )}
              {request?.token && (
                <p className="mt-1 font-mono text-xs text-slate-600 break-all">Ref: {request.token}</p>
              )}
              {request?.amount != null && (
                <p className="mt-2 text-slate-700">Amount: {formatNaira(request.amount)}</p>
              )}
              {request?.status === 'ready' && request.downloadable && (
                <Button type="button" onClick={download} className={`${authPrimaryClass} mt-4 w-full`}>
                  Download official transcript
                </Button>
              )}
              {request?.status === 'ready' && request.delivery_mode === 'collect' && meta?.collect_instructions && (
                <p className="mt-3 text-slate-600">{meta.collect_instructions}</p>
              )}
              {request?.status === 'awaiting_payment' && request.token && (
                <Button
                  type="button"
                  className={`${authPrimaryClass} mt-4 w-full`}
                  onClick={async () => {
                    try {
                      const { data } = await api.post(`/api/transcript-requests/${encodeURIComponent(request.token!)}/pay`);
                      if (data.payment?.demo && data.payment?.reference) {
                        await api.get(
                          `/api/transcript-requests/${encodeURIComponent(request.token!)}/verify/${encodeURIComponent(data.payment.reference)}`,
                        );
                        const refreshed = await api.get(`/api/transcript-requests/${encodeURIComponent(request.token!)}`);
                        setRequest(refreshed.data);
                        toast.success('Payment recorded (demo).');
                      } else if (data.payment?.authorization_url) {
                        window.location.href = data.payment.authorization_url;
                      }
                    } catch (err: unknown) {
                      toast.error(networkErrorMessage(err, 'Unable to start payment'));
                    }
                  }}
                >
                  Pay now
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {meta?.enabled && !lookup && (
        <form onSubmit={verifyIdentity} className="space-y-5">
          <div>
            <Label htmlFor="matric">Matric number</Label>
            <Input
              id="matric"
              value={matric}
              onChange={(e) => setMatric(e.target.value)}
              required
              placeholder="BUT/2020/0001"
              autoCapitalize="characters"
            />
          </div>
          <div>
            <Label htmlFor="email">Email on your student portal account</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" disabled={lookingUp} className={`${authPrimaryClass} w-full`}>
            {lookingUp ? 'Checking…' : 'Continue — show my programmes'}
          </Button>
        </form>
      )}

      {meta?.enabled && lookup && (
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="font-medium text-slate-900">{lookup.student.name}</p>
            <p className="text-slate-600">{lookup.student.matric_number}</p>
            <button
              type="button"
              className="mt-2 text-xs font-medium text-sky-700 hover:underline"
              onClick={() => { setLookup(null); setProgramId(''); }}
            >
              Use a different matric / email
            </button>
          </div>

          <div>
            <Label htmlFor="programme">Programme for this transcript</Label>
            <select
              id="programme"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              value={programId}
              onChange={(e) => setProgramId(e.target.value ? Number(e.target.value) : '')}
              required
            >
              <option value="" disabled>Select programme</option>
              {lookup.programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.code ? ` (${p.code})` : ''}
                  {p.department ? ` — ${p.department}` : ''}
                  {p.is_current ? ' — current' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Choose the programme this official transcript should cover
              {lookup.programmes.length > 1 ? ` (${lookup.programmes.length} linked to your record)` : ''}.
            </p>
          </div>

          <div>
            <Label htmlFor="copies">Number of copies</Label>
            <Input
              id="copies"
              type="number"
              min={1}
              max={10}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            />
          </div>
          <div>
            <Label htmlFor="purpose">Purpose (optional)</Label>
            <Input
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Job application, further studies"
            />
          </div>
          <Button type="submit" disabled={submitting || !programId} className={`${authPrimaryClass} w-full`}>
            {submitting ? 'Submitting…' : 'Pay and submit request'}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">
        <Link to="/login" className="text-sky-700 hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
