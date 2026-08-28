import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { PageHeader } from './portal';
import { PassportPhoto } from './PassportPhoto';
import { Card } from './ui';
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

function StatCard({ label, value, hint, tone = 'default', to }: Stat) {
  const tones = {
    default: 'border-slate-200/80 bg-white hover:border-slate-300',
    success: 'border-emerald-100 bg-emerald-50/70 hover:border-emerald-200',
    warning: 'border-amber-100 bg-amber-50/70 hover:border-amber-200',
    info: 'border-sky-100 bg-sky-50/70 hover:border-sky-200',
  };
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-lg sm:text-xl font-semibold text-slate-900 break-words leading-tight">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{hint}</p>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={`block rounded-2xl border p-3 sm:p-4 shadow-sm transition hover:shadow-md ${tones[tone]}`}>
        {body}
      </Link>
    );
  }
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 shadow-sm transition hover:shadow-md ${tones[tone]}`}>
      {body}
    </div>
  );
}

export function StudentCampusDashboard() {
  const { auth } = useAuth();
  const [app, setApp] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [transcript, setTranscript] = useState<any>(null);
  const [notices, setNotices] = useState<any[]>([]);

  useEffect(() => {
    if (auth?.application_id) {
      api.get(`/api/applications/${auth.application_id}`).then((r) => setApp(r.data)).catch(() => setApp(null));
    }
    api.get('/api/invoices').then((r) => setInvoices(r.data.data || r.data || [])).catch(() => setInvoices([]));
    api.get('/api/announcements', { params: { limit: 3 } })
      .then((r) => setNotices(Array.isArray(r.data) ? r.data : []))
      .catch(() => setNotices([]));
    api.get('/api/wallet').then((r) => setWallet(r.data)).catch(() => setWallet(null));
    api.get('/api/academic/my-enrollments', { params: { current: 1 } })
      .then((r) => setEnrollments(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEnrollments([]));
    api.get('/api/academic/transcript').then((r) => setTranscript(r.data)).catch(() => setTranscript(null));
  }, [auth?.application_id]);

  const unpaidInvoices = invoices.filter((i) => ['unpaid', 'partial'].includes(i.status));
  const paidInvoices = invoices.filter((i) => i.status === 'paid');

  const stats: Stat[] = useMemo(() => {
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
        value: wallet?.outstanding != null
          ? formatNaira(wallet.outstanding)
          : formatNaira(unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.balance ?? invoice.amount ?? 0), 0)),
        hint: Number(wallet?.outstanding ?? 0) > 0
          ? (Number(wallet?.prior_unpaid_count ?? 0) > 0
            ? 'Pay previous session fees first'
            : 'Pay outstanding fees to continue')
          : (paidInvoices.length ? `${paidInvoices.length} paid` : 'School fees & charges'),
        tone: Number(wallet?.outstanding ?? unpaidInvoices.length) > 0 ? 'warning' : 'success',
        to: '/invoices',
      },
      {
        label: 'Course registrations',
        value: String(enrollments.length),
        hint: enrollments.length ? 'Current semester enrollments' : 'Open course registration to add courses',
        tone: enrollments.length ? 'success' : 'default',
        to: '/course-registration',
      },
      {
        label: 'CGPA',
        value: transcript?.cgpa != null ? String(transcript.cgpa) : (transcript?.gpa != null ? String(transcript.gpa) : '—'),
        hint: 'Cumulative academic standing (released results)',
        tone: (transcript?.cgpa ?? transcript?.gpa) != null ? 'info' : 'default',
        to: '/academic/unsigned-transcript',
      },
    ];
  }, [auth?.user?.student, app?.program?.name, wallet, unpaidInvoices, paidInvoices.length, enrollments.length, transcript?.cgpa, transcript?.gpa]);

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
              eyebrow="Student dashboard"
              title={`Welcome, ${auth?.user?.name?.split(' ')[0] || 'student'}`}
              description={auth?.university?.name || 'Bells University of Technology'}
              action={
                hasPendingAdmissionOffer(auth) ? (
                  <button
                    type="button"
                    onClick={openOfferPrompt}
                    className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                  >
                    Accept admission
                  </button>
                ) : (
                  <Link
                    to="/course-registration"
                    className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition"
                  >
                    Register courses
                  </Link>
                )
              }
            />
          </div>
        </div>
      </div>

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
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            View offer and accept
          </button>
        </Card>
      )}

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
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Campus overview</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </div>
  );
}
