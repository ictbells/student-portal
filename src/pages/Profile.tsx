import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { Breadcrumb, PageHeader } from '../components/portal';
import { StudentCampusDashboard } from '../components/StudentCampusDashboard';
import { Alert, Card } from '../components/ui';

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
  return `${day}-${month}-${year}, Time: ${String(hour12).padStart(2, '0')}:${minutes} ${meridiem}`;
}

function formatSemester(name?: string | null) {
  if (!name) return '—';
  return /semester/i.test(name) ? name : `${name} Semester`;
}

function display(value?: string | number | null) {
  if (value == null || value === '') return '—';
  return String(value);
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
  if (value === 'pending' || value === 'partial' || value === 'part' || value === 'late' || value === 'closed' || value === 'in progress') return 'warning';
  return 'neutral';
}

export default function Profile() {
  const { auth } = useAuth();
  const student = auth?.user?.student;
  const [registration, setRegistration] = useState<any>(null);

  useEffect(() => {
    if (!auth?.is_student) return;
    api.get('/api/academic/my-registration').then((r) => setRegistration(r.data)).catch(() => setRegistration(null));
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
  const term = auth.current_term;
  const sessionLabel = term?.session_label || auth.current_session || '—';
  const semesterLabel = formatSemester(term?.name || auth.current_semester);
  const registrationStatus = term?.registration_status || 'Closed';

  const tuitionPercent = Number(registration?.tuition_percent);
  const tuitionStatus = Number.isFinite(tuitionPercent) && tuitionPercent >= 100
    ? 'Paid'
    : Number.isFinite(tuitionPercent) && tuitionPercent > 0
      ? 'Part'
      : 'Pending';

  const courseRegistration = registration?.roster_status === 'registered'
    ? 'Registered'
    : registration?.roster_status === 'in_progress'
      ? 'In progress'
      : 'Not started';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'My record' }]} />
      <StudentCampusDashboard />

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
            <Link to="/course-registration" className="text-sm font-medium text-sky-600 hover:text-sky-700 shrink-0">
              Course registration
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
