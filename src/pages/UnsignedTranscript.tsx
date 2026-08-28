import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { Breadcrumb, PageHeader } from '../components/portal';
import { useToast } from '../components/toast';
import { Alert, Button, Card, Label, Spinner } from '../components/ui';

const selectClass = 'w-full min-w-0 sm:w-auto sm:min-w-[12rem] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800';
const thClass = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap bg-slate-50';
const tdClass = 'px-3 py-2 text-sm text-slate-800 align-middle';

type SessionOption = {
  id: number;
  label?: string | null;
  is_current?: boolean;
  terms?: TermOption[];
};

type TermOption = {
  id: number;
  name?: string | null;
  is_current?: boolean;
};

type CourseRow = {
  enrollment_id: number;
  result_status?: string;
  pending?: boolean;
  letter?: string | null;
  points?: number | null;
  score?: number | string | null;
  ca_score?: number | string | null;
  exam_score?: number | string | null;
  is_carry_over?: boolean;
  course?: { code?: string; title?: string; units?: number } | null;
};

type TermBlock = {
  academic_term_id: number;
  academic_session_id?: number | null;
  name?: string | null;
  session_label?: string | null;
  gpa?: number | null;
  units_registered?: number;
  rows?: CourseRow[];
};

type UnsignedPayload = {
  notice?: string;
  sessions?: SessionOption[];
  terms?: TermBlock[];
  gpa?: number | null;
  units_registered?: number;
  total_credits?: number;
};

function formatGpa(value: unknown): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : String(value);
}

function formatScore(value: unknown): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

function pickDefaults(sessions: SessionOption[]) {
  const currentSession = sessions.find((session) => session.is_current) || sessions[sessions.length - 1];
  const terms = currentSession?.terms || [];
  const currentTerm = terms.find((term) => term.is_current) || terms[terms.length - 1];
  return {
    sessionId: currentSession?.id,
    termId: currentTerm?.id,
  };
}

function scopeGpa(terms: TermBlock[]): number | null {
  let quality = 0;
  let credits = 0;
  for (const term of terms) {
    for (const row of term.rows || []) {
      if (row.result_status !== 'released') continue;
      const units = Number(row.course?.units || 0);
      const points = Number(row.points);
      if (units <= 0 || !Number.isFinite(points)) continue;
      quality += points * units;
      credits += units;
    }
  }
  return credits > 0 ? quality / credits : null;
}

export default function UnsignedTranscript() {
  const { auth } = useAuth();
  const toast = useToast();
  const [payload, setPayload] = useState<UnsignedPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [termId, setTermId] = useState<number | undefined | 'all'>('all');
  const [printOpen, setPrintOpen] = useState(false);
  const [printHtml, setPrintHtml] = useState('');
  const [printLoading, setPrintLoading] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);

  useEffect(() => {
    if (!auth?.is_student) return;
    setLoading(true);
    api.get('/api/academic/unsigned-transcript')
      .then((r) => {
        const data = r.data as UnsignedPayload;
        setPayload(data);
        const defaults = pickDefaults(data.sessions || []);
        setSessionId(defaults.sessionId);
        setTermId(defaults.termId ?? 'all');
      })
      .catch(() => setPayload(null))
      .finally(() => setLoading(false));
  }, [auth?.is_student]);

  const sessions = payload?.sessions || [];
  const selectedSession = sessions.find((session) => session.id === sessionId);
  const sessionTerms = selectedSession?.terms || [];

  const visibleTerms = useMemo(() => {
    const terms = (payload?.terms || []).filter((term) => {
      if (sessionId && term.academic_session_id !== sessionId) return false;
      if (termId !== 'all' && termId && term.academic_term_id !== termId) return false;
      return true;
    });
    return terms;
  }, [payload?.terms, sessionId, termId]);

  const unitsRegistered = visibleTerms.reduce((sum, term) => sum + Number(term.units_registered || 0), 0);
  const gpa = scopeGpa(visibleTerms);

  const printParams = () => {
    const params: Record<string, number> = {};
    if (termId !== 'all' && typeof termId === 'number') {
      params.academic_term_id = termId;
    } else if (sessionId) {
      params.academic_session_id = sessionId;
    }
    return params;
  };

  const openPrint = async (shouldPrint = false) => {
    if (!sessionId && (payload?.terms || []).length > 0) {
      toast.error('Choose a session to view or print.');
      return;
    }
    setAutoPrint(shouldPrint);
    setPrintLoading(true);
    setPrintOpen(true);
    setPrintHtml('');
    try {
      const { data } = await api.get('/api/academic/unsigned-transcript', {
        params: { ...printParams(), format: 'html' },
        responseType: 'text',
        headers: { Accept: 'text/html' },
      });
      setPrintHtml(typeof data === 'string' ? data : String(data));
    } catch {
      toast.error('Could not open the unsigned transcript.');
      setPrintOpen(false);
      setAutoPrint(false);
    } finally {
      setPrintLoading(false);
    }
  };

  const printCurrent = () => {
    const frame = document.getElementById('unsigned-transcript-print-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  useEffect(() => {
    if (!autoPrint || printLoading || !printHtml || !printOpen) return;
    const timer = window.setTimeout(() => printCurrent(), 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint, printLoading, printHtml, printOpen]);

  if (!auth?.is_student) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Academic', to: '/academic' }, { label: 'Unsigned transcript' }]} />
        <PageHeader
          title="Unsigned transcript"
          description="Registered courses and released scores for a session or semester. This copy is not signed."
          action={(
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                onClick={() => openPrint(false)}
                disabled={loading || visibleTerms.length === 0}
                className="bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                View
              </Button>
              <Button
                type="button"
                onClick={() => openPrint(true)}
                disabled={loading || visibleTerms.length === 0}
                className="bg-sky-600 text-white hover:bg-sky-700"
              >
                Print
              </Button>
            </div>
          )}
        />
      </div>

      <Alert tone="warning">
        {payload?.notice || 'Unsigned transcript for viewing only. Official signed copies are issued by the Registry.'}
        {' '}
        <Link to="/transcript-request" className="font-medium text-amber-950 underline underline-offset-2">
          Request an official transcript
        </Link>
      </Alert>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:flex-none">
            <Label htmlFor="unsigned-session">Session</Label>
            <select
              id="unsigned-session"
              className={selectClass}
              value={sessionId ?? ''}
              onChange={(e) => {
                const next = Number(e.target.value) || undefined;
                setSessionId(next);
                const nextSession = sessions.find((session) => session.id === next);
                const nextTerms = nextSession?.terms || [];
                const keep = termId !== 'all' && nextTerms.some((term) => term.id === termId);
                setTermId(keep ? termId : (nextTerms.find((term) => term.is_current)?.id ?? nextTerms[0]?.id ?? 'all'));
              }}
              disabled={loading || sessions.length === 0}
            >
              {sessions.length === 0 && <option value="">No registered sessions</option>}
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>{session.label || `Session ${session.id}`}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 sm:flex-none">
            <Label htmlFor="unsigned-semester">Semester</Label>
            <select
              id="unsigned-semester"
              className={selectClass}
              value={termId === 'all' ? 'all' : (termId ?? 'all')}
              onChange={(e) => setTermId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              disabled={loading || !sessionId}
            >
              <option value="all">All semesters</option>
              {sessionTerms.map((term) => (
                <option key={term.id} value={term.id}>{term.name || `Term ${term.id}`}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">GPA</p>
          <p className="text-2xl font-semibold text-sky-700 mt-1">{formatGpa(gpa)}</p>
          <p className="text-xs text-slate-500 mt-1">From released results in this view</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Units registered</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{unitsRegistered || '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Units with results</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">
            {visibleTerms.reduce((sum, term) => (
              sum + (term.rows || []).filter((row) => row.result_status === 'released').reduce((inner, row) => inner + Number(row.course?.units || 0), 0)
            ), 0) || '—'}
          </p>
        </div>
      </div>

      {loading && (
        <Card>
          <Spinner label="Loading registered courses…" />
        </Card>
      )}

      {!loading && visibleTerms.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500">No registered courses for this session/semester.</p>
        </Card>
      )}

      {visibleTerms.map((term) => (
        <Card key={term.academic_term_id} className="overflow-hidden p-0 sm:p-0">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-6">
            <div>
              <h2 className="font-semibold text-slate-900">{term.session_label} · {term.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{term.units_registered || 0} units registered</p>
            </div>
            <p className="text-sm font-medium text-slate-700">GPA {formatGpa(term.gpa)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className={thClass}>Code</th>
                  <th className={thClass}>Title</th>
                  <th className={thClass}>Units</th>
                  <th className={thClass}>CA</th>
                  <th className={thClass}>Exam</th>
                  <th className={thClass}>Score</th>
                  <th className={thClass}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {(term.rows || []).map((row) => {
                  const released = row.result_status === 'released';
                  return (
                    <tr key={row.enrollment_id} className="border-t border-slate-100">
                      <td className={`${tdClass} font-medium whitespace-nowrap`}>{row.course?.code || '—'}</td>
                      <td className={tdClass}>
                        {row.course?.title || '—'}
                        {row.is_carry_over && <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-amber-700">Carry-over</span>}
                      </td>
                      <td className={tdClass}>{row.course?.units ?? '—'}</td>
                      <td className={tdClass}>{released ? formatScore(row.ca_score) : '—'}</td>
                      <td className={tdClass}>{released ? formatScore(row.exam_score) : '—'}</td>
                      <td className={tdClass}>{released ? formatScore(row.score) : 'Pending'}</td>
                      <td className={`${tdClass} font-medium`}>{released ? (row.letter || '—') : 'Pending'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {printOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
          onClick={() => { setPrintOpen(false); setAutoPrint(false); }}
        >
          <div
            className="w-full max-w-3xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Unsigned</p>
                <h3 className="font-semibold text-slate-900 truncate">Registered courses and scores</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!printLoading && printHtml && (
                  <button type="button" onClick={printCurrent} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Print
                  </button>
                )}
                <button type="button" onClick={() => { setPrintOpen(false); setAutoPrint(false); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
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
                  id="unsigned-transcript-print-frame"
                  title="Unsigned transcript"
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
