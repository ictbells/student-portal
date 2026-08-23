import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { PageHeader } from '../components/portal';
import { LIFECYCLE_STEPS, lifecycleIndex } from '../constants/lifecycle';
import { Alert, Card } from '../components/ui';

export default function Home() {
  const { auth } = useAuth();
  const current = lifecycleIndex(auth?.lifecycle_stage, undefined, auth?.is_student);

  let cta = { to: '/apply', label: 'Start application' };
  if (auth?.unpaid_application_fee || auth?.lifecycle_stage === 'awaiting_application_fee') {
    cta = { to: '/apply', label: 'Pay application fee' };
  } else if (['fee_paid', 'form_in_progress'].includes(auth?.lifecycle_stage || '')) {
    cta = { to: '/wizard', label: 'Continue application form' };
  } else if (auth?.unpaid_acceptance_fee) {
    cta = { to: '/invoices', label: 'Pay acceptance fee' };
  } else if (auth?.is_student) {
    cta = { to: '/profile', label: 'View my record' };
  } else if (auth?.lifecycle_stage && !['started', 'awaiting_application_fee', 'fee_paid', 'form_in_progress'].includes(auth.lifecycle_stage)) {
    cta = { to: '/status', label: 'View application status' };
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={`Welcome, ${auth?.user?.name?.split(' ')[0] || 'student'}`}
        description={`${auth?.university?.name || 'Bells University'} · ${auth?.university?.motto || 'Chords of Knowledge'}`}
      />

      {!auth?.portal_access && auth?.unpaid_application_fee && (
        <Alert tone="warning">
          Pay your application fee to unlock the form. <Link to="/apply" className="underline font-medium">Go to payment</Link>
        </Alert>
      )}

      <Card>
        <h2 className="font-semibold text-slate-900 mb-4">Your admission journey</h2>
        <ol className="space-y-3">
          {LIFECYCLE_STEPS.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={step.key} className={`flex gap-3 text-sm ${active ? 'font-semibold text-sky-700' : done ? 'text-emerald-700' : 'text-slate-400'}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-offset-2 ring-offset-white ${active ? 'bg-sky-600 text-white ring-sky-100' : done ? 'bg-emerald-600 text-white ring-emerald-100' : 'bg-slate-100 text-slate-500 ring-slate-100'}`}>
                  {done ? '✓' : i + 1}
                </span>
                <span className="pt-0.5">{step.label}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      <Link to={cta.to} className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition">
        {cta.label}
      </Link>
    </div>
  );
}
