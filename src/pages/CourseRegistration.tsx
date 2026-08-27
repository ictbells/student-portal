import { useEffect, useRef, useState } from 'react';
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

function courseStatusLabel(value?: string) {
  if (value === 'elective') return 'Elective';
  if (value === 'required') return 'Required';
  if (value === 'core') return 'Core';
  return value || '';
}

function isCarryOverRow(row: any) {
  return Boolean(row?.is_carry_over);
}

function isDefaultSelected(row: any) {
  if (isCarryOverRow(row)) return true;
  const status = String(row?.course?.status || 'core').toLowerCase();
  return status === 'core' || status === 'required';
}

function defaultSelectedIds(rows: any[]) {
  return rows.filter(isDefaultSelected).map((row: any) => row.id);
}

function printTermKey(term: { academic_session_id?: number | null; session_label?: string }) {
  return String(term.academic_session_id ?? term.session_label ?? '');
}

const selectClass = 'min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800';

function courseUnits(row: any) {
  return Number(row?.course?.units || row?.offering?.course?.units || 0);
}

function courseBucket(row: any): 'general' | 'faculty' | 'departmental' {
  const value = row?.bucket || row?.course?.course_type || row?.offering?.course?.course_type || 'departmental';
  if (value === 'general' || value === 'faculty') return value;
  return 'departmental';
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
  let data = e?.response?.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      if (data.trim()) return fallback;
    }
  }
  const errors = data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find((v) => typeof v === 'string');
    if (typeof first === 'string') return first;
  }
  return data?.message || fallback;
}

const thClass = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap bg-slate-50';
const tdClass = 'px-3 py-2 text-sm text-slate-800 align-middle';
const trClass = 'border-t border-slate-100';

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
  const [printLoading, setPrintLoading] = useState(false);
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printTermId, setPrintTermId] = useState<number | undefined>();
  const printRequestRef = useRef(0);

  const pickPrintTermId = (data: any, previous?: number) => {
    const terms = Array.isArray(data?.print_terms) ? data.print_terms : [];
    if (previous && terms.some((term: any) => term.id === previous)) return previous;
    const currentId = data?.term?.id;
    return terms.find((term: any) => term.id === currentId)?.id ?? terms[0]?.id;
  };

  const load = () => {
    setLoading(true);
    return api.get('/api/academic/my-registration')
      .then((r) => {
        setReg(r.data);
        setSelectedIds(defaultSelectedIds(r.data?.available || []));
        setPrintTermId((current) => pickPrintTermId(r.data, current));
      })
      .catch(() => setReg(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!auth?.is_student) return;
    load();
  }, [auth?.is_student]);

  useEffect(() => {
    if (!printOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePrint();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [printOpen]);

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
        setPrintTermId((current) => pickPrintTermId(data, current));
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
    if (isCarryOverRow(row)) return;
    setSelectedIds((current) => (
      current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]
    ));
  };

  const fetchPrint = async (termId: number) => {
    const requestId = ++printRequestRef.current;
    setPrintLoading(true);
    try {
      const { data } = await api.get('/api/academic/my-registration/print', {
        params: { academic_term_id: termId },
        responseType: 'text',
      });
      if (requestId !== printRequestRef.current) return;
      setPrintHtml(data);
    } catch (e: any) {
      if (requestId !== printRequestRef.current) return;
      toast.error(apiErrorMessage(e, 'Could not open the course registration printout.'));
    } finally {
      if (requestId === printRequestRef.current) setPrintLoading(false);
    }
  };

  const openPrint = (termId?: number) => {
    const id = typeof termId === 'number' && Number.isFinite(termId) ? termId : printTermId;
    if (!id) {
      toast.error('Choose the session and semester to print.');
      return;
    }
    setPrintTermId(id);
    setPrintOpen(true);
    void fetchPrint(id);
  };

  const closePrint = () => {
    setPrintOpen(false);
    setPrintHtml(null);
  };

  const printCurrent = () => {
    const frame = document.getElementById('registration-print-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const downloadCurrent = () => {
    if (!printHtml) return;
    const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const session = String(selectedPrintTerm?.session_label || 'session').replaceAll('/', '-');
    const semester = String(selectedPrintTerm?.name || 'semester').replaceAll(' ', '-').toLowerCase();
    a.download = `course-registration-${session}-${semester}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const windowStatus = reg?.window || 'Closed';
  const extension = reg?.extension;
  const paidExtension = extension?.status === 'paid';
  const canMutate = !!reg?.can_self_register;
  const blockReason = !canMutate
    ? (reg?.cannot_register_reason || 'Add and drop are unavailable until course registration opens for you.')
    : null;
  const enrollments = [...(reg?.enrollments || [])].sort((a: any, b: any) => {
    const carry = Number(!!b.is_carry_over) - Number(!!a.is_carry_over);
    if (carry !== 0) return carry;
    return String(a.offering?.course?.code || '').localeCompare(String(b.offering?.course?.code || ''));
  });
  const available = [...(reg?.available || [])].sort((a: any, b: any) => (
    String(a.course?.code || '').localeCompare(String(b.course?.code || ''))
  ));
  const termLabel = reg?.term?.name ? `${reg.term.session_label || ''} ${reg.term.name}`.trim() : 'Current semester';
  const selectedRows = available.filter((row: any) => selectedIds.includes(row.id));
  const projectedUnits = addSelectionUnits(reg?.units || {}, selectedRows);
  const submitting = busyId === 'register';
  const printTerms = Array.isArray(reg?.print_terms) ? reg.print_terms : [];
  const printSessions: { key: string; label: string }[] = [];
  const seenSessions = new Set<string>();
  for (const term of printTerms) {
    const key = printTermKey(term);
    if (!key || seenSessions.has(key)) continue;
    seenSessions.add(key);
    printSessions.push({ key, label: term.session_label || 'Session' });
  }
  const selectedPrintTerm = printTerms.find((term: any) => term.id === printTermId) || printTerms[0];
  const selectedPrintSessionKey = selectedPrintTerm ? printTermKey(selectedPrintTerm) : '';
  const printSemesters = printTerms.filter((term: any) => printTermKey(term) === selectedPrintSessionKey);
  const canPrint = printTerms.length > 0 && !!printTermId;

  const onPrintSessionChange = (key: string, reload = false) => {
    const terms = printTerms.filter((term: any) => printTermKey(term) === key);
    const preferred = terms.find((term: any) => term.id === printTermId)
      ?? terms.find((term: any) => term.is_current)
      ?? terms[0];
    if (!preferred) return;
    setPrintTermId(preferred.id);
    if (reload) void fetchPrint(preferred.id);
  };

  const onPrintSemesterChange = (id: number, reload = false) => {
    setPrintTermId(id);
    if (reload) void fetchPrint(id);
  };

  const printTermSelects = (idPrefix: string, reload: boolean) => (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-session`}>Session</Label>
        <select
          id={`${idPrefix}-session`}
          className={selectClass}
          value={selectedPrintSessionKey}
          onChange={(e) => onPrintSessionChange(e.target.value, reload)}
          disabled={printLoading || busyId !== null}
        >
          {printSessions.map((session) => (
            <option key={session.key} value={session.key}>{session.label}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-semester`}>Semester</Label>
        <select
          id={`${idPrefix}-semester`}
          className={selectClass}
          value={printTermId ?? ''}
          onChange={(e) => onPrintSemesterChange(Number(e.target.value), reload)}
          disabled={printLoading || busyId !== null}
        >
          {printSemesters.map((term: any) => (
            <option key={term.id} value={term.id}>{term.name}{term.is_current ? ' (current)' : ''}</option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Course registration' }]} />
        <PageHeader
          title="Course registration"
          description="Tick the courses you will take this semester, check your unit totals, then submit once. Print a copy of your registered courses for any session or semester you have already registered."
          action={(
            <div className="flex flex-wrap gap-2">
              {canPrint && (
                <Button
                  type="button"
                  disabled={printLoading || busyId !== null}
                  className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => openPrint()}
                >
                  {printLoading ? 'Preparing…' : 'Print registered courses'}
                </Button>
              )}
              {canMutate && available.length > 0 ? (
                <Button
                  type="button"
                  disabled={submitting || selectedIds.length === 0 || busyId !== null}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                  onClick={registerSelected}
                >
                  {submitting ? 'Registering…' : `Register ${selectedIds.length} course${selectedIds.length === 1 ? '' : 's'}`}
                </Button>
              ) : null}
            </div>
          )}
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
              <Alert tone="warning">Carry-over courses are already on your registered list and cannot be dropped.</Alert>
            )}

            <div>
              <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
                <h3 className="font-medium text-slate-800">Registered courses</h3>
                {canPrint && (
                  <div className="flex flex-wrap items-end gap-2">
                    {printTermSelects('print', false)}
                    <Button
                      type="button"
                      disabled={printLoading || busyId !== null}
                      className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={() => openPrint()}
                    >
                      {printLoading ? 'Preparing…' : 'Print'}
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className={thClass}>Code</th>
                      <th className={thClass}>Title</th>
                      <th className={thClass}>Status</th>
                      <th className={`${thClass} text-center`}>Units</th>
                      <th className={thClass}>Note</th>
                      {canMutate && <th className={`${thClass} text-right`}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.length === 0 ? (
                      <tr className={trClass}>
                        <td className={`${tdClass} text-slate-500`} colSpan={canMutate ? 6 : 5}>
                          No courses registered this semester.
                        </td>
                      </tr>
                    ) : enrollments.map((row: any) => {
                      const dropBlocked = !canMutate || row.is_carry_over;
                      const course = row.offering?.course;
                      return (
                        <tr key={row.id} className={trClass}>
                          <td className={`${tdClass} font-medium whitespace-nowrap`}>{course?.code || '—'}</td>
                          <td className={tdClass}>{course?.title || '—'}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{courseStatusLabel(course?.status) || '—'}</td>
                          <td className={`${tdClass} text-center`}>{course?.units ?? 0}</td>
                          <td className={tdClass}>
                            {row.is_carry_over ? <span className="text-xs font-medium text-amber-700">Carry-over · cannot drop</span> : '—'}
                          </td>
                          {canMutate && (
                            <td className={`${tdClass} text-right`}>
                              <Button
                                type="button"
                                disabled={dropBlocked || busyId !== null}
                                title={row.is_carry_over ? 'Carry-over courses cannot be dropped.' : (blockReason || undefined)}
                                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                                onClick={() => drop(row.id)}
                              >
                                {busyId === `drop-${row.id}` ? 'Dropping…' : 'Drop'}
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
                <h3 className="font-medium text-slate-800">Available courses</h3>
                <p className="text-xs text-slate-500">{selectedIds.length} selected</p>
              </div>
              {paidExtension && extension?.approved_units != null && (
                <p className="text-xs text-slate-500 mb-2">Your paid extension caps this load at {extension.approved_units} units.</p>
              )}
              {blockReason && (
                <p className="text-xs text-amber-800 mb-2">{blockReason} Register stays disabled until this is resolved.</p>
              )}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      {canMutate && <th className={`${thClass} w-10`}><span className="sr-only">Select</span></th>}
                      <th className={thClass}>Code</th>
                      <th className={thClass}>Title</th>
                      <th className={thClass}>Status</th>
                      <th className={`${thClass} text-center`}>Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {available.length === 0 ? (
                      <tr className={trClass}>
                        <td className={`${tdClass} text-slate-500`} colSpan={canMutate ? 5 : 4}>
                          No offerings are available for you this semester.
                        </td>
                      </tr>
                    ) : available.map((row: any) => {
                      const checked = selectedIds.includes(row.id);
                      const locked = isCarryOverRow(row);
                      return (
                        <tr key={row.id} className={trClass}>
                          {canMutate && (
                            <td className={tdClass}>
                              <input
                                type="checkbox"
                                aria-label={`Select ${row.course?.code || 'course'}`}
                                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={checked}
                                disabled={busyId !== null || locked}
                                onChange={() => toggleCourse(row)}
                              />
                            </td>
                          )}
                          <td className={`${tdClass} font-medium whitespace-nowrap`}>{row.course?.code || '—'}</td>
                          <td className={tdClass}>
                            {row.course?.title || '—'}
                            {locked ? <span className="block text-[11px] text-amber-700">Carry-over · cannot uncheck</span> : null}
                          </td>
                          <td className={`${tdClass} whitespace-nowrap`}>{courseStatusLabel(row.course?.status) || '—'}</td>
                          <td className={`${tdClass} text-center`}>{row.course?.units ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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

      {printOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => !printLoading && closePrint()}
          role="dialog"
          aria-modal="true"
          aria-label="Course registration printout"
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Document</p>
                <h3 className="font-semibold text-slate-900 truncate">Course registration</h3>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {printTermSelects('print-modal', true)}
                {printHtml && (
                  <>
                    <button type="button" onClick={printCurrent} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Print
                    </button>
                    <button type="button" onClick={downloadCurrent} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Download
                    </button>
                  </>
                )}
                <button type="button" onClick={closePrint} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-slate-100">
              {printLoading || !printHtml ? (
                <div className="flex items-center justify-center py-24 text-slate-500">
                  <Spinner label="Loading document…" />
                </div>
              ) : (
                <iframe
                  id="registration-print-frame"
                  title="Course registration"
                  srcDoc={printHtml}
                  className="w-full h-[min(70vh,720px)] border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
