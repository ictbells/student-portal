import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { networkErrorMessage } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/toast';
import AuthLayout, { AuthLink, authPrimaryClass } from '../layout/AuthLayout';
import AdmissionGuidePopup from '../components/AdmissionGuidePopup';
import { Alert, Button, Input, Label, PasswordInput, Spinner } from '../components/ui';
import { resetOfferPrompt } from '../lib/offer';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [applicationsOpen, setApplicationsOpen] = useState<boolean | null>(null);
  const { setAuth } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    api
      .get<{ applications_open?: boolean }>('/api/portal-info')
      .then(({ data }) => setApplicationsOpen(data.applications_open === true))
      .catch(() => setApplicationsOpen(true));
  }, []);

  useEffect(() => {
    if (searchParams.get('reset') !== '1') return;
    setNotice('Password updated. Sign in with your new password.');
    const next = new URLSearchParams(searchParams);
    next.delete('reset');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
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
      const message = networkErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with the identifier issued for your application or enrolment."
      footer={
        <div className="space-y-3">
          <AdmissionGuidePopup />
          <p className="text-slate-500">
            New applicant? <AuthLink to="/signup">Create account</AuthLink>
          </p>
          <p className="text-slate-500 text-sm">
            Outside login:{' '}
            <AuthLink to="/transcript-request">Official transcript</AuthLink>
            {' · '}
            <AuthLink to="/request-pay">Other requests & pay</AuthLink>
          </p>
        </div>
      }
    >
      <form onSubmit={submit} className={`space-y-5${applicationsOpen === false ? ' mt-5' : ''}`}>
        {notice && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
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
          <div className="mb-1.5 flex items-center justify-between gap-3">
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
