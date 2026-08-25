import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { networkErrorMessage } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink, authPrimaryClass } from '../layout/AuthLayout';
import { Alert, Button, Input, Label, PasswordInput, Spinner } from '../components/ui';
import { resetOfferPrompt } from '../lib/offer';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [applicationsOpen, setApplicationsOpen] = useState<boolean | null>(null);
  const { setAuth } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  useEffect(() => {
    api
      .get<{ applications_open?: boolean }>('/api/portal-info')
      .then(({ data }) => setApplicationsOpen(data.applications_open === true))
      .catch(() => setApplicationsOpen(true));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/login', { login: login.trim(), password, portal: 'student' });
      if (data.token) sessionStorage.setItem('bells_student_token', data.token);
      resetOfferPrompt();
      setAuth(data);
      toast.success('Signed in');
      if (!data.portal_access && data.unpaid_application_fee) nav('/apply');
      else nav('/');
    } catch (err: unknown) {
      toast.error(networkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with the identifier issued for your application or enrolment."
      footer={
        <p className="text-slate-500">
          New applicant? <AuthLink to="/signup">Create account</AuthLink>
        </p>
      }
    >
      
      <form onSubmit={submit} className={`space-y-5${applicationsOpen === false ? ' mt-5' : ''}`}>
        <div>
          <Label htmlFor="login">Jamb/Matric/Application Number</Label>
          <Input
            id="login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            placeholder="APP/2026/00001, JAMB, or matric number"
            autoComplete="username"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
          />
          
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <AuthLink to="/forgot-password" className="text-xs font-medium">Forgot password?</AuthLink>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={loading} className={authPrimaryClass}>
          {loading ? <Spinner label="Signing in…" className="text-white" /> : <span className="text-white">Sign in</span>}
        </Button>
      </form>
    </AuthLayout>
  );
}
