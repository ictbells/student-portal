import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink, authPrimaryClass } from '../layout/AuthLayout';
import { Button, Input, Label, PasswordInput, Spinner } from '../components/ui';
import { PasswordHints } from '../components/passwordHints';

type IdentityPreview = {
  nin: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  live?: boolean;
};

const IDENTITY_FIELDS = [
  { key: 'nin', label: 'NIN' },
  { key: 'first_name', label: 'First name' },
  { key: 'middle_name', label: 'Middle name' },
  { key: 'last_name', label: 'Surname' },
  { key: 'date_of_birth', label: 'Date of birth' },
  { key: 'gender', label: 'Gender' },
] as const;

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function Signup() {
  const [step, setStep] = useState<'nin' | 'register'>('nin');
  const [nin, setNin] = useState('');
  const [identity, setIdentity] = useState<IdentityPreview | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { setAuth } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const verifyNin = async (e: FormEvent) => {
    e.preventDefault();
    if (verifying || nin.length !== 11) return;
    setVerifying(true);
    try {
      const { data } = await api.post<IdentityPreview>('/api/nin/preview', { nin: nin.trim() });
      setIdentity(data);
      setStep('register');
      toast.success(data.live === false
        ? 'NIN accepted in demo mode — this was not a live Prembly check.'
        : 'NIN verified');
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      toast.error(errors ? Object.values(errors).flat().join(' ') : err.response?.data?.message || 'NIN verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identity) {
      toast.warning('Verify your NIN before creating an account.');
      setStep('nin');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/register', {
        nin: identity.nin,
        email,
        phone,
        password,
        password_confirmation: confirm,
      });
      if (data.token) sessionStorage.setItem('bells_student_token', data.token);
      setAuth(data);
      toast.success('Account created');
      nav('/apply');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const errors = err.response?.data?.errors;
      toast.error(errors ? Object.values(errors).flat().join(' ') : msg || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={step === 'nin' ? 'Create your account' : 'Complete registration'}
      subtitle={step === 'nin'
        ? 'We verify your NIN first so your biodata is taken from a trusted source.'
        : 'Your identity is locked from NIN. Add contact details and a password.'}
      kicker="New applicant"
      footer={
        <p className="text-slate-500">
          Already have an account? <AuthLink to="/login">Sign in</AuthLink>
        </p>
      }
    >
      <ol className="mb-6 grid grid-cols-2 gap-2 text-xs">
        <li className={`rounded-xl border px-3 py-2 ${step === 'nin' ? 'border-crest-gold bg-[#fbf6e8] text-brand' : 'border-[#eee8dc] text-slate-400'}`}>
          <span className="font-semibold">1</span> Verify NIN
        </li>
        <li className={`rounded-xl border px-3 py-2 ${step === 'register' ? 'border-crest-gold bg-[#fbf6e8] text-brand' : 'border-[#eee8dc] text-slate-400'}`}>
          <span className="font-semibold">2</span> Account details
        </li>
      </ol>
      {step === 'nin' ? (
        <form onSubmit={verifyNin} className="space-y-5">
          <div>
            <Label htmlFor="nin">National Identification Number (NIN)</Label>
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
          <Button
            type="submit"
            disabled={verifying || nin.length !== 11}
            className={authPrimaryClass}
          >
            {verifying ? <Spinner label="Verifying…" className="text-white" /> : <span className="text-white">Verify NIN</span>}
          </Button>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">Verified identity</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {IDENTITY_FIELDS.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    readOnly
                    className="bg-white/80"
                    value={
                      field.key === 'date_of_birth'
                        ? formatDate(identity?.[field.key])
                        : identity?.[field.key] || ''
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <p className="mt-1 text-xs text-slate-500">Used for notifications and password reset.</p>
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
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
            <Label htmlFor="confirm">Confirm password</Label>
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
    </AuthLayout>
  );
}
