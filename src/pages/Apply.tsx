import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { IdentityCard, PageHeader } from '../components/portal';
import { Alert, Button, Card, Input, Label, Spinner } from '../components/ui';
import { storageUrl } from '../lib/storage';

const JAMB_ENTRY_MODES = ['utme'];

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

export default function Apply() {
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [jambRegistration, setJambRegistration] = useState('');
  const [openIntakes, setOpenIntakes] = useState<OpenIntake[]>([]);
  const [app, setApp] = useState<any>(null);
  const [err, setErr] = useState('');
  const [starting, setStarting] = useState(false);
  const [paying, setPaying] = useState(false);
  const nav = useNavigate();
  const { auth, refresh } = useAuth();

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
      const first = r.data.data?.[0] || r.data[0];
      if (first) setApp(first);
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
      setErr('JAMB registration number is required for UTME applications.');
      return;
    }
    setErr('');
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
    } catch (e: any) {
      const errors = e.response?.data?.errors;
      setErr(errors ? Object.values(errors).flat().join(' ') : e.response?.data?.message || 'Could not start application');
      loadOpenIntakes();
    } finally {
      setStarting(false);
    }
  };

  const pay = async () => {
    setPaying(true);
    setErr('');
    try {
      const invoiceId = app.application_fee_invoice_id || app.application_fee_invoice?.id;
      if (!invoiceId) {
        setErr('Application fee invoice is missing. Please refresh and try again.');
        return;
      }
      const { data } = await api.post('/api/payments/paystack/initialize', {
        invoice_id: invoiceId,
        portal: 'student',
      });
      if (data.demo) {
        await api.get(`/api/payments/paystack/verify/${encodeURIComponent(data.reference)}`);
        const { data: refreshedApp } = await api.get(`/api/applications/${app.id}`);
        setApp(refreshedApp);
        await refresh();
        return;
      }
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      setErr('Payment could not be started. Please try again or pay at the admissions office.');
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Payment could not be started');
    } finally {
      setPaying(false);
    }
  };

  const feePaid = app?.application_fee_invoice?.status === 'paid';

  const passportUrl = auth?.nin_identity?.photo_url
    || storageUrl(biodataPhotoPath(app))
    || null;
  const passportSaved = !!(
    auth?.nin_identity?.photo_path
    || biodataPhotoPath(app)
    || app?.documents?.some((doc: any) => doc.doc_type === 'passport')
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Admissions"
        title="Start your application"
        description="Choose an open application window, pay the application fee, then complete the form."
      />

      {err && <Alert tone="error">{err}</Alert>}

      {auth?.nin_identity && (
        <IdentityCard
          photoUrl={passportUrl}
          name={identityName(auth.nin_identity)}
          nin={auth.nin_identity.nin}
          gender={auth.nin_identity.gender}
          verified
        />
      )}
      {auth?.nin_identity && passportSaved && (
        <p className="text-sm text-emerald-700 -mt-4">Passport photo from NIN is saved to your application file.</p>
      )}

      {!app && (
        <Card className="space-y-4 p-4 sm:p-5">
          {!openIntakes.length ? (
            <Alert tone="info">No application windows are open right now. Check back when admissions are announced.</Alert>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">Select admission category</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {openIntakes.map((intake) => {
                  const mode = modeLabels[intake.entry_mode] ?? {
                    label: intake.entry_mode.toUpperCase(),
                    desc: intake.name,
                  };
                  return (
                    <button
                      key={intake.id}
                      type="button"
                      onClick={() => setSelectedIntakeId(intake.id)}
                      className={`w-full min-w-0 text-left border rounded-2xl p-4 transition shadow-sm ${
                        selectedIntakeId === intake.id
                          ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-200 shadow-sky-100'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{mode.label}</div>
                      <div className="text-xs text-slate-500 mt-1 leading-relaxed break-words">{mode.desc}</div>
                      <div className="text-xs text-slate-400 mt-2 break-words">{intake.name}</div>
                    </button>
                  );
                })}
              </div>
              {selectedIntake && selectedIntake.term?.session_label && (
                <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 break-words space-y-1">
                  <div>
                    <span className="font-medium">Session:</span>{' '}
                    {selectedIntake.term.session_label}
                  </div>
                  {selectedIntake.application_fee_amount != null && (
                    <div>
                      <span className="font-medium">Application fee:</span>{' '}
                      ₦{Number(selectedIntake.application_fee_amount).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
              {requiresJamb && (
                <div>
                  <Label htmlFor="jamb">JAMB registration number</Label>
                  <Input
                    id="jamb"
                    value={jambRegistration}
                    onChange={(e) => setJambRegistration(e.target.value.toUpperCase())}
                    required
                    placeholder="e.g. 20261234AB"
                  />
                </div>
              )}
              <Button
                onClick={start}
                disabled={starting || !selectedIntake}
                className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
              >
                {starting ? <Spinner label="Starting…" /> : 'Create application'}
              </Button>
            </>
          )}
        </Card>
      )}

      {app && !feePaid && (
        <Card className="space-y-4 border-amber-200 bg-amber-50/50 p-4 sm:p-5">
          {app.application_number && (
            <Alert tone="info">
              Your application number is <strong className="font-mono">{app.application_number}</strong>.
              Save it — you will use it to sign in if you do not have a JAMB number.
            </Alert>
          )}
          <Alert tone="warning">
            <strong>Application fee required.</strong> Pay the fee below to unlock the application form. You cannot continue until payment is confirmed.
          </Alert>
          <div className="text-sm space-y-2 break-words">
            {app.application_number && (
              <div>
                Application number:{' '}
                <span className="font-medium font-mono">{app.application_number}</span>
              </div>
            )}
            <div>
              Admission category:{' '}
              <span className="font-medium uppercase">{app.entry_mode}</span>
            </div>
            <div>Stage: {app.stage?.replaceAll('_', ' ')}</div>
            {app.application_fee_invoice && (
              <div className="text-base sm:text-lg font-semibold text-sky-700">
                ₦{Number(app.application_fee_invoice.amount).toLocaleString()} · {app.application_fee_invoice.status}
              </div>
            )}
          </div>
          <Button onClick={pay} disabled={paying} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
            {paying ? <Spinner label="Processing…" /> : 'Pay application fee'}
          </Button>
        </Card>
      )}

      {feePaid && (
        <Card className="space-y-3 p-4 sm:p-5">
          <Alert tone="success">Application fee paid. You can now complete your application form.</Alert>
          {app.application_number && (
            <p className="text-sm text-slate-600">
              Your application number is <strong className="font-mono">{app.application_number}</strong>. Use it to sign in if you do not have a JAMB number.
            </p>
          )}
          <Button onClick={() => nav('/wizard')} className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white">
            Continue application form
          </Button>
          <Link to="/" className="block text-sm text-sky-600 hover:underline">Back to home</Link>
        </Card>
      )}
    </div>
  );
}
