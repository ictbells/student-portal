import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { Breadcrumb, PageHeader } from '../components/portal';
import { PassportPhoto } from '../components/PassportPhoto';
import { Alert, Card } from '../components/ui';
import { storageUrl } from '../lib/storage';

function formatCloseDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `Date: ${day}-${month}-${year}, Time: ${String(hour12).padStart(2, '0')}:${minutes} ${meridiem}`;
}

function formatSemester(name?: string | null) {
  if (!name) return '—';
  return /semester/i.test(name) ? name : `${name} Semester`;
}

function display(value?: string | number | null) {
  if (value == null || value === '') return '—';
  return String(value);
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function StatusPill({
  value,
  tone,
}: {
  value: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  const tones = {
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-800 ring-amber-200',
    neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}>
      {value}
    </span>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-medium text-slate-900 break-words ${mono ? 'font-mono tracking-wide' : ''}`}>
        {value == null || value === '' ? '—' : value}
      </dd>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-4 h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function paymentTone(status: string): 'success' | 'warning' | 'neutral' {
  const value = status.toLowerCase();
  if (value === 'paid' || value === 'registered' || value === 'open') return 'success';
  if (value === 'pending' || value === 'partial' || value === 'late' || value === 'closed' || value === 'in progress') return 'warning';
  return 'neutral';
}

export default function Profile() {
  const { auth } = useAuth();
  const student = auth?.user?.student;
  const [registration, setRegistration] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!auth?.is_student) return;
    api.get('/api/academic/my-registration').then((r) => setRegistration(r.data)).catch(() => setRegistration(null));
    api.get('/api/invoices').then((r) => setInvoices(r.data.data || r.data || [])).catch(() => setInvoices([]));
  }, [auth?.is_student]);

  const fullName = useMemo(() => {
    if (!student) return auth?.user?.name || 'Student';
    return [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ') || auth?.user?.name || 'Student';
  }, [student, auth?.user?.name]);

  if (!auth?.is_student || !student) {
    return (
      <div className="space-y-4">
        <PageHeader title="My student record" description="Your student record opens after acceptance fee and student creation." />
        <Alert tone="info">Complete admission and acceptance fee payment to unlock this page.</Alert>
      </div>
    );
  }

  const program = student.program;
  const department = program?.department;
  const photoUrl = storageUrl(student.photo_path) || auth.nin_identity?.photo_url || null;
  const term = auth.current_term;
  const sessionLabel = term?.session_label || auth.current_session || '—';
  const semesterLabel = formatSemester(term?.name || auth.current_semester);
  const registrationStatus = term?.registration_status || 'Closed';

  const tuitionInvoices = invoices.filter((row) => String(row.category || '') === 'tuition');
  const hasUnpaidTuition = tuitionInvoices.some((row) => ['unpaid', 'partial'].includes(String(row.status || '')));
  const hasPaidTuition = tuitionInvoices.some((row) => String(row.status || '') === 'paid');
  const tuitionStatus = hasUnpaidTuition || !hasPaidTuition ? 'Pending' : 'Paid';

  const courseRegistration = registration?.roster_status === 'registered'
    ? 'Registered'
    : registration?.roster_status === 'in_progress'
      ? 'In progress'
      : 'Not started';

  const studentStatus = String(student.status || 'active');
  const statusTone = studentStatus === 'active'
    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    : studentStatus === 'graduated'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : 'bg-slate-100 text-slate-700 ring-slate-200';

  const snapshot = [
    { label: 'Level', value: display(student.current_level) },
    { label: 'Department', value: department?.name || '—' },
    { label: 'Session', value: sessionLabel },
    { label: 'Registration', value: registrationStatus },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'My record' }]} />
        <PageHeader
          title="My student record"
          description="Your personal details and current semester academic information."
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-5 py-6 sm:px-7 sm:py-8 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.28),transparent_42%)]" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="shrink-0 mx-auto sm:mx-0">
              <PassportPhoto
                applicationId={auth.application_id}
                src={photoUrl}
                alt={`${fullName} passport photograph`}
                className="h-28 w-24 rounded-2xl object-cover ring-4 ring-white/20 shadow-lg bg-slate-700"
                placeholder={(
                  <div className="flex h-28 w-24 items-center justify-center rounded-2xl bg-sky-500/90 text-2xl font-semibold ring-4 ring-white/20 shadow-lg">
                    {initials(fullName)}
                  </div>
                )}
              />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 capitalize ${statusTone}`}>
                  {studentStatus}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">{fullName}</h2>
              <p className="mt-1.5 text-sm text-slate-200">{program?.name || 'Programme pending'}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="inline-flex items-center rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold tracking-wide ring-1 ring-white/15">
                  {student.matric_number || 'Matric pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100">
          {snapshot.map((item) => (
            <div key={item.label} className="bg-white px-4 py-4 sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 leading-snug break-words">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Section title="Personal details">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Matriculation number" value={display(student.matric_number)} mono />
            <Field label="Current level" value={display(student.current_level)} />
            <Field label="Studentship" value={display(student.status)} />
            {student.graduated_at && (
              <Field label="Graduated" value={display(student.graduated_at)} />
            )}
            {student.studentship_expires_at && (
              <Field label="Studentship ends" value={display(student.studentship_expires_at)} />
            )}
            <Field label="Department" value={display(department?.name)} />
            <Field label="Program" value={display(program?.name)} />
            <Field label="Fullname" value={display(fullName)} />
            <Field label="State of origin" value={display(student.state)} />
            <div className="sm:col-span-2">
              <Field label="Phone number" value={display(student.phone || auth.user?.phone)} />
            </div>
          </dl>
        </Section>

        <Section
          title="Academic info"
          description="Current semester information"
          action={
            <Link to="/academic" className="text-sm font-medium text-sky-600 hover:text-sky-700 shrink-0">
              Courses & results
            </Link>
          }
        >
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Current session" value={sessionLabel} />
            <Field label="Current semester" value={semesterLabel} />
            <Field
              label="Registration status"
              value={<StatusPill value={registrationStatus} tone={paymentTone(registrationStatus)} />}
            />
            <div className="sm:col-span-2">
              <Field label="Normal registration closes" value={formatCloseDateTime(term?.normal_registration_closes_at)} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Late registration closes" value={formatCloseDateTime(term?.late_registration_closes_at)} />
            </div>
            <Field
              label="Tuition fee payment"
              value={<StatusPill value={tuitionStatus} tone={paymentTone(tuitionStatus)} />}
            />
            <Field
              label="Course registration"
              value={<StatusPill value={courseRegistration} tone={paymentTone(courseRegistration)} />}
            />
            <Field label="Enrolled units" value={String(registration?.units?.overall ?? 0)} />
          </dl>
        </Section>
      </div>
    </div>
  );
}
