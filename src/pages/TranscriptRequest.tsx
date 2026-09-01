import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import api, { networkErrorMessage } from '../api';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink, authPrimaryClass } from '../layout/AuthLayout';
import { Alert, Button, Input, Label, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';
import { startOnlineCheckout } from '../lib/onlinePayment';

const CHANNELS = [
  { key: 'undergraduate', label: 'Undergraduate', description: 'Degree programmes (UTME, Direct Entry, Transfer).' },
  { key: 'jupeb', label: 'JUPEB', description: 'JUPEB foundation programmes.' },
  { key: 'postgraduate', label: 'Postgraduate', description: 'Masters, PhD, and other postgraduate programmes.' },
] as const;

type ChannelKey = (typeof CHANNELS)[number]['key'];

type TranscriptTypeOption = {
  value: string;
  label: string;
  description?: string;
};

type Meta = {
  enabled?: boolean;
  university?: string;
  transcript_types?: TranscriptTypeOption[];
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
};

type QuoteResult = {
  fee?: { name?: string; amount?: number };
  transcript_type_label?: string;
};

type PublicRequest = {
  token?: string;
  status?: string;
  copies?: number;
  program?: { id?: number; name?: string; code?: string | null } | null;
  transcript_type?: string | null;
  transcript_type_label?: string | null;
  delivery_email?: string | null;
  delivery_address?: string | null;
  collection_method?: string | null;
  delivery_mode?: string | null;
  downloadable?: boolean;
  amount?: number | null;
  invoice_number?: string | null;
  invoice_status?: string | null;
  ready_at?: string | null;
};

const DEFAULT_TYPES: TranscriptTypeOption[] = [
  { value: 'e_copy', label: 'E-copy', description: 'Signed PDF sent to an email address you provide.' },
  { value: 'within_nigeria', label: 'Within Nigeria', description: 'Hard copy posted to an address in Nigeria.' },
  { value: 'outside_nigeria', label: 'Outside Nigeria', description: 'Hard copy posted to an address outside Nigeria.' },
  { value: 'student_copy', label: 'Student copy', description: 'Collect at the Registry or give a postal address.' },
];

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

function isChannelKey(value: string | undefined): value is ChannelKey {
  return CHANNELS.some((channel) => channel.key === value);
}

const selectClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500';
const textareaClass = `${selectClass} min-h-[96px]`;

export default function TranscriptRequestPage() {
  const { channel } = useParams<{ channel?: string }>();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const tokenFromUrl = searchParams.get('token') || '';
  const channelKey = isChannelKey(channel) ? channel : null;
  const channelMeta = CHANNELS.find((row) => row.key === channelKey) || null;

  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [matric, setMatric] = useState('');
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [programId, setProgramId] = useState<number | ''>('');
  const [transcriptType, setTranscriptType] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [collectionMethod, setCollectionMethod] = useState<'collect' | 'post'>('collect');
  const [copies, setCopies] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<PublicRequest | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const types = meta?.transcript_types?.length ? meta.transcript_types : DEFAULT_TYPES;
  const selectedType = types.find((type) => type.value === transcriptType);

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

  useEffect(() => {
    if (!programId || !transcriptType) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    setQuoteError(null);
    api
      .post<QuoteResult>('/api/transcript-requests/quote', {
        program_id: programId,
        transcript_type: transcriptType,
      })
      .then(({ data }) => {
        if (cancelled) return;
        setQuote(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(networkErrorMessage(err, 'Finance has not set a fee for this programme and transcript type.'));
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => { cancelled = true; };
  }, [programId, transcriptType]);

  const feeLabel = useMemo(() => {
    const fee = quote?.fee;
    if (!fee) return null;
    return `${fee.name || selectedType?.label || 'Official transcript'} — ${formatNaira(fee.amount || 0)}`;
  }, [quote, selectedType]);

  const resetLookupFields = () => {
    setLookup(null);
    setProgramId('');
    setTranscriptType('');
    setDeliveryEmail('');
    setDeliveryAddress('');
    setCollectionMethod('collect');
    setQuote(null);
    setQuoteError(null);
  };

  const verifyIdentity = async (e: FormEvent) => {
    e.preventDefault();
    if (!channelKey) return;
    setLookingUp(true);
    resetLookupFields();
    try {
      const { data } = await api.post<LookupResult>('/api/transcript-requests/lookup', {
        matric_number: matric.trim(),
        email: email.trim(),
        channel: channelKey,
      });
      setLookup(data);
      setDeliveryEmail(email.trim());
      toast.success('Identity verified. Select the programme and transcript type.');
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
    if (!transcriptType) {
      toast.error('Select a transcript type.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/transcript-requests', {
        matric_number: matric.trim(),
        email: email.trim(),
        program_id: programId,
        transcript_type: transcriptType,
        copies,
        purpose: purpose.trim() || undefined,
        delivery_email: transcriptType === 'e_copy' ? deliveryEmail.trim() : undefined,
        delivery_address: transcriptType === 'within_nigeria' || transcriptType === 'outside_nigeria'
          || (transcriptType === 'student_copy' && collectionMethod === 'post')
          ? deliveryAddress.trim()
          : undefined,
        collection_method: transcriptType === 'student_copy' ? collectionMethod : undefined,
        channel: channelKey || undefined,
      });
      setRequest(data.request);
      const payment = data.payment;
      const outcome = await startOnlineCheckout(payment, {
        verifyDemo: (reference) => api.get(
          `/api/transcript-requests/${encodeURIComponent(data.request.token)}/verify/${encodeURIComponent(reference)}`,
        ),
      });
      if (outcome === 'demo') {
        const refreshed = await api.get(`/api/transcript-requests/${encodeURIComponent(data.request.token)}`);
        setRequest(refreshed.data);
        toast.success('Payment recorded (demo). Registry will process your request.');
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

  if (channel && !channelKey) {
    return <Navigate to="/transcript-request" replace />;
  }

  if (metaLoading) {
    return (
      <AuthLayout title="Official transcript" subtitle="Loading…">
        <div className="flex justify-center py-10 text-slate-500">
          <Spinner label="Loading…" />
        </div>
      </AuthLayout>
    );
  }

  if (!channelKey && !tokenFromUrl) {
    return (
      <AuthLayout
        title="Official transcript request"
        subtitle="Choose the programme type. Payment is required before processing."
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
        <div className="space-y-3">
          {CHANNELS.map((row) => (
            <Link
              key={row.key}
              to={`/transcript-request/${row.key}`}
              className="block rounded-xl border border-slate-200 bg-white px-4 py-4 hover:border-sky-300 hover:bg-sky-50/60"
            >
              <p className="font-semibold text-slate-900">{row.label}</p>
              <p className="mt-1 text-sm text-slate-600">{row.description}</p>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/login" className="text-sky-700 hover:underline">Back to sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  const title = channelMeta
    ? `${channelMeta.label} official transcript request`
    : 'Official transcript request';

  return (
    <AuthLayout
      title={title}
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

      {channelKey && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
          <p>Verify your identity, choose the programme, then pay online.</p>
          <p className="mt-1 text-xs text-slate-500">
            Not this programme type?{' '}
            <Link to="/transcript-request" className="text-sky-700 hover:underline">Choose Undergraduate, JUPEB, or Postgraduate</Link>
          </p>
        </div>
      )}

      {feeLabel && meta?.enabled && (
        <div className="mb-5 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
          <p className="font-medium">{feeLabel}</p>
        </div>
      )}
      {quoting && (
        <p className="mb-4 text-sm text-slate-500">Looking up the fee for this programme and type…</p>
      )}
      {quoteError && programId && transcriptType && (
        <div className="mb-5">
          <Alert tone="warning">{quoteError}</Alert>
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
              {request?.transcript_type_label && (
                <p className="mt-1 text-slate-700">Type: {request.transcript_type_label}</p>
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
                      const outcome = await startOnlineCheckout(data.payment, {
                        verifyDemo: (reference) => api.get(
                          `/api/transcript-requests/${encodeURIComponent(request.token!)}/verify/${encodeURIComponent(reference)}`,
                        ),
                      });
                      if (outcome === 'demo') {
                        const refreshed = await api.get(`/api/transcript-requests/${encodeURIComponent(request.token!)}`);
                        setRequest(refreshed.data);
                        toast.success('Payment recorded (demo).');
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

      {meta?.enabled && channelKey && !lookup && (
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
              onClick={() => resetLookupFields()}
            >
              Use a different matric / email
            </button>
          </div>

          <div>
            <Label htmlFor="programme">Programme for this transcript</Label>
            <select
              id="programme"
              className={selectClass}
              value={programId}
              onChange={(e) => setProgramId(e.target.value ? Number(e.target.value) : '')}
              required
            >
              <option value="">Select programme</option>
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
            <Label htmlFor="transcript-type">Transcript type</Label>
            <select
              id="transcript-type"
              className={selectClass}
              value={transcriptType}
              onChange={(e) => setTranscriptType(e.target.value)}
              required
            >
              <option value="">Select type</option>
              {types.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            {selectedType?.description && (
              <p className="mt-1.5 text-xs text-slate-500">{selectedType.description}</p>
            )}
          </div>

          {transcriptType === 'e_copy' && (
            <div>
              <Label htmlFor="delivery-email">Email to send the e-copy to</Label>
              <Input
                id="delivery-email"
                type="email"
                value={deliveryEmail}
                onChange={(e) => setDeliveryEmail(e.target.value)}
                required
                placeholder="recipient@example.com"
              />
            </div>
          )}

          {(transcriptType === 'within_nigeria' || transcriptType === 'outside_nigeria') && (
            <div>
              <Label htmlFor="delivery-address">Postal address</Label>
              <textarea
                id="delivery-address"
                className={textareaClass}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                required
                placeholder={transcriptType === 'outside_nigeria' ? 'Full international address' : 'Address in Nigeria'}
              />
            </div>
          )}

          {transcriptType === 'student_copy' && (
            <>
              <div>
                <Label>How should the student copy be issued?</Label>
                <div className="mt-2 space-y-2 text-sm">
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="collection_method"
                      checked={collectionMethod === 'collect'}
                      onChange={() => setCollectionMethod('collect')}
                    />
                    <span>Physical collection at the Registry</span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="collection_method"
                      checked={collectionMethod === 'post'}
                      onChange={() => setCollectionMethod('post')}
                    />
                    <span>Post to an address</span>
                  </label>
                </div>
              </div>
              {collectionMethod === 'post' && (
                <div>
                  <Label htmlFor="student-copy-address">Postal address</Label>
                  <textarea
                    id="student-copy-address"
                    className={textareaClass}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    required
                    placeholder="Address for the student copy"
                  />
                </div>
              )}
            </>
          )}

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
          <Button
            type="submit"
            disabled={submitting || !programId || !transcriptType || !quote?.fee || quoting}
            className={`${authPrimaryClass} w-full`}
          >
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
