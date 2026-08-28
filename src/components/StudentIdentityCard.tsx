import { useMemo } from 'react';
import { useAuth } from '../auth';
import { PassportPhoto } from './PassportPhoto';
import { storageUrl } from '../lib/storage';

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

export function StudentIdentityCard() {
  const { auth } = useAuth();
  const student = auth?.user?.student;

  const fullName = useMemo(() => {
    if (!student) return auth?.user?.name || 'Student';
    return [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ') || auth?.user?.name || 'Student';
  }, [student, auth?.user?.name]);

  if (!student) return null;

  const program = student.program;
  const department = program?.department;
  const photoUrl = storageUrl(student.photo_path) || auth.nin_identity?.photo_url || null;
  const term = auth.current_term;
  const sessionLabel = term?.session_label || auth.current_session || '—';
  const registrationStatus = term?.registration_status || 'Closed';
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
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-4 py-5 sm:px-7 sm:py-8 text-white">
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
            <h2 className="text-xl sm:text-3xl font-semibold tracking-tight break-words">{fullName}</h2>
            <p className="mt-1.5 text-sm text-slate-200 break-words">{program?.name || 'Programme pending'}</p>
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
          <div key={item.label} className="bg-white px-3 py-3 sm:px-5 sm:py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 leading-snug break-words">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
