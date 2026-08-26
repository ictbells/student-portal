import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Button, Card } from '../components/ui';

export default function NotFound() {
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname || '/';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg text-center space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-crest-gold">404</p>
          <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
          <p className="text-sm text-slate-600">
            The page <span className="font-mono text-slate-800 break-all">{path}</span> does not exist
            or is no longer available.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {auth ? (
            <Button type="button" className="bg-brand text-white hover:bg-brand-dark" onClick={() => navigate('/')}>
              Back to home
            </Button>
          ) : (
            <Button type="button" className="bg-brand text-white hover:bg-brand-dark" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          )}
          <Button
            type="button"
            className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => window.history.back()}
          >
            Go back
          </Button>
        </div>
      </Card>
    </div>
  );
}
