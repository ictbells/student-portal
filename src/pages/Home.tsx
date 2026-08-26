import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { PageHeader, StepIndicator } from '../components/portal';
import { PassportPhoto } from '../components/PassportPhoto';
import { liveStage, studentFacingStatus, studentJourneyIndex, STUDENT_JOURNEY_STEPS } from '../constants/lifecycle';
import { Alert, Card } from '../components/ui';
import { formatNaira } from '../lib/money';
import { hasPendingAdmissionOffer, openOfferPrompt } from '../lib/offer';
import { storageUrl } from '../lib/storage';

type Stat = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'info';
  to?: string;
};

function StatCard({ label, value, hint, tone = 'default', to }: Stat & { to?: string }) {
  const tones = {
    default: 'border-slate-200/80 bg-white hover:border-slate-300',
    success: 'border-emerald-100 bg-emerald-50/70 hover:border-emerald-200',
    warning: 'border-amber-100 bg-amber-50/70 hover:border-amber-200',
    info: 'border-sky-100 bg-sky-50/70 hover:border-sky-200',
  };
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900 break-words leading-tight">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{hint}</p>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={`block rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${tones[tone]}`}>
        {body}
      </Link>
    );
  }
  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${tones[tone]}`}>
      {body}
    </div>
  );
}

const STUDENT_QUICK_LINKS = [
  { to: '/course-registration', label: 'Course registration', desc: 'Add & drop courses', area: 'Registration' as const },
  { to: '/wallet', label: 'Wallet', desc: 'Top up & pay', area: 'Registration' as const },
  { to: '/academic', label: 'Academic', desc: 'Results & clearance', area: 'Registration' as const },
  { to: '/invoices', label: 'Transactions', desc: 'Fees & receipts', area: 'Registration' as const },
  { to: '/clinic', label: 'Clinic', desc: 'Health records', area: 'Registration' as const },
  { to: '/hostel', label: 'Hostel', desc: 'Room & bed', area: 'Registration' as const },
];

const APPLICATION_QUICK_LINKS = [
  { to: '/apply', label: 'Apply', desc: 'Fee & start application', area: 'Application' as const },
  { to: '/wizard', label: 'Application form', desc: 'Complete your form', area: 'Application' as const },
  { to: '/status', label: 'Status', desc: 'Track your application', area: 'Application' as const },
  { to: '/invoices', label: 'Transactions', desc: 'Fees & receipts', area: 'Application' as const },
  { to: '/documents', label: 'Documents', desc: 'Uploads & letters', area: 'Application' as const },
];

function formProgress(app: any): { done: number; total: number } {
  const formSteps = [
    'biodata',
    'personal_details',
    'health_information',
    'next_of_kin',
    'sponsor',
    'application_form',
    ...(app?.entry_mode === 'utme' ? ['utme'] : []),
    'academic_qualifications',
    'programme_selection',
    'required_documents',
  ];
  const steps = app?.steps || [];
  const done = formSteps.filter((key) => {
    const step = steps.find((s: any) => s.step_key === key);
    return step && step.status !== 'pending';
  }).length;
  return { done, total: formSteps.length };
}

export default function Home() {
  const { auth } = useAuth();
  const [app, setApp] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [transcript, setTranscript] = useState<any>(null);
  const [notices, setNotices] = useState<any[]>([]);

  const isStudent = !!auth?.is_student;
  const stage = liveStage(auth?.lifecycle_stage, app?.stage);
  const journeyIndex = studentJourneyIndex(stage, app?.current_step, isStudent);
  const journeyComplete = journeyIndex >= STUDENT_JOURNEY_STEPS.length;

  useEffect(() => {
    if (auth?.application_id) {
      api.get(`/api/applications/${auth.application_id}`).then((r) => setApp(r.data)).catch(() => setApp(null));
    }
    api.get('/api/invoices').then((r) => setInvoices(r.data.data || r.data || [])).catch(() => setInvoices([]));
    api.get('/api/announcements', { params: { limit: 3 } })
      .then((r) => setNotices(Array.isArray(r.data) ? r.data : []))
      .catch(() => setNotices([]));
  }, [auth?.application_id]);

  useEffect(() => {
    if (!isStudent) return;
    api.get('/api/wallet').then((r) => setWallet(r.data)).catch(() => setWallet(null));
    api.get('/api/academic/my-enrollments').then((r) => setEnrollments(Array.isArray(r.data) ? r.data : [])).catch(() => setEnrollments([]));
    api.get('/api/academic/transcript').then((r) => setTranscript(r.data)).catch(() => setTranscript(null));
  }, [isStudent]);

  let cta = { to: '/apply', label: 'Start application' };
  if (auth?.unpaid_application_fee || auth?.lifecycle_stage === 'awaiting_application_fee') {
    cta = { to: '/apply', label: 'Pay application fee' };
  } else if (['fee_paid', 'form_in_progress'].includes(auth?.lifecycle_stage || '')) {
    cta = { to: '/wizard', label: 'Continue application form' };
  } else if (hasPendingAdmissionOffer(auth)) {
    cta = { to: '/status', label: 'Accept admission' };
  } else if (isStudent) {
    cta = { to: '/course-registration', label: 'Register courses' };
  } else if (auth?.lifecycle_stage && !['started', 'awaiting_application_fee', 'fee_paid', 'form_in_progress'].includes(auth.lifecycle_stage)) {
    cta = { to: '/status', label: 'View application status' };
  }

  const progress = formProgress(app);
  const unpaidInvoices = invoices.filter((i) => ['unpaid', 'partial'].includes(i.status));
  const paidInvoices = invoices.filter((i) => i.status === 'paid');

  const applicationStats: Stat[] = useMemo(() => {
    const feeStatus = app?.application_fee_invoice?.status === 'paid'
      ? 'Paid'
      : auth?.unpaid_application_fee
        ? 'Unpaid'
        : app?.application_fee_invoice
          ? String(app.application_fee_invoice.status)
          : '—';
    return [
      {
        label: 'Application number',
        value: app?.application_number || 'Not created',
        hint: app?.entry_mode ? String(app.entry_mode).toUpperCase() : 'Choose a category to begin',
        tone: app?.application_number ? 'info' : 'default',
      },
      {
        label: 'Current stage',
        value: studentFacingStatus(stage, isStudent),
        hint: journeyComplete ? 'This updates as admissions moves your file' : 'Complete steps 1–7 to submit',
        tone: journeyComplete ? 'success' : 'default',
      },
      {
        label: 'Application fee',
        value: feeStatus,
        hint: app?.application_fee_invoice
          ? formatNaira(app.application_fee_invoice.amount)
          : 'Fee appears after you create an application',
        tone: feeStatus === 'Paid' ? 'success' : feeStatus === 'Unpaid' ? 'warning' : 'default',
      },
      {
        label: 'Form progress',
        value: `${progress.done} / ${progress.total}`,
        hint: 'Biodata through required documents',
        tone: progress.done === progress.total && progress.done > 0 ? 'success' : 'info',
      },
      {
        label: 'Session',
        value: app?.intake?.term?.session_label || '—',
        hint: app?.intake?.name || 'Open intake window',
      },
      {
        label: 'Outstanding fees',
        value: String(unpaidInvoices.length),
        hint: unpaidInvoices.length ? 'Pay outstanding fees to continue' : 'No outstanding fees',
        tone: unpaidInvoices.length ? 'warning' : 'success',
      },
    ];
  }, [app, auth?.lifecycle_stage, auth?.unpaid_application_fee, isStudent, journeyComplete, progress.done, progress.total, stage, unpaidInvoices.length]);

  const studentStats: Stat[] = useMemo(() => {
    const student = auth?.user?.student;
    return [
      {
        label: 'Matric number',
        value: student?.matric_number || student?.student_number || 'Pending',
        hint: student?.program?.name || 'Student record',
        tone: student?.matric_number ? 'success' : 'info',
      },
      {
        label: 'Programme',
        value: student?.program?.name || app?.program?.name || '—',
        hint: student?.level ? `Level ${student.level}` : 'Registered programme',
      },
      {
        label: 'Wallet balance',
        value: wallet ? formatNaira(wallet.balance) : '—',
        hint: 'Campus wallet',
        tone: 'info',
      },
      {
        label: 'Outstanding fees',
        value: String(unpaidInvoices.length),
        hint: paidInvoices.length ? `${paidInvoices.length} paid` : 'School fees & charges',
        tone: unpaidInvoices.length ? 'warning' : 'success',
      },
      {
        label: 'Course registrations',
        value: String(enrollments.length),
        hint: enrollments.length ? 'Current academic enrollments' : 'Open course registration to add courses',
        tone: enrollments.length ? 'success' : 'default',
        to: '/course-registration',
      },
      {
        label: 'CGPA',
        value: transcript?.cgpa != null ? String(transcript.cgpa) : (transcript?.gpa != null ? String(transcript.gpa) : '—'),
        hint: 'Cumulative academic standing (released results)',
        tone: (transcript?.cgpa ?? transcript?.gpa) != null ? 'info' : 'default',
      },
    ];
  }, [auth?.user?.student, app?.program?.name, wallet, unpaidInvoices.length, paidInvoices.length, enrollments.length, transcript?.cgpa, transcript?.gpa]);

  const stats = isStudent ? studentStats : applicationStats;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-sky-50/40 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <PassportPhoto
            applicationId={auth?.application_id}
            src={storageUrl(app?.steps?.find((s: any) => s.step_key === 'biodata')?.payload?.photo_path) || auth?.nin_identity?.photo_url || null}
            alt={`${auth?.user?.name || 'Student'} passport photograph`}
            className="h-24 w-20 rounded-2xl object-cover ring-2 ring-white shadow-md bg-slate-100 mx-auto sm:mx-0"
            placeholder={(
              <div className="flex h-24 w-20 items-center justify-center rounded-2xl bg-sky-100 text-sky-800 text-lg font-semibold mx-auto sm:mx-0">
                {(auth?.user?.name || 'S').trim().charAt(0).toUpperCase()}
              </div>
            )}
          />
          <div className="min-w-0 flex-1">
        <PageHeader
          eyebrow={isStudent ? 'Student dashboard' : 'Admissions'}
          title={`Welcome, ${auth?.user?.name?.split(' ')[0] || 'student'}`}
          description={auth?.university?.name || 'Bells University of Technology'}
          action={
            hasPendingAdmissionOffer(auth) ? (
              <button
                type="button"
                onClick={openOfferPrompt}
                className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
              >
                Accept admission
              </button>
            ) : (
              <Link
                to={cta.to}
                className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition"
              >
                {cta.label}
              </Link>
            )
          }
        />
          </div>
        </div>
      </div>

      {!auth?.portal_access && auth?.unpaid_application_fee && (
        <Alert tone="warning">
          Pay your application fee to unlock the form.{' '}
          <Link to="/apply" className="underline font-medium">Go to payment</Link>
        </Alert>
      )}

      {hasPendingAdmissionOffer(auth) && (
        <Card className="border-emerald-200 bg-emerald-50/60 space-y-3">
          <div>
            <h2 className="font-semibold text-emerald-900">Congratulations — admission offer issued</h2>
            <p className="text-sm text-emerald-800/80 mt-1">
              Review your admission letter and pay the acceptance fee to complete acceptance.
            </p>
          </div>
          <button
            type="button"
            onClick={openOfferPrompt}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            View offer and accept
          </button>
        </Card>
      )}

      {!isStudent && (
        <Card className="!p-4 sm:!p-5 bg-slate-50/50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Your application journey</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Steps 1–7 are completed by you. Admissions handles review after you submit.
              </p>
            </div>
            {journeyComplete && (
              <span className="inline-flex self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                Form complete · under review
              </span>
            )}
          </div>
          <StepIndicator
            steps={STUDENT_JOURNEY_STEPS}
            currentIndex={Math.min(journeyIndex, STUDENT_JOURNEY_STEPS.length - 1)}
            isStepComplete={(index) => journeyComplete || index < journeyIndex}
          />
        </Card>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Quick links</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {(isStudent ? STUDENT_QUICK_LINKS : APPLICATION_QUICK_LINKS).map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:shadow-md hover:bg-sky-50/30"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{link.area}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 group-hover:text-sky-700 transition">{link.label}</p>
              <p className="text-xs text-slate-500 mt-1">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {notices.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Latest announcements</h2>
            <Link to="/announcements" className="text-xs font-medium text-sky-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {notices.map((item) => (
              <Card key={item.id} className="!p-4">
                <p className="text-xs font-medium text-slate-500">
                  {item.published_at
                    ? new Date(item.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                    : ''}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600 line-clamp-2 whitespace-pre-wrap">{item.body}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">
          {isStudent ? 'Campus overview' : 'Application overview'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </div>
  );
}
