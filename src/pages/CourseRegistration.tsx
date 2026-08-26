import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { Breadcrumb, PageHeader } from '../components/portal';
import { useToast } from '../components/toast';
import { Alert, Button, Card, Input, Label, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';

const COURSE_BUCKETS = [
  { value: 'general', label: 'General' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'departmental', label: 'Departmental' },
];

function groupByBucket<T extends { bucket?: string; course?: { course_type?: string }; offering?: { course?: { course_type?: string } } }>(rows: T[]) {
  return COURSE_BUCKETS.map((bucket) => ({
    ...bucket,
    rows: rows.filter((row) => (row.bucket || row.course?.course_type || row.offering?.course?.course_type || 'departmental') === bucket.value),
  }));
}

function courseStatusLabel(value?: string) {
  if (value === 'elective') return 'Elective';
  if (value === 'required') return 'Required';
  if (value === 'core') return 'Core';
  return value || '';
}

function courseProgrammePrefix(course?: { programs?: { name?: string; code?: string | null }[] } | null) {
  const labels = (course?.programs || [])
    .map((program) => program.name || program.code)
    .filter((value): value is string => Boolean(value));
  if (labels.length === 0) return '';
  const shown = labels.slice(0, 3);
  const extra = labels.length - shown.length;
  const text = extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ');
  return `(${text}) `;
}

function courseHeading(course?: { code?: string; title?: string; programs?: { name?: string; code?: string | null }[] } | null) {
  if (!course) return '';
  return `${course.code || ''} ${courseProgrammePrefix(course)}${course.title || ''}`.trim();
}

function defaultSelectedIds(rows: any[]) {
  return rows.filter(isDefaultSelected).map((row: any) => row.id);
}

function isRequiredRow(row: any) {
  return Boolean(row?.required) || row?.course?.status === 'required';
}

function isDefaultSelected(row: any) {
  return isRequiredRow(row) || row?.course?.status !== 'elective';
}

function courseUnits(row: any) {
  return Number(row?.course?.units || row?.offering?.course?.units || 0);
}

function courseBucket(row: any) {
  return row?.bucket || row?.course?.course_type || row?.offering?.course?.course_type || 'departmental';
}

function addSelectionUnits(base: Record<string, number>, rows: any[]) {
  const next = {
    general: Number(base.general || 0),
    faculty: Number(base.faculty || 0),
    departmental: Number(base.departmental || 0),
    overall: Number(base.overall || 0),
  };
  for (const row of rows) {
    const units = courseUnits(row);
    const bucket = courseBucket(row);
    if (bucket === 'general' || bucket === 'faculty' || bucket === 'departmental') {
      next[bucket] += units;
    } else {
      next.departmental += units;
    }
    next.overall += units;
  }
  return next;
}

function apiErrorMessage(e: any, fallback: string) {
  const data = e?.response?.data;
  const errors = data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find((v) => typeof v === 'string');
    if (typeof first === 'string') return first;
  }
  return data?.message || fallback;
}

function windowBadgeStatus(windowStatus: string) {
  if (windowStatus === 'Open') return 'paid';
  if (windowStatus === 'Late') return 'partial';
  return 'unpaid';
}

function StatusBadge({ status, label }: { status?: string; label?: string }) {
  const value = (status || 'unknown').toLowerCase();
  const tones: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    issued: 'bg-sky-50 text-sky-700 ring-sky-200',
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    unpaid: 'bg-amber-50 text-amber-700 ring-amber-200',
    partial: 'bg-amber-50 text-amber-700 ring-amber-200',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 capitalize ${tones[value] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
      {label || status || 'unknown'}
    </span>
  );
}

export default function CourseRegistration() {
  const { auth } = useAuth();
  const toast = useToast();
  const [reg, setReg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [units, setUnits] = useState('15');
  const [reason, setReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const load = () => {
    setLoading(true);
    return api.get('/api/academic/my-registration')
      .then((r) => {
        setReg(r.data);
        setSelectedIds(defaultSelectedIds(r.data?.available || []));
      })
      .catch(() => setReg(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!auth?.is_student) return;
    load();
  }, [auth?.is_student]);

  if (!auth?.is_student) return <Navigate to="/" replace />;

  const registerSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select the courses you want to register.');
      return;
    }
    setBusyId('register');
    try {
      const { data } = await api.post('/api/academic/my-registration', { course_offering_ids: selectedIds });
      if (data?.enrollments) {
        setReg(data);
        setSelectedIds(defaultSelectedIds(data.available || []));
      } else {
        await load();
      }
      toast.success(`Registered ${selectedIds.length} course${selectedIds.length === 1 ? '' : 's'}.`);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'Could not register the selected courses.'));
    } finally {
      setBusyId(null);
    }
  };

  const drop = async (enrollmentId: number) => {
    setBusyId(`drop-${enrollmentId}`);
    try {
      await api.post(`/api/academic/my-registration/enrollments/${enrollmentId}/drop`);
      toast.success('Course dropped.');
      await load();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'Could not drop this course.'));
    } finally {
      setBusyId(null);
    }
  };

  const requestExtension = async () => {
    setBusyId('extension');
    try {
      await api.post('/api/academic/my-registration/extension', {
        requested_units: Number(units) || 1,
        reason,
      });
      toast.success('Extension requested.');
      setReason('');
      await load();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'Could not request an extension.'));
    } finally {
      setBusyId(null);
    }
  };

  const toggleCourse = (row: any) => {
    if (isRequiredRow(row)) return;
    setSelectedIds((current) => (
      current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]
    ));
  };

  const windowStatus = reg?.window || 'Closed';
  const extension = reg?.extension;
  const paidExtension = extension?.status === 'paid';
  const canMutate = !!reg?.can_self_register;
  const blockReason = !canMutate
    ? (reg?.cannot_register_reason || 'Add and drop are unavailable until course registration opens for you.')
    : null;
  const enrollments = [...(reg?.enrollments || [])].sort((a: any, b: any) => Number(!!b.is_carry_over) - Number(!!a.is_carry_over));
  const available = reg?.available || [];
  const availableGroups = groupByBucket(available);
  const enrolledGroups = groupByBucket(enrollments);
  const termLabel = reg?.term?.name ? `${reg.term.session_label || ''} ${reg.term.name}`.trim() : 'Current semester';
  const selectedRows = available.filter((row: any) => selectedIds.includes(row.id));
  const projectedUnits = addSelectionUnits(reg?.units || {}, selectedRows);
  const submitting = busyId === 'register';

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Course registration' }]} />
        <PageHeader
          title="Course registration"
          description="Tick the courses you will take this semester, check your unit totals, then submit once."
          action={canMutate && available.length > 0 ? (
            <Button
              type="button"
              disabled={submitting || selectedIds.length === 0 || busyId !== null}
              className="bg-sky-600 hover:bg-sky-700 text-white"
              onClick={registerSelected}
            >
              {submitting ? 'Registering…' : `Register ${selectedIds.length} course${selectedIds.length === 1 ? '' : 's'}`}
            </Button>
          ) : undefined}
        />
      </div>

      {loading && !reg && <Spinner label="Loading registration…" />}

      {reg && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-slate-900">{termLabel}</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Window: <span className="font-medium text-slate-700">{windowStatus}</span>
                {' · '}Roster: <span className="font-medium text-slate-700">{String(reg.roster_status || 'not started').replaceAll('_', ' ')}</span>
                {' · '}Tuition: <span className="font-medium text-slate-700">{Math.round(reg.tuition_percent || 0)}%</span>
              </p>
            </div>
            <StatusBadge status={windowBadgeStatus(windowStatus)} label={windowStatus} />
          </div>

          <div className="space-y-4 text-sm">
            {windowStatus === 'Open' && canMutate && (
              <Alert tone="info">Registration is open. Tick your courses, review the unit checklist, then use Register to submit your choice.</Alert>
            )}
            {windowStatus === 'Late' && !paidExtension && (
              <Alert tone="warning">The open window has closed. Request an extension, pay the invoice, then register until late registration closes.</Alert>
            )}
            {windowStatus === 'Late' && paidExtension && (
              <Alert tone="success">
                Your extension is paid. You can add or drop courses until {extension?.expires_at ? new Date(extension.expires_at).toLocaleString() : 'the late window closes'}.
              </Alert>
            )}
            {windowStatus === 'Closed' && (
              <Alert tone="warning">Course registration is closed for this semester. Contact academic staff if you still need changes.</Alert>
            )}
            {!reg.tuition_ok && (
              <Alert tone="warning">
                Pay at least 25% of current-session tuition before registering courses.{' '}
                <Link to="/invoices" className="text-sky-700 underline">Open invoices</Link>
              </Alert>
            )}
            {blockReason && canMutate === false && windowStatus !== 'Closed' && reg.tuition_ok && (
              <Alert tone="warning">{blockReason}</Alert>
            )}

            <div>
              <h3 className="font-medium text-slate-800 mb-2">Unit checklist</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[...COURSE_BUCKETS, { value: 'overall', label: 'Overall' }].map((bucket) => {
                  const limit = reg.limits?.[bucket.value] || {};
                  const enrolled = Number(reg.units?.[bucket.value] ?? 0);
                  const projected = Number(projectedUnits[bucket.value as keyof typeof projectedUnits] ?? enrolled);
                  const min = limit.min;
                  const max = limit.max;
                  const overMax = max != null && projected > max;
                  const underMin = min != null && projected > 0 && projected < min;
                  return (
                    <div key={bucket.value} className={`rounded-lg border px-3 py-2 ${overMax ? 'border-amber-300 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">{bucket.label}</p>
                      <p className="font-semibold text-slate-800">{projected} / {max ?? '—'} units</p>
                      <p className="text-xs text-slate-500">
                        {enrolled} registered{selectedRows.length ? ` · ${projected - enrolled} selected` : ''}
                        {min != null ? ` · Min ${min}` : ''}
                        {limit.grace ? ` · grace +${limit.grace}` : ''}
                      </p>
                      {overMax && <p className="text-[11px] text-amber-800 mt-1">Over the maximum.</p>}
                      {underMin && !overMax && <p className="text-[11px] text-amber-800 mt-1">Below the minimum.</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            {(reg.carry_overs || []).length > 0 && (
              <div>
                <h3 className="font-medium text-slate-800 mb-1">Required carry-overs</h3>
                <ul className="divide-y divide-slate-100">
                  {reg.carry_overs.map((row: any) => (
                    <li key={row.id} className="py-2 flex justify-between gap-3">
                      <span>{courseHeading(row.offering?.course)} ({row.offering?.course?.units} units)</span>
                      <span className="text-xs font-medium text-amber-700">Cannot drop</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="font-medium text-slate-800 mb-1">Registered</h3>
              {enrollments.length === 0 && <p className="text-slate-500">No courses registered this semester.</p>}
              {enrolledGroups.map((group) => group.rows.length > 0 && (
                <div key={group.value} className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{group.label}</p>
                  <ul className="divide-y divide-slate-100">
                    {group.rows.map((row: any) => {
                      const dropBlocked = !canMutate || row.is_carry_over;
                      return (
                        <li key={row.id} className="py-2 flex justify-between gap-3 items-center">
                          <span>
                            {courseHeading(row.offering?.course)} ({row.offering?.course?.units} units)
                            {row.offering?.course?.status ? ` · ${courseStatusLabel(row.offering.course.status)}` : ''}
                            {row.is_carry_over ? ' · carry-over' : ''}
                          </span>
                          <Button
                            type="button"
                            disabled={dropBlocked || busyId !== null}
                            title={row.is_carry_over ? 'Carry-over courses cannot be dropped.' : (blockReason || undefined)}
                            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                            onClick={() => drop(row.id)}
                          >
                            {busyId === `drop-${row.id}` ? 'Dropping…' : 'Drop'}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-2 mb-1">
                <h3 className="font-medium text-slate-800">Available courses</h3>
                <p className="text-xs text-slate-500">{selectedIds.length} selected</p>
              </div>
              {paidExtension && extension?.approved_units != null && (
                <p className="text-xs text-slate-500 mb-2">Your paid extension caps this load at {extension.approved_units} units.</p>
              )}
              {blockReason && (
                <p className="text-xs text-amber-800 mb-2">{blockReason} Register stays disabled until this is resolved.</p>
              )}
              {availableGroups.every((group) => group.rows.length === 0) && (
                <p className="text-slate-500">No offerings are available for you this semester.</p>
              )}
              {availableGroups.map((group) => group.rows.length > 0 && (
                <div key={group.value} className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{group.label}</p>
                  <ul className="divide-y divide-slate-100">
                    {group.rows.map((row: any) => {
                      const checked = selectedIds.includes(row.id);
                      const locked = isRequiredRow(row);
                      const seats = row.unlimited || row.capacity == null ? 'Unlimited seats' : `${row.seats_left} seats`;
                      return (
                        <li key={row.id} className="py-2">
                          <label className={`flex items-start gap-3 ${canMutate ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              checked={checked}
                              disabled={!canMutate || busyId !== null || locked}
                              onChange={() => toggleCourse(row)}
                            />
                            <span>
                              <span className="font-medium text-slate-900">{courseHeading(row.course)}</span>
                              <span className="text-slate-600"> ({row.course?.units} units)</span>
                              {row.course?.status ? ` · ${courseStatusLabel(row.course.status)}` : ''}
                              {locked ? ' · must register' : ''}
                              {' · '}{seats}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {canMutate && available.length > 0 && (
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    disabled={submitting || selectedIds.length === 0 || busyId !== null}
                    className="bg-sky-600 hover:bg-sky-700 text-white"
                    onClick={registerSelected}
                  >
                    {submitting ? 'Registering…' : `Register ${selectedIds.length} course${selectedIds.length === 1 ? '' : 's'}`}
                  </Button>
                </div>
              )}
            </div>

            {windowStatus === 'Late' && !paidExtension && (
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                {extension?.status === 'pending' && <Alert tone="info">Your extension request is waiting for staff review.</Alert>}
                {extension?.status === 'approved' && (
                  <Alert tone="warning">
                    Extension approved. Pay invoice {extension.invoice?.number || ''} ({formatNaira(extension.invoice?.amount)}) to continue registering.
                    {' '}<Link to="/invoices" className="underline">Open invoices</Link>
                  </Alert>
                )}
                {(!extension || ['rejected', 'expired', 'cancelled'].includes(extension.status)) && (
                  <>
                    <p className="font-medium text-slate-800">Request a registration extension</p>
                    <Label>Intended units</Label>
                    <Input value={units} onChange={(e) => setUnits(e.target.value)} />
                    <Label>Reason</Label>
                    <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button
                      type="button"
                      className="bg-sky-600 hover:bg-sky-700 text-white"
                      onClick={requestExtension}
                      disabled={!reason || busyId !== null}
                    >
                      {busyId === 'extension' ? 'Submitting…' : 'Submit request'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
