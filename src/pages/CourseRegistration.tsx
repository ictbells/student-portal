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

  const load = () => {
    setLoading(true);
    return api.get('/api/academic/my-registration')
      .then((r) => setReg(r.data))
      .catch(() => setReg(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!auth?.is_student) return;
    load();
  }, [auth?.is_student]);

  if (!auth?.is_student) return <Navigate to="/" replace />;

  const register = async (courseOfferingId: number) => {
    setBusyId(courseOfferingId);
    try {
      await api.post('/api/academic/my-registration', { course_offering_id: courseOfferingId });
      toast.success('Course registered.');
      await load();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'Could not register this course.'));
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

  const windowStatus = reg?.window || 'Closed';
  const extension = reg?.extension;
  const paidExtension = extension?.status === 'paid';
  const canMutate = !!reg?.can_self_register;
  const blockReason = !canMutate
    ? (reg?.cannot_register_reason || 'Add and drop are unavailable until course registration opens for you.')
    : null;
  const enrollments = [...(reg?.enrollments || [])].sort((a: any, b: any) => Number(!!b.is_carry_over) - Number(!!a.is_carry_over));
  const availableGroups = groupByBucket(reg?.available || []);
  const enrolledGroups = groupByBucket(enrollments);
  const termLabel = reg?.term?.name ? `${reg.term.session_label || ''} ${reg.term.name}`.trim() : 'Current semester';

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Course registration' }]} />
        <PageHeader title="Course registration" description="Add or drop courses for the current semester." />
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
              <Alert tone="info">Registration is open. Add or drop courses until the normal window closes.</Alert>
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[...COURSE_BUCKETS, { value: 'overall', label: 'Overall' }].map((bucket) => {
                const limit = reg.limits?.[bucket.value] || {};
                const used = reg.units?.[bucket.value] ?? 0;
                return (
                  <div key={bucket.value} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">{bucket.label}</p>
                    <p className="font-semibold text-slate-800">{used} / {limit.max ?? '—'} units</p>
                    <p className="text-xs text-slate-500">Min {limit.min ?? '—'}{limit.grace ? ` · grace +${limit.grace}` : ''}</p>
                  </div>
                );
              })}
            </div>

            {(reg.carry_overs || []).length > 0 && (
              <div>
                <h3 className="font-medium text-slate-800 mb-1">Required carry-overs</h3>
                <ul className="divide-y divide-slate-100">
                  {reg.carry_overs.map((row: any) => (
                    <li key={row.id} className="py-2 flex justify-between gap-3">
                      <span>{row.offering?.course?.code} {row.offering?.course?.title} ({row.offering?.course?.units} units)</span>
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
                            {row.offering?.course?.code} {row.offering?.course?.title} ({row.offering?.course?.units} units)
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
              <h3 className="font-medium text-slate-800 mb-1">Available</h3>
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
                    {group.rows.map((row: any) => (
                      <li key={row.id} className="py-2 flex justify-between gap-3 items-center">
                        <span>
                          {row.course?.code} {row.course?.title} ({row.course?.units} units)
                          {row.course?.status ? ` · ${courseStatusLabel(row.course.status)}` : ''}
                          {' · '}{row.unlimited || row.capacity == null ? 'Unlimited seats' : `${row.seats_left} seats`}
                        </span>
                        <Button
                          type="button"
                          disabled={!canMutate || busyId !== null}
                          title={blockReason || undefined}
                          className="bg-sky-600 hover:bg-sky-700 text-white"
                          onClick={() => register(row.id)}
                        >
                          {busyId === row.id ? 'Adding…' : 'Register'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
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
