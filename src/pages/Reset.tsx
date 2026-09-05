import { FormEvent, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../api';
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
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();
  const nav = useNavigate();
  const ok = useMemo(() => passwordValid(password, email) && password === password_confirmation, [password, password_confirmation, email]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/reset-password', { email, token, password, password_confirmation });
      const message = data?.message || 'Password has been reset. You may sign in.';
      setDone(message);
      toast.success(message);
      window.setTimeout(() => nav({ pathname: '/login', search: '?reset=1' }), 1200);
    } catch (err: unknown) {
      const message = apiErrorMessage(err, 'Could not reset password.');
      setError(message);
      toast.error(message);
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
        {done && <Alert tone="success">{done} Redirecting to sign in…</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading || Boolean(done)}
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            value={password_confirmation}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={loading || Boolean(done)}
          />
        </div>
        <PasswordHints password={password} email={email} />
        <Button type="submit" disabled={!ok || loading || Boolean(done)} className={`${authPrimaryClass} disabled:opacity-50`}>
          {loading
            ? <Spinner label="Saving…" className="text-white" />
            : <span className="text-white">{done ? 'Password saved' : 'Reset password'}</span>}
        </Button>
      </form>
    </AuthLayout>
  );
}
