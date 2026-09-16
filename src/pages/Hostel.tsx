import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { Breadcrumb, PageHeader } from '../components/portal';
import { useToast } from '../components/toast';
import { Alert, Button, Card, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';
import { studentLevelLabel } from '../lib/studentLevel';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function titleCase(value?: string | null) {
  if (!value) return '—';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status?: string): 'success' | 'warning' | 'info' | 'neutral' {
  const value = String(status || '').toLowerCase();
  if (['paid', 'allocated', 'open', 'enrolled'].includes(value)) return 'success';
  if (['unpaid', 'partial', 'closed', 'vacated'].includes(value)) return 'warning';
  if (['pending'].includes(value)) return 'info';
  return 'neutral';
}

function StatusPill({ value }: { value?: string | null }) {
  const label = titleCase(value || 'Unknown');
  const tone = statusTone(value || undefined);
  const tones = {
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-800 ring-amber-200',
    info: 'bg-sky-50 text-sky-800 ring-sky-200',
    neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 capitalize ${tones[tone]}`}>
      {label}
    </span>
  );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900 break-words">{value == null || value === '' ? '—' : value}</dd>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function apiErrorMessage(e: any, fallback: string) {
  let data = e?.response?.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return fallback;
    }
  }
  return data?.message || data?.errors?.allocation?.[0] || fallback;
}

function BuildingIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 21h18M6 21V8l6-4 6 4v13M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const selectClass = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 bg-white shadow-sm shadow-slate-100/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';

export default function Hostel() {
  const { auth } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectOpen, setSelectOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [pickedBed, setPickedBed] = useState<{ id: number; label: string; room: string; hostel: string } | null>(null);
  const [selectedHostelId, setSelectedHostelId] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const printRequestRef = useRef(0);

  const load = () => {
    setLoading(true);
    return api.get('/api/me/hostel')
      .then((r) => setData(r.data))
      .catch(() => toast.error('Could not load your hostel record.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!auth?.is_student) return;
    load();
  }, [auth?.is_student]);

  useEffect(() => {
    if (!selectOpen && !printOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (printOpen && !printLoading) closePrint();
      else if (selectOpen && !selecting) closeSelectModal();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [selectOpen, selecting, printOpen, printLoading]);

  const hostels = data?.hostels || [];
  const selectedHostel = hostels.find((hostel: any) => hostel.id === selectedHostelId) || null;
  const blocks = selectedHostel?.blocks || [];
  const selectedBlock = blocks.find((block: any) => block.id === selectedBlockId) || null;
  const rooms = selectedBlock?.rooms || [];
  const selectedRoom = rooms.find((room: any) => room.id === selectedRoomId) || null;

  const openSelectModal = () => {
    setPickedBed(null);
    setSelectedHostelId(null);
    setSelectedBlockId(null);
    setSelectedRoomId(null);
    setSelectOpen(true);
  };

  const closeSelectModal = () => {
    if (selecting) return;
    setSelectOpen(false);
    setPickedBed(null);
    setSelectedHostelId(null);
    setSelectedBlockId(null);
    setSelectedRoomId(null);
  };

  const fetchPrint = async () => {
    const requestId = ++printRequestRef.current;
    setPrintLoading(true);
    try {
      const { data } = await api.get('/api/me/hostel/print', { responseType: 'text' });
      if (requestId !== printRequestRef.current) return;
      setPrintHtml(data);
    } catch (e: any) {
      if (requestId !== printRequestRef.current) return;
      toast.error(apiErrorMessage(e, 'Could not open the hostel registration form.'));
      setPrintOpen(false);
    } finally {
      if (requestId === printRequestRef.current) setPrintLoading(false);
    }
  };

  const openPrint = () => {
    setPrintOpen(true);
    void fetchPrint();
  };

  const closePrint = () => {
    if (printLoading) return;
    setPrintOpen(false);
    setPrintHtml(null);
  };

  const printCurrent = () => {
    const frame = document.getElementById('hostel-print-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const downloadCurrent = () => {
    if (!printHtml) return;
    const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hostel-registration.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!auth?.is_student) return <Navigate to="/" replace />;

  const selectBed = async () => {
    if (!pickedBed || selecting) return;
    setSelecting(true);
    try {
      const { data: next } = await api.post('/api/me/hostel/select', { hostel_bed_id: pickedBed.id });
      setData(next);
      setSelectOpen(false);
      setPickedBed(null);
      toast.success('Bed request submitted. Staff must approve it before the bed is allocated.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.errors?.hostel_bed_id?.[0] || 'Could not submit that bed request.');
    } finally {
      setSelecting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Spinner label="Loading hostel record…" />
      </div>
    );
  }

  const allocation = data?.allocation;
  const history = data?.history || [];
  const invoices = data?.invoices || [];
  const canSelect = !!data?.can_select;
  const canPrint = ['allocated', 'pending'].includes(String(allocation?.status || ''));
  const windowOpen = !!data?.window_open;
  const tuitionOk = data?.tuition_ok !== false;
  const tuitionPercent = Number(data?.tuition_percent ?? 0);
  const window = data?.window;
  const outstanding = invoices
    .filter((inv: any) => ['unpaid', 'partial'].includes(String(inv.status || '')))
    .reduce((sum: number, inv: any) => sum + Number(inv.balance ?? inv.amount ?? 0), 0);

  const snapshot = [
    { label: 'Status', value: allocation ? titleCase(allocation.status) : 'Not allocated' },
    { label: 'Hostel', value: allocation?.hostel_name || '—' },
    { label: 'Room', value: allocation ? `${allocation.block_name || '—'} · ${allocation.room_number || '—'}` : '—' },
    { label: 'Bed', value: allocation?.bed_label || '—' },
  ];

  let windowMessage = 'Hostel selection is not open for your level yet.';
  if (allocation?.status === 'pending') {
    windowMessage = 'Your bed request is waiting for staff approval.';
  } else if (allocation) {
    windowMessage = 'You already have a hostel bed for this session.';
  } else if (windowOpen && !tuitionOk) {
    windowMessage = 'Selection is open. Pay at least 25% of current-session tuition before requesting a bed.';
  } else if (windowOpen) {
    windowMessage = window?.closes_at
      ? `Selection is open until ${formatDateTime(window.closes_at)}.`
      : 'Selection is open until staff close this level.';
  } else if (window?.opens_at && new Date(window.opens_at).getTime() > Date.now()) {
    windowMessage = `Selection opens on ${formatDateTime(window.opens_at)}.`;
  } else if (window?.closes_at && new Date(window.closes_at).getTime() < Date.now()) {
    windowMessage = `Selection closed on ${formatDateTime(window.closes_at)}.`;
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Hostel' }]} />
        <PageHeader
          title="My hostel"
          description="View your room allocation, print your hostel registration form, request a bed when the window is open, and track hostel invoices."
          action={
            (canSelect || canPrint) ? (
              <div className="flex flex-col sm:flex-row gap-2">
                {canPrint && (
                  <Button
                    type="button"
                    onClick={openPrint}
                    className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                  >
                    Print registration form
                  </Button>
                )}
                {canSelect && (
                  <Button
                    type="button"
                    onClick={openSelectModal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    Request a bed
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-5 py-6 sm:px-7 sm:py-8 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.28),transparent_42%)]" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="mx-auto sm:mx-0 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-400/20 text-indigo-100 ring-4 ring-white/10">
              <BuildingIcon />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                <StatusPill value={allocation ? allocation.status : 'not allocated'} />
                <StatusPill value={windowOpen ? 'open' : 'closed'} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Campus hostel</h2>
              <p className="mt-1.5 text-sm text-slate-200">{windowMessage}</p>
              {windowOpen && !tuitionOk && !allocation && (
                <p className="mt-2 text-xs text-amber-100">
                  Tuition paid: {tuitionPercent}% of the current session. Pay from{' '}
                  <Link to="/invoices" className="underline text-white">invoices</Link>.
                </p>
              )}
              {allocation && (
                <p className="mt-2 text-xs text-indigo-100/90">
                  {allocation.hostel_name} · Block {allocation.block_name || '—'} · Room {allocation.room_number || '—'} · Bed {allocation.bed_label || '—'}
                </p>
              )}
              {canPrint && (
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={openPrint}
                    className="w-full sm:w-auto bg-white text-slate-900 hover:bg-slate-100 shadow-sm"
                  >
                    Print registration form
                  </Button>
                </div>
              )}
              {canSelect && (
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={openSelectModal}
                    className="w-full sm:w-auto bg-white text-slate-900 hover:bg-slate-100 shadow-sm"
                  >
                    Request a bed
                  </Button>
                </div>
              )}
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

      {windowOpen && !tuitionOk && !allocation && (
        <Alert tone="warning">
          Pay at least 25% of current-session tuition before requesting a hostel bed.{' '}
          You have paid {Number.isFinite(tuitionPercent) ? tuitionPercent : 0}%.{' '}
          <Link to="/invoices" className="text-sky-700 underline">Open invoices</Link>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Section
          title="Current allocation"
          description={allocation?.status === 'pending' ? 'This bed is reserved until staff approve or reject your request.' : 'Your room and bed for this session.'}
          action={
            canPrint ? (
              <Button
                type="button"
                onClick={openPrint}
                className="text-sky-700 hover:text-sky-800 bg-transparent px-0 min-h-0 py-0"
              >
                Print form
              </Button>
            ) : undefined
          }
        >
          {allocation ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Hostel" value={allocation.hostel_name} />
              <Field label="Category" value={titleCase(allocation.hostel_category)} />
              <Field label="Block" value={allocation.block_name} />
              <Field label="Room" value={allocation.room_number} />
              <Field label="Bed" value={allocation.bed_label} />
              <Field label={allocation.status === 'pending' ? 'Requested' : 'Allocated'} value={formatDate(allocation.allocated_at)} />
              {allocation.term && <Field label="Term" value={allocation.term} />}
              {allocation.session && <Field label="Session" value={allocation.session} />}
            </dl>
          ) : (
            <EmptyState message={canSelect ? 'No bed yet. Select one while the window is open.' : (windowOpen && !tuitionOk ? 'Pay at least 25% of current-session tuition to request a bed.' : 'No hostel bed has been assigned yet.')} />
          )}
        </Section>

        <Section title="Selection window" description="Hostel officers open this by category and level. Opening a level lets you request a bed now. Last session’s room is kept in history so you can choose again for this level.">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Your level" value={data?.level_label || studentLevelLabel(auth?.user?.student) || (data?.level ? `${data.level}L` : '—')} />
            <Field label="Category" value={titleCase(data?.category)} />
            <Field label="Window" value={windowOpen ? 'Open' : 'Closed'} />
            <Field label="Tuition paid" value={`${Number.isFinite(tuitionPercent) ? tuitionPercent : 0}% · ${tuitionOk ? 'eligible' : 'need 25%'}`} />
            <Field label="Scheduled open" value={formatDateTime(window?.opens_at)} />
            <Field label="Scheduled close" value={formatDateTime(window?.closes_at)} />
            <Field label="Hostel fee" value={
              allocation?.due_required && Number(allocation.due_amount) > 0
                ? (allocation.status === 'pending'
                  ? `${formatNaira(allocation.due_amount)} invoiced after approval`
                  : formatNaira(allocation.due_amount))
                : 'Covered in tuition'
            } />
          </dl>
        </Section>
      </div>

      <Section title="Allocation history" description="Previous hostel beds on your record.">
        {history.length === 0 ? (
          <EmptyState message="No hostel history yet." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((row: any) => (
              <li key={row.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {row.hostel_name || 'Hostel'} · Room {row.room_number || '—'} · Bed {row.bed_label || '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDate(row.allocated_at)}
                    {row.vacated_at ? ` → ${formatDate(row.vacated_at)}` : ''}
                  </p>
                </div>
                <StatusPill value={row.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Hostel invoices"
        description="Hostel charges billed to your campus wallet."
        action={
          <Link to="/invoices" className="text-sm font-medium text-sky-600 hover:text-sky-700 shrink-0">
            Transaction history
          </Link>
        }
      >
        {invoices.length === 0 ? (
          <EmptyState message="No hostel invoices. Hostel is included in tuition unless a due was charged." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {invoices.map((inv: any) => (
              <li key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 first:pt-0 last:pb-0">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-900">{inv.number}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Balance {formatNaira(inv.balance ?? inv.amount)}</p>
                </div>
                <StatusPill value={inv.status} />
              </li>
            ))}
          </ul>
        )}
        {outstanding > 0 && (
          <p className="text-sm text-amber-800">Outstanding hostel balance {formatNaira(outstanding)}. Pay from your wallet.</p>
        )}
      </Section>

      {selectOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60"
          onClick={closeSelectModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="select-bed-title"
        >
          <div
            className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
              <div>
                <h3 id="select-bed-title" className="font-semibold text-slate-900">Select a hostel bed</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Choose a hostel assigned to your level, then a block. Only rooms for your level appear in the grid; occupied rooms are greyed out.
                  For bunk rooms, pick a free Lower or Upper bunk. Staff must approve your request before the bed is allocated.
                  {selectedHostel
                    ? (selectedHostel.due_required && Number(selectedHostel.due_amount) > 0
                      ? ` A hostel due of ${formatNaira(selectedHostel.due_amount)} will be invoiced only after staff approve.`
                      : ' Hostel is covered in tuition; no separate hostel invoice will be raised.')
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSelectModal}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-5">
              <div>
                <label htmlFor="hostel-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">1. Hostel</label>
                {hostels.length === 0 ? (
                  <EmptyState message="No hostels have rooms assigned to your level." />
                ) : (
                  <select
                    id="hostel-select"
                    className={selectClass}
                    value={selectedHostelId ?? ''}
                    onChange={(e) => {
                      setSelectedHostelId(e.target.value ? Number(e.target.value) : null);
                      setSelectedBlockId(null);
                      setSelectedRoomId(null);
                      setPickedBed(null);
                    }}
                  >
                    <option value="">Select a hostel</option>
                    {hostels.map((hostel: any) => (
                      <option key={hostel.id} value={hostel.id}>
                        {hostel.name}{hostel.gender ? ` · ${titleCase(hostel.gender)}` : ''}
                        {typeof hostel.available_rooms === 'number' ? ` · ${hostel.available_rooms} free room${hostel.available_rooms === 1 ? '' : 's'}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="block-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">2. Block</label>
                <select
                  id="block-select"
                  className={selectClass}
                  value={selectedBlockId ?? ''}
                  disabled={!selectedHostel || blocks.length === 0}
                  onChange={(e) => {
                    setSelectedBlockId(e.target.value ? Number(e.target.value) : null);
                    setSelectedRoomId(null);
                    setPickedBed(null);
                  }}
                >
                  <option value="">
                    {!selectedHostel ? 'Select a hostel first' : blocks.length === 0 ? 'No blocks in this hostel' : 'Select a block'}
                  </option>
                  {blocks.map((block: any) => (
                    <option key={block.id} value={block.id}>
                      {block.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBlock && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">3. Rooms in {selectedBlock.name}</p>
                    <p className="text-[11px] text-slate-400">Occupied rooms are greyed out</p>
                  </div>
                  {rooms.length === 0 ? (
                    <EmptyState message="This block has no rooms for your level." />
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {rooms.map((room: any) => {
                        const occupied = !room.selectable;
                        const selected = selectedRoomId === room.id;
                        const code = room.code || room.number;
                        const bunkHint = room.uses_bunks
                          ? (room.available_bunk_summary?.text || `${room.available_beds || 0} free`)
                          : null;
                        const typeLabel = room.room_type_label || titleCase(room.room_type || 'standard');
                        const freeHint = occupied
                          ? (room.disabled_reason || 'Occupied')
                          : [typeLabel, bunkHint].filter(Boolean).join(' · ');
                        return (
                          <button
                            key={room.id}
                            type="button"
                            disabled={occupied}
                            title={occupied ? (room.disabled_reason || 'Occupied') : `Room ${code} · ${freeHint}`}
                            onClick={() => {
                              if (occupied) return;
                              setSelectedRoomId(room.id);
                              setPickedBed(null);
                            }}
                            className={`min-h-[4.25rem] rounded-lg border px-2 py-2.5 text-sm font-semibold tabular-nums transition ${
                              selected
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200'
                                : occupied
                                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed grayscale'
                                  : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/40'
                            }`}
                          >
                            <span className="block">{code}</span>
                            <span className={`block mt-0.5 text-[10px] font-medium normal-case tracking-normal ${occupied ? 'text-slate-400' : 'text-slate-500'}`}>
                              {typeLabel}
                              {room.uses_bunks && !occupied ? ` · ${room.available_beds ?? 0} free` : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {selectedRoom && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    4. {selectedRoom.uses_bunks ? 'Bunk' : 'Bed'} in {selectedRoom.code || selectedRoom.number}
                    {selectedRoom.room_type_label || selectedRoom.room_type
                      ? ` · ${selectedRoom.room_type_label || titleCase(selectedRoom.room_type)}`
                      : ''}
                  </p>
                  {selectedRoom.uses_bunks && selectedRoom.available_bunk_summary?.text && (
                    <p className="text-xs text-slate-600 mb-2">{selectedRoom.available_bunk_summary.text}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(selectedRoom.beds || []).map((bed: any) => {
                      const bedTaken = bed.status !== 'available';
                      const selected = pickedBed?.id === bed.id;
                      const label = bed.display_label || (bed.bunk_position
                        ? `${bed.bunk_position === 'lower' ? 'Lower' : 'Upper'} bunk${bed.bunk_pair ? ` ${bed.bunk_pair}` : ''}`
                        : `Bed ${bed.label}`);
                      return (
                        <button
                          key={bed.id}
                          type="button"
                          disabled={bedTaken}
                          onClick={() => !bedTaken && setPickedBed({
                            id: bed.id,
                            label,
                            room: selectedRoom.code || selectedRoom.number,
                            hostel: selectedHostel?.name || '',
                          })}
                          className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                            selected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                              : bedTaken
                                ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {label}{bedTaken ? ' · taken' : ' · free'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1 pb-[max(0px,env(safe-area-inset-bottom))]">
                <Button
                  type="button"
                  onClick={closeSelectModal}
                  disabled={selecting}
                  className="w-full sm:w-auto border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={selecting || !pickedBed}
                  onClick={selectBed}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  {selecting ? <Spinner label="Submitting…" className="text-white" /> : pickedBed ? `Request bed ${pickedBed.label}` : 'Request bed'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {printOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => !printLoading && closePrint()}
          role="dialog"
          aria-modal="true"
          aria-label="Hostel registration form"
        >
          <div
            className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Document</p>
                <h3 className="font-semibold text-slate-900 truncate">Hostel registration form</h3>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
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
                  id="hostel-print-frame"
                  title="Hostel registration form"
                  srcDoc={printHtml}
                  className="w-full h-[min(60dvh,720px)] sm:h-[min(70vh,720px)] border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
