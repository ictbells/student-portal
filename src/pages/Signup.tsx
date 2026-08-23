import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import AuthLayout, { AuthLink } from '../layout/AuthLayout';
import { Alert, Button, Input, Label, PasswordInput, Spinner } from '../components/ui';

type IdentityPreview = {
  nin: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { setAuth } = useAuth();
  const nav = useNavigate();

  const verifyNin = async (e: FormEvent) => {
    e.preventDefault();
    if (verifying || nin.length !== 11) return;
    setError('');
    setVerifying(true);
    try {
      const { data } = await api.post<IdentityPreview>('/api/nin/preview', { nin: nin.trim() });
      setIdentity(data);
      setStep('register');
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join(' ') : err.response?.data?.message || 'NIN verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identity) {
      setError('Verify your NIN before creating an account.');
      setStep('nin');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
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
      nav('/apply');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const errors = err.response?.data?.errors;
      if (errors) {
        setError(Object.values(errors).flat().join(' '));
      } else {
        setError(msg || 'Could not create account.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Initialize account"
      subtitle={step === 'nin'
        ? 'Verify your NIN first, then complete your registration details.'
        : 'Complete your account details to register for admission.'}
      footer={
        <p className="text-slate-500">
          Already have an account? <AuthLink to="/login">Sign in</AuthLink>
        </p>
      }
    >
      {step === 'nin' ? (
        <form onSubmit={verifyNin} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
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
          </div>
          <Button
            type="submit"
            disabled={verifying || nin.length !== 11}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white"
          >
            {verifying ? <Spinner label="Verifying…" /> : 'Verify NIN'}
          </Button>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {IDENTITY_FIELDS.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  readOnly
                  className="bg-slate-100"
                  value={
                    field.key === 'date_of_birth'
                      ? formatDate(identity?.[field.key])
                      : identity?.[field.key] || ''
                  }
                />
              </div>
            ))}
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <p className="text-xs text-slate-500 mt-1">Used for notifications and password reset.</p>
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
            <p className="text-xs text-slate-500 mt-1">8+ chars, upper, lower, number, symbol</p>
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
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              onClick={() => {
                setStep('nin');
                setError('');
              }}
              className="w-full sm:w-auto bg-slate-100 text-slate-800"
            >
              Change NIN
            </Button>
            <Button type="submit" disabled={loading} className="w-full bg-sky-500 hover:bg-sky-600 text-white">
              {loading ? <Spinner label="Creating account…" /> : 'Initialize account'}
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
