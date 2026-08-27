import { FormEvent, useState } from 'react';
import api from '../api';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink, authPrimaryClass } from '../layout/AuthLayout';
import { Button, Input, Label, Spinner } from '../components/ui';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/forgot-password', { email: email.trim(), portal: 'student' });
      toast.success(data.message || 'If that email exists, a reset link was sent.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.errors?.email?.[0] || 'Could not send reset link.');
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
          />
        </div>
        <Button type="submit" disabled={loading} className={authPrimaryClass}>
          {loading ? <Spinner label="Sending…" className="text-white" /> : <span className="text-white">Send reset link</span>}
        </Button>
      </form>
    </AuthLayout>
  );
}
