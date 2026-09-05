import { FormEvent, useState } from 'react';
import api, { apiErrorMessage } from '../api';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink, authPrimaryClass } from '../layout/AuthLayout';
import { Alert, Button, Input, Label, Spinner } from '../components/ui';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/forgot-password', { email: email.trim(), portal: 'student' });
      const message = data?.message || 'If that email exists, a reset link was sent.';
      setDone(message);
      toast.success(message);
    } catch (err: unknown) {
      const message = apiErrorMessage(err, 'Could not send reset link.');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter the email on your student portal record. We will send a reset link if the account exists."
      kicker="Account recovery"
      footer={
        <p className="text-slate-500">
          Remembered it? <AuthLink to="/login">Back to sign in</AuthLink>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {done && <Alert tone="success">{done}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            disabled={loading || Boolean(done)}
          />
        </div>
        <Button type="submit" disabled={loading || Boolean(done) || !email.trim()} className={authPrimaryClass}>
          {loading
            ? <Spinner label="Sending…" className="text-white" />
            : <span className="text-white">{done ? 'Link sent' : 'Send reset link'}</span>}
        </Button>
      </form>
    </AuthLayout>
  );
}
