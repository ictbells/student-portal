import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink, authPrimaryClass } from '../layout/AuthLayout';
import AdmissionGuidePopup from '../components/AdmissionGuidePopup';
import { Alert, Button, Input, Label, PasswordInput, Spinner } from '../components/ui';
import { PasswordHints } from '../components/passwordHints';
import { isValidPhone, PHONE_ERROR, PHONE_HINT } from '../lib/phone';

type IdentityPreview = {
  nin: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  live?: boolean;
};

type OpenIntake = {
  id: number;
  name: string;
  entry_mode: string;
  opens_on?: string;
  closes_on?: string;
  application_fee_amount?: number | string;
  requires_jamb?: boolean;
  candidate_list_required?: boolean;
  term?: { session_label?: string };
};

const MODE_LABELS: Record<string, { label: string; desc: string }> = {
  utme: { label: 'UTME', desc: 'Unified Tertiary Matriculation Examination' },
  de: { label: 'Direct Entry', desc: 'Diploma or A-Level direct entry' },
  jupeb: { label: 'JUPEB', desc: 'Joint Universities Preliminary Examination Board' },
  transfer: { label: 'Transfer', desc: 'Transfer from another institution' },
  pg: { label: 'Postgraduate', desc: 'Masters and postgraduate programmes' },
};

export const APPLICATIONS_CLOSED_MESSAGE =
  'Applications are not open. There is no active application session, so you cannot create an account.';

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function intakeOptionLabel(intake: OpenIntake): string {
  const mode = MODE_LABELS[intake.entry_mode]?.label || intake.entry_mode.toUpperCase();
  const session = intake.term?.session_label?.trim();
  return session ? `${mode} (${session})` : mode;
}

export default function Signup() {
  const [step, setStep] = useState<'intake' | 'nin' | 'register'>('intake');
  const [intakes, setIntakes] = useState<OpenIntake[] | null>(null);
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [jambRegistration, setJambRegistration] = useState('');
  const [nin, setNin] = useState('');
  const [identity, setIdentity] = useState<IdentityPreview | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [intakesError, setIntakesError] = useState<string | null>(null);
  const { setAuth } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  useEffect(() => {
    api
      .get('/api/intakes')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setIntakes(list);
        setIntakesError(null);
      })
      .catch((err) => {
        setIntakes([]);
        setIntakesError(apiErrorMessage(err, 'Could not load application sessions. Check your connection and try again.'));
      });
  }, []);

  const selectedIntake = useMemo(
    () => intakes?.find((intake) => intake.id === selectedIntakeId) ?? null,
    [intakes, selectedIntakeId],
  );
  const requiresJamb = selectedIntake?.requires_jamb === true
    || ['utme', 'de'].includes(selectedIntake?.entry_mode || '');
  const applicationsOpen = intakes === null ? null : intakes.length > 0;

  const continueFromIntake = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedIntake) {
      const message = 'Select the application session you qualify for.';
      setFormError(message);
      toast.error(message);
      return;
    }
    if (requiresJamb && !jambRegistration.trim()) {
      const message = selectedIntake.entry_mode === 'de'
        ? 'JAMB Direct Entry number is required for this application session.'
        : 'JAMB registration number is required for this application session.';
      setFormError(message);
      toast.error(message);
      return;
    }
    if (requiresJamb && selectedIntake.candidate_list_required) {
      try {
        await api.get(`/api/candidate-data/${encodeURIComponent(jambRegistration.trim())}`, {
          params: selectedIntake.term?.session_label
            ? { academic_year: selectedIntake.term.session_label }
            : undefined,
        });
      } catch (err) {
        const message = apiErrorMessage(err, 'This registration number is not on the candidate list for this application session.');
        setFormError(message);
        toast.error(message);
        return;
      }
    }
    setStep('nin');
  };

  const verifyNin = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIntake || verifying || nin.length !== 11) return;
    setVerifying(true);
    setFormError(null);
    setExistingAccount(false);
    try {
      const { data } = await api.post<IdentityPreview>('/api/nin/preview', {
        nin: nin.trim(),
        intake_id: selectedIntake.id,
      });
      setIdentity(data);
      setPhone(data.phone != null && String(data.phone).trim() ? String(data.phone).trim() : '');
      setStep('register');
      toast.success(data.live === false
        ? 'NIN accepted in demo mode — this was not a live Prembly check.'
        : 'NIN verified');
    } catch (err: unknown) {
      const payload = (err as { response?: { data?: { existing_account?: boolean } } }).response?.data;
      if (payload?.existing_account) {
        setExistingAccount(true);
      }
      const message = apiErrorMessage(err, 'NIN verification failed.');
      setFormError(message);
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedIntake) {
      const message = 'Select an application session before creating an account.';
      setFormError(message);
      toast.warning(message);
      setStep('intake');
      return;
    }
    if (!identity) {
      const message = 'Verify your NIN before creating an account.';
      setFormError(message);
      toast.warning(message);
      setStep('nin');
      return;
    }
    if (password !== confirm) {
      const message = 'Passwords do not match.';
      setFormError(message);
      toast.error(message);
      return;
    }
    if (!isValidPhone(alternatePhone)) {
      const message = PHONE_ERROR;
      setFormError(message);
      toast.error(message);
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        nin: identity.nin,
        email,
        phone,
        alternate_phone: alternatePhone.trim(),
        password,
        password_confirmation: confirm,
        intake_id: selectedIntake.id,
      };
      if (requiresJamb) {
        payload.jamb_registration = jambRegistration.trim();
      }
      const { data } = await api.post('/api/register', payload);
      if (data.token) sessionStorage.setItem('bells_student_token', data.token);
      setAuth(data);
      toast.success('Account created');
      nav('/apply');
    } catch (err: unknown) {
      const message = apiErrorMessage(err, 'Could not create account.');
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    closed: { title: 'Applications are closed', subtitle: APPLICATIONS_CLOSED_MESSAGE },
    intake: {
      title: 'Choose your session',
      subtitle: 'Pick the application session you qualify for. An open UTME window does not admit postgraduate or transfer applicants.',
    },
    nin: {
      title: 'Create your account',
      subtitle: 'We verify your NIN first so your biodata is taken from a trusted source.',
    },
    register: {
      title: 'Complete registration',
      subtitle: 'Your identity is locked from NIN. Add contact details and a password.',
    },
  } as const;
  const heading = applicationsOpen === false ? titles.closed : titles[step];

  return (
    <AuthLayout
      title={heading.title}
      subtitle={heading.subtitle}
      kicker="New applicant"
      footer={
        <div className="space-y-3">
          <AdmissionGuidePopup autoOpen={false} />
          <p className="text-slate-500">
            Already have an account? <AuthLink to="/login">Sign in</AuthLink>
          </p>
        </div>
      }
    >
      {applicationsOpen === null ? (
        <div className="flex justify-center py-8">
          <Spinner label="Checking application session…" className="text-brand" />
        </div>
      ) : intakesError ? (
        <Alert tone="error">{intakesError}</Alert>
      ) : applicationsOpen === false ? (
        <Alert tone="warning">{APPLICATIONS_CLOSED_MESSAGE}</Alert>
      ) : (
        <>
          {existingAccount && (
            <div className="mb-4">
              <Alert tone="warning">
                This NIN is already linked to a Bells University account. Sign in with your matric number, application number, or JAMB — do not create a second account.{' '}
                <AuthLink to="/login">Sign in</AuthLink>
                {' · '}
                <AuthLink to="/forgot-password">Forgot password</AuthLink>
              </Alert>
            </div>
          )}
          {formError && !existingAccount && <div className="mb-4"><Alert tone="error">{formError}</Alert></div>}
          <ol className="mb-6 grid grid-cols-3 gap-2 text-xs">
            {([
              ['intake', '1', 'Session'],
              ['nin', '2', 'Verify NIN'],
              ['register', '3', 'Account'],
            ] as const).map(([key, n, label]) => (
              <li
                key={key}
                className={`rounded-xl border px-2 py-2 ${step === key ? 'border-crest-gold bg-[#fbf6e8] text-brand' : 'border-[#eee8dc] text-slate-400'}`}
              >
                <span className="font-semibold">{n}</span>
                <span className="mt-0.5 block truncate">{label}</span>
              </li>
            ))}
          </ol>

          {step === 'intake' && (
            <form onSubmit={continueFromIntake} className="space-y-5">
              <div>
                <Label htmlFor="intake" required>Admission category</Label>
                <select
                  id="intake"
                  value={selectedIntakeId ?? ''}
                  onChange={(e) => {
                    const nextId = e.target.value ? Number(e.target.value) : null;
                    setSelectedIntakeId(Number.isFinite(nextId) ? nextId : null);
                    const next = intakes?.find((intake) => intake.id === nextId);
                    if (!next || !['utme', 'de'].includes(next.entry_mode)) {
                      setJambRegistration('');
                    }
                  }}
                  required
                  className="w-full border border-[#e4ddd0] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-crest-gold/25 focus:border-crest-gold transition"
                >
                  <option value="" disabled>
                    Select an open application session
                  </option>
                  {intakes!.map((intake) => (
                    <option key={intake.id} value={intake.id}>
                      {intakeOptionLabel(intake)}
                    </option>
                  ))}
                </select>
                {selectedIntake && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {MODE_LABELS[selectedIntake.entry_mode]?.desc
                      || 'Use the session that matches your admission category.'}
                    {selectedIntake.closes_on
                      ? ` Closes ${formatDate(selectedIntake.closes_on)}.`
                      : ''}
                  </p>
                )}
              </div>
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
                    placeholder="e.g. 20261234AB"
                  />
                  {selectedIntake?.candidate_list_required && (
                    <p className="mt-1 text-xs text-slate-500">
                      This number must appear on the university candidate list for this session.
                    </p>
                  )}
                </div>
              )}
              <Button type="submit" disabled={!selectedIntake} className={authPrimaryClass}>
                <span className="text-white">Continue</span>
              </Button>
            </form>
          )}

          {step === 'nin' && (
            <form onSubmit={verifyNin} className="space-y-5">
              {selectedIntake && (
                <Alert tone="info">
                  Applying to <strong>{MODE_LABELS[selectedIntake.entry_mode]?.label || selectedIntake.entry_mode.toUpperCase()}</strong>
                  {' — '}
                  {selectedIntake.name}
                </Alert>
              )}
              <div>
                <Label htmlFor="nin" required>National Identification Number (NIN)</Label>
                <Input
                  id="nin"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="11-digit NIN"
                  value={nin}
                  onChange={(e) => setNin(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  required
                />
                <p className="mt-2 text-xs text-slate-500">{nin.length}/11 digits</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => setStep('intake')}
                  className="w-full rounded-xl bg-parchment text-brand sm:w-auto"
                >
                  Change session
                </Button>
                <Button
                  type="submit"
                  disabled={verifying || nin.length !== 11}
                  className={authPrimaryClass}
                >
                  {verifying ? <Spinner label="Verifying…" className="text-white" /> : <span className="text-white">Verify NIN</span>}
                </Button>
              </div>
            </form>
          )}

          {step === 'register' && (
            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">Verified identity</p>
                <p className="mt-2 font-medium text-slate-900">
                  {[identity?.first_name, identity?.middle_name, identity?.last_name].filter(Boolean).join(' ')}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  NIN {identity?.nin}
                  {identity?.gender ? ` · ${identity.gender}` : ''}
                  {identity?.date_of_birth ? ` · ${formatDate(identity.date_of_birth)}` : ''}
                </p>
              </div>
              <div>
                <Label htmlFor="email" required>Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <p className="mt-1 text-xs text-slate-500">Used for notifications and password reset.</p>
              </div>
              <div>
                <Label htmlFor="phone">Phone from NIN</Label>
                <Input id="phone" type="tel" value={phone || identity?.phone || ''} readOnly className="bg-slate-50 text-slate-700" placeholder="Not on this NIN record" />
                <p className="mt-1 text-xs text-slate-500">
                  {(phone || identity?.phone)
                    ? 'This number comes from your NIN record and cannot be changed here.'
                    : 'This NIN record did not include a phone number. Enter an alternate number below.'}
                </p>
              </div>
              <div>
                <Label htmlFor="alternate_phone" required>Alternate phone</Label>
                <Input
                  id="alternate_phone"
                  type="tel"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  required
                  placeholder="0803 123 4567 or +1 202 555 0100"
                />
                <p className="mt-1 text-xs text-slate-500">{PHONE_HINT}</p>
              </div>
              <div>
                <Label htmlFor="password" required>Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="mt-2">
                  <PasswordHints password={password} email={email} />
                </div>
              </div>
              <div>
                <Label htmlFor="confirm" required>Confirm password</Label>
                <PasswordInput
                  id="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => setStep('nin')}
                  className="w-full rounded-xl bg-parchment text-brand sm:w-auto"
                >
                  Change NIN
                </Button>
                <Button type="submit" disabled={loading} className={authPrimaryClass}>
                  {loading ? <Spinner label="Creating account…" className="text-white" /> : <span className="text-white">Create account</span>}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </AuthLayout>
  );
}
