import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { PasswordHints, passwordValid } from '../components/passwordHints';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink, authPrimaryClass } from '../layout/AuthLayout';
import { Alert, Button, Label, PasswordInput, Spinner } from '../components/ui';

export default function Reset() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [password_confirmation, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const ok = useMemo(() => passwordValid(password, email) && password === password_confirmation, [password, password_confirmation, email]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/reset-password', { email, token, password, password_confirmation });
      toast.success(data.message || 'Password has been reset. You may sign in.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.errors?.email?.[0] || 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <AuthLayout title="Invalid link" subtitle="This reset link is missing required details.">
        <Alert tone="error">Request a new password reset link.</Alert>
        <AuthLink to="/forgot-password">Forgot password</AuthLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password for your account."
      kicker="Account recovery"
      footer={
        <p className="text-slate-500">
          <AuthLink to="/login">Back to sign in</AuthLink>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput id="confirm" value={password_confirmation} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <PasswordHints password={password} email={email} />
        <Button type="submit" disabled={!ok || loading} className={`${authPrimaryClass} disabled:opacity-50`}>
          {loading ? <Spinner label="Saving…" className="text-white" /> : <span className="text-white">Reset password</span>}
        </Button>
      </form>
    </AuthLayout>
  );
}
