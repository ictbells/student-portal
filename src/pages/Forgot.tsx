import { FormEvent, useState } from 'react';
import api from '../api';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink } from '../layout/AuthLayout';
import { Button, Input, Label, Spinner } from '../components/ui';

export default function Forgot() {
  const [login, setLogin] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/forgot-password', { login: login.trim(), portal: 'student' });
      toast.success(data.message || 'If that account exists, a reset link was sent to the email on your record.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.errors?.login?.[0] || 'Could not send reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your application number, JAMB number, or matric number. We will email a reset link to the address on your record."
      footer={
        <p className="text-slate-500">
          Remembered it? <AuthLink to="/login">Back to sign in</AuthLink>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="login">Sign-in ID</Label>
          <Input
            id="login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            placeholder="APP/2026/00001, JAMB, or matric number"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-sky-500 hover:bg-sky-600 text-white">
          {loading ? <Spinner label="Sending…" /> : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  );
}
