import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { IdentityCard, PageHeader } from '../components/portal';
import { useToast } from '../components/toast';
import { Alert, Button, Card, Input, Label, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';
import { confirmPendingOnlinePayment, startOnlineCheckout } from '../lib/onlinePayment';
import { storageUrl } from '../lib/storage';

const JAMB_ENTRY_MODES = ['utme', 'de'];
const IN_PROGRESS_STAGES = ['started', 'awaiting_application_fee', 'fee_paid', 'form_in_progress'];

function biodataPhotoPath(app: any): string | null {
  const payload = app?.steps?.find((s: any) => s.step_key === 'biodata')?.payload;
  return payload?.photo_path || null;
}

function identityName(identity?: { first_name?: string; middle_name?: string; last_name?: string } | null) {
  if (!identity) return '';
  return [identity.first_name, identity.middle_name, identity.last_name].filter(Boolean).join(' ');
}

const modeLabels: Record<string, { label: string; desc: string }> = {
  utme: { label: 'UTME', desc: 'Unified Tertiary Matriculation Examination' },
  de: { label: 'Direct Entry', desc: 'Diploma or A-Level direct entry' },
  jupeb: { label: 'JUPEB', desc: 'Joint Universities Preliminary Examination Board' },
  transfer: { label: 'Transfer', desc: 'Transfer from another institution' },
  pg: { label: 'Postgraduate', desc: 'Masters and postgraduate programmes' },
};

type OpenIntake = {
  id: number;
  name: string;
  entry_mode: string;
  opens_on?: string;
  application_fee_amount?: number | string;
  term?: { session_label?: string };
};

function ApplyProgress({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1 as const, label: 'Select' },
    { n: 2 as const, label: 'Pay fee' },
    { n: 3 as const, label: 'Form' },
  ];
  return (
    <ol className="grid grid-cols-3 gap-2 text-xs" aria-label="Application progress">
      {steps.map((step) => {
        const active = current === step.n;
        const done = current > step.n;
        return (
          <li
            key={step.n}
            className={`rounded-xl border px-2.5 py-2.5 text-center sm:px-3 ${
              active
                ? 'border-sky-400 bg-sky-50 text-sky-900'
                : done
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-400'
            }`}
          >
            <span className="font-semibold">{step.n}</span>
            <span className="mt-0.5 block truncate">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-slate-900 sm:text-right">{children}</dd>
    </div>
  );
}

export default function Apply() {
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [jambRegistration, setJambRegistration] = useState('');
  const [openIntakes, setOpenIntakes] = useState<OpenIntake[]>([]);
  const [app, setApp] = useState<any>(null);
  const [starting, setStarting] = useState(false);
  const [paying, setPaying] = useState(false);
  const nav = useNavigate();
  const { auth, refresh } = useAuth();
  const toast = useToast();

  const loadOpenIntakes = () => {
    api.get('/api/intakes')
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
        setOpenIntakes(list);
      })
      .catch(() => setOpenIntakes([]));
  };

  useEffect(() => {
    refresh();
    loadOpenIntakes();
    api.get('/api/applications').then((r) => {
      const rows = Array.isArray(r.data?.data) ? r.data.data : (Array.isArray(r.data) ? r.data : []);
      const inProgress = rows.find((row: { stage?: string }) => IN_PROGRESS_STAGES.includes(row.stage || ''));
      if (!inProgress?.id) return;
      api.get(`/api/applications/${inProgress.id}`)
        .then((detail) => setApp(detail.data))
        .catch(() => setApp(inProgress));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!app?.id) return;
    api.get(`/api/applications/${app.id}`).then((r) => setApp(r.data)).catch(() => {});
  }, [app?.id]);

  useEffect(() => {
    if (!openIntakes.length) {
      setSelectedIntakeId(null);
      return;
    }
    if (!selectedIntakeId || !openIntakes.some((intake) => intake.id === selectedIntakeId)) {
      setSelectedIntakeId(openIntakes[0].id);
    }
  }, [openIntakes, selectedIntakeId]);

  const selectedIntake = useMemo(
    () => openIntakes.find((intake) => intake.id === selectedIntakeId) ?? null,
    [openIntakes, selectedIntakeId],
  );

  const requiresJamb = selectedIntake
    ? JAMB_ENTRY_MODES.includes(selectedIntake.entry_mode)
    : false;

  useEffect(() => {
    if (!requiresJamb) {
      setJambRegistration('');
      return;
    }
    if (auth?.user?.jamb_registration) {
      setJambRegistration(auth.user.jamb_registration);
    }
  }, [requiresJamb, auth?.user?.jamb_registration]);

  const start = async () => {
    if (!selectedIntake) return;
    if (requiresJamb && !jambRegistration.trim()) {
      toast.error(selectedIntake.entry_mode === 'de'
        ? 'JAMB Direct Entry number is required for Direct Entry applications.'
        : 'JAMB registration number is required for UTME applications.');
      return;
    }
    setStarting(true);
    try {
      const payload: Record<string, unknown> = {
        entry_mode: selectedIntake.entry_mode,
        intake_id: selectedIntake.id,
      };
      if (requiresJamb) {
        payload.jamb_registration = jambRegistration.trim();
      }
      const { data } = await api.post('/api/applications', payload);
      setApp(data);
      await refresh();
      toast.success(data.credentials_emailed
        ? 'Application started. Check your email for your matric or application number and a new password.'
        : 'Application started');
    } catch (e: any) {
      const errors = e.response?.data?.errors;
      toast.error(errors ? Object.values(errors).flat().join(' ') : e.response?.data?.message || 'Could not start application');
      loadOpenIntakes();
    } finally {
      setStarting(false);
    }
  };

  const pay = async () => {
    setPaying(true);
    try {
      const invoiceId = app.application_fee_invoice_id || app.application_fee_invoice?.id;
      if (!invoiceId) {
        toast.error('Application fee invoice is missing. Please refresh and try again.');
        return;
      }
      const { data } = await api.post('/api/payments/initialize', {
        invoice_id: invoiceId,
        portal: 'student',
      });
      const outcome = await startOnlineCheckout(data, {
        verifyDemo: (reference) => api.get(`/api/payments/verify/${encodeURIComponent(reference)}`),
      });
      if (outcome === 'demo') {
        const { data: refreshedApp } = await api.get(`/api/applications/${app.id}`);
        setApp(refreshedApp);
        await refresh();
        toast.success('Application fee paid');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Payment could not be started');
    } finally {
      setPaying(false);
    }
  };

  const feePaid = app?.application_fee_invoice?.status === 'paid';
  const progressStep: 1 | 2 | 3 = !app ? 1 : feePaid ? 3 : 2;
  const pendingPayment = app?.application_fee_invoice?.pending_online_payment;

  const confirmPayment = () => {
    if (!confirmPendingOnlinePayment(nav, pendingPayment)) {
      toast.error('No pending online payment was found for this invoice.');
    }
  };

  const passportUrl = auth?.nin_identity?.photo_url
    || storageUrl(biodataPhotoPath(app))
    || null;

  if (auth?.is_student && !auth.can_apply_again) {
    return <Navigate to={auth.nin_verified ? '/' : '/verify-nin'} replace />;
  }

  const primaryBtn = 'w-full min-h-12 sm:min-h-11 sm:w-auto touch-manipulation shadow-sm';

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24 sm:space-y-8 sm:pb-8">
      <PageHeader
        eyebrow="Admissions"
        title="Start your application"
        description="Choose an application session, pay the fee, then complete the form."
      />

      <ApplyProgress current={progressStep} />

      {auth?.nin_identity && (
        <IdentityCard
          applicationId={app?.id}
          photoUrl={passportUrl}
          name={identityName(auth.nin_identity)}
          nin={auth.nin_identity.nin}
          gender={auth.nin_identity.gender}
          verified
        />
      )}

      {!app && (
        <Card className="space-y-5 !p-4 sm:!p-6">
          {!openIntakes.length ? (
            <Alert tone="info">No application sessions are open right now. Check back when admissions are announced.</Alert>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-slate-700">Select admission category</p>
                <p className="mt-1 text-xs text-slate-500 sm:hidden">Tap a category to continue.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Admission category">
                {openIntakes.map((intake) => {
                  const mode = modeLabels[intake.entry_mode] ?? {
                    label: intake.entry_mode.toUpperCase(),
                    desc: intake.name,
                  };
                  const selected = selectedIntakeId === intake.id;
                  return (
                    <button
                      key={intake.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSelectedIntakeId(intake.id)}
                      className={`relative w-full min-h-[4.5rem] min-w-0 touch-manipulation rounded-2xl border p-4 text-left transition shadow-sm ${
                        selected
                          ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-200 shadow-sky-100'
                          : 'border-slate-200 bg-white active:bg-slate-50 hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      {selected && (
                        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                          ✓
                        </span>
                      )}
                      <div className="pr-8 font-semibold text-slate-900">{mode.label}</div>
                      <div className="mt-1 text-xs leading-relaxed text-slate-500 break-words">{mode.desc}</div>
                      <div className="mt-2 text-xs text-slate-400 break-words">{intake.name}</div>
                    </button>
                  );
                })}
              </div>

              {selectedIntake && (selectedIntake.term?.session_label || selectedIntake.application_fee_amount != null) && (
                <dl className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 sm:px-4">
                  {selectedIntake.term?.session_label && (
                    <DetailRow label="Session">{selectedIntake.term.session_label}</DetailRow>
                  )}
                  {selectedIntake.application_fee_amount != null && (
                    <DetailRow label="Application fee">
                      {formatNaira(selectedIntake.application_fee_amount)}
                    </DetailRow>
                  )}
                </dl>
              )}

              {requiresJamb && (
                <div>
                  <Label htmlFor="jamb" required>
                    {selectedIntake?.entry_mode === 'de' ? 'JAMB Direct Entry number' : 'JAMB registration number'}
                  </Label>
                  <Input
                    id="jamb"
                    value={jambRegistration}
                    onChange={(e) => setJambRegistration(e.target.value.toUpperCase())}
                    required
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    placeholder="e.g. 20261234AB"
                    className="min-h-12 text-base sm:min-h-0 sm:text-sm"
                  />
                </div>
              )}

              {/* Desktop / in-card CTA; sticky bar handles phones */}
              <div className="hidden sm:block">
                <Button
                  onClick={start}
                  disabled={starting || !selectedIntake}
                  className={`${primaryBtn} bg-sky-600 hover:bg-sky-700 text-white`}
                >
                  {starting ? <Spinner label="Starting…" /> : 'Create application'}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {app && !feePaid && (
        <Card className="space-y-4 border-amber-200 bg-amber-50/50 !p-4 sm:!p-6">
          {app.application_number && (
            <Alert tone="info">
              Save your application number — use it to sign in if you do not have a JAMB number.
            </Alert>
          )}
          <Alert tone="warning">
            <strong>Application fee required.</strong> Pay below to unlock the form.
          </Alert>

          {app.application_number && (
            <div className="rounded-xl border border-sky-200 bg-white px-4 py-3 text-center sm:text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Application number</p>
              <p className="mt-1 select-all break-all font-mono text-lg font-semibold tracking-wide text-sky-800 sm:text-xl">
                {app.application_number}
              </p>
            </div>
          )}

          <dl className="rounded-xl border border-amber-100 bg-white/80 px-3 sm:px-4">
            <DetailRow label="Category">
              <span className="uppercase">{app.entry_mode}</span>
            </DetailRow>
            <DetailRow label="Stage">{app.stage?.replaceAll('_', ' ')}</DetailRow>
            {app.application_fee_invoice && (
              <DetailRow label="Amount due">
                <span className="text-base font-semibold text-sky-700 sm:text-lg">
                  {formatNaira(app.application_fee_invoice.amount)}
                </span>
                <span className="ml-2 text-xs font-normal capitalize text-slate-500">
                  · {app.application_fee_invoice.status}
                </span>
              </DetailRow>
            )}
          </dl>

          <div className="hidden sm:flex flex-col sm:flex-row gap-2">
            {pendingPayment?.reference && (
              <Button
                onClick={confirmPayment}
                className={`${primaryBtn} bg-sky-600 hover:bg-sky-700 text-white`}
              >
                Confirm payment
              </Button>
            )}
            <Button
              onClick={pay}
              disabled={paying}
              className={`${primaryBtn} bg-emerald-600 hover:bg-emerald-700 text-white`}
            >
              {paying ? <Spinner label="Processing…" /> : pendingPayment?.reference ? 'Pay again' : 'Pay application fee'}
            </Button>
          </div>
          {pendingPayment?.reference && (
            <p className="hidden sm:block text-xs text-slate-600">
              Already paid on AlatPay but still pending here? Use <span className="font-medium">Confirm payment</span> to check again.
            </p>
          )}
        </Card>
      )}

      {feePaid && (
        <Card className="space-y-4 !p-4 sm:!p-6">
          <Alert tone="success">Application fee paid. You can now complete your application form.</Alert>
          {app.application_number && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center sm:text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Application number</p>
              <p className="mt-1 select-all break-all font-mono text-base font-semibold text-slate-800">
                {app.application_number}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              onClick={() => nav('/wizard')}
              className={`${primaryBtn} bg-sky-500 hover:bg-sky-600 text-white`}
            >
              Continue application form
            </Button>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center text-center text-sm text-sky-600 hover:underline touch-manipulation sm:min-h-0"
            >
              Back to home
            </Link>
          </div>
        </Card>
      )}

      {/* Sticky primary action on small screens */}
      {!app && openIntakes.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
          <Button
            onClick={start}
            disabled={starting || !selectedIntake}
            className={`${primaryBtn} bg-sky-600 hover:bg-sky-700 text-white`}
          >
            {starting ? <Spinner label="Starting…" /> : 'Create application'}
          </Button>
        </div>
      )}
      {app && !feePaid && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden space-y-2">
          {pendingPayment?.reference && (
            <Button
              onClick={confirmPayment}
              className={`${primaryBtn} bg-sky-600 hover:bg-sky-700 text-white`}
            >
              Confirm payment
            </Button>
          )}
          <Button
            onClick={pay}
            disabled={paying}
            className={`${primaryBtn} bg-emerald-600 hover:bg-emerald-700 text-white`}
          >
            {paying ? <Spinner label="Processing…" /> : pendingPayment?.reference ? 'Pay again' : 'Pay application fee'}
          </Button>
        </div>
      )}
    </div>
  );
}
