import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink } from '../layout/AuthLayout';
import { Button, Input, Label, PasswordInput, Spinner } from '../components/ui';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/login', { login: login.trim(), password, portal: 'student' });
      if (data.token) sessionStorage.setItem('bells_student_token', data.token);
      setAuth(data);
      toast.success('Signed in');
      if (!data.portal_access && data.unpaid_application_fee) nav('/apply');
      else nav('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.errors?.login?.[0] || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back!"
      subtitle="Use your application number, JAMB number, or matric number."
      footer={
        <p className="text-slate-500">
          New applicant? <AuthLink to="/signup">Create account</AuthLink>
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
            autoComplete="username"
          />
          <p className="text-xs text-slate-500 mt-1">
            UTME applicants use JAMB. Other applicants use their application number. Matriculated students use their matric number.
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="password">Password</Label>
            <AuthLink to="/forgot-password" className="text-xs">Forgot password?</AuthLink>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-sky-500 hover:bg-sky-600 text-white">
          {loading ? <Spinner label="Signing in…" className="text-white" /> : <span className="text-white">Sign in</span>}
        </Button>
      </form>
    </AuthLayout>
  );
}
