import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { Breadcrumb, PageHeader } from '../components/portal';
import { useToast } from '../components/toast';
import { Button, Card, Input, Label, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';

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

const APPOINTMENT_REASONS = [
  { value: 'consultation', label: 'General consultation' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'nhis_enrolment', label: 'NHIS enrolment' },
  { value: 'immunization', label: 'Immunization' },
  { value: 'other', label: 'Other' },
];

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const isoDate = String(value).slice(0, 10);
  const parts = isoDate.split('-');
  if (parts.length === 3 && parts.every((part) => /^\d+$/.test(part))) {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function display(value?: string | number | null) {
  if (value == null || value === '') return '—';
  return String(value);
}

function titleCase(value?: string | null) {
  if (!value) return '—';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status?: string): 'success' | 'warning' | 'info' | 'neutral' {
  const value = String(status || '').toLowerCase();
  if (['paid', 'completed', 'enrolled', 'dispensed', 'scheduled'].includes(value)) return 'success';
  if (['in_progress', 'open'].includes(value)) return 'info';
  if (['waiting', 'pending', 'unpaid', 'partial', 'not enrolled', 'rejected'].includes(value)) return 'warning';
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

function CrossIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 4v16M4 12h16" strokeLinecap="round" />
    </svg>
  );
}

export default function Clinic() {
  const { auth } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [date, setDate] = useState(todayInputValue());
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [reason, setReason] = useState('consultation');
  const [complaint, setComplaint] = useState('');
  const [bookOpen, setBookOpen] = useState(false);

  const load = () => {
    setLoading(true);
    return api.get('/api/me/clinic')
      .then((r) => setData(r.data))
      .catch(() => toast.error('Could not load your clinic record.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!auth?.is_student) return;
    load();
  }, [auth?.is_student]);

  useEffect(() => {
    if (!bookOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !booking) setBookOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [bookOpen, booking]);

  if (!auth?.is_student) return <Navigate to="/" replace />;

  const printNote = async (id: number) => {
    setPrintLoading(true);
    try {
      const { data: html } = await api.get(`/api/clinic/sick-notes/${id}/print`, { responseType: 'text' });
      setPrintHtml(typeof html === 'string' ? html : String(html));
    } catch {
      toast.error('Could not open sick note.');
    } finally {
      setPrintLoading(false);
    }
  };

  const bookAppointment = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || booking) return;
    setBooking(true);
    try {
      await api.post('/api/me/clinic/appointments', {
        scheduled_at: `${date} ${hour}:${minute}:00`,
        reason,
        complaint: complaint.trim() || null,
      });
      toast.success('Request submitted. Clinic staff must approve it before the visit is confirmed.');
      setComplaint('');
      setBookOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.errors?.scheduled_at?.[0] || 'Could not book appointment.');
    } finally {
      setBooking(false);
    }
  };

  const cancelAppointment = async (id: number) => {
    setCancellingId(id);
    try {
      await api.post(`/api/me/clinic/appointments/${id}/cancel`);
      toast.success('Appointment cancelled.');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not cancel appointment.');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Spinner label="Loading clinic record…" />
      </div>
    );
  }

  const profile = data?.profile;
  const nhis = !!profile?.nhis_enrolled;
  const visits = data?.visits || [];
  const immunizations = data?.immunizations || [];
  const invoices = data?.invoices || [];
  const sickNotes = data?.sick_notes || [];
  const coverage = Number(data?.effective_coverage_percent ?? data?.settings?.nhis_default_coverage_percent ?? 0);
  const outstanding = invoices
    .filter((inv: any) => ['unpaid', 'partial'].includes(String(inv.status || '')))
    .reduce((sum: number, inv: any) => sum + Number(inv.balance ?? inv.amount ?? 0), 0);
  const latestVisit = visits[0];
  const upcoming = visits.filter((visit: any) => (
    visit.visit_type === 'appointment'
    && ['pending', 'scheduled', 'waiting', 'in_progress'].includes(String(visit.status || ''))
  ));
  const openAppointment = upcoming[0] || null;
  const selectClass = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 bg-white shadow-sm shadow-slate-100/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition';

  const snapshot = [
    { label: 'Blood type', value: profile?.blood_type || '—' },
    { label: 'Genotype', value: profile?.genotype || '—' },
    { label: 'NHIS', value: nhis ? 'Enrolled' : 'Not enrolled' },
    { label: 'Outstanding', value: formatNaira(outstanding) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Clinic' }]} />
        <PageHeader
          title="My clinic"
          description="Request a clinic appointment (staff must approve it), then view your health profile, visits, sick notes, and medical invoices."
          action={
            !openAppointment ? (
              <Button
                type="button"
                onClick={() => setBookOpen(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
              >
                Book appointment
              </Button>
            ) : undefined
          }
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-5 py-6 sm:px-7 sm:py-8 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.28),transparent_42%)]" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="mx-auto sm:mx-0 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-400/20 text-teal-100 ring-4 ring-white/10">
              <CrossIcon />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                <StatusPill value={nhis ? 'enrolled' : 'not enrolled'} />
                {latestVisit && <StatusPill value={latestVisit.status} />}
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Campus clinic</h2>
              <p className="mt-1.5 text-sm text-slate-200">
                {nhis
                  ? `NHIS covers ${coverage}% of eligible clinic charges.`
                  : 'Clinic charges are billed in full to your campus wallet.'}
              </p>
              {latestVisit && (
                <p className="mt-2 text-xs text-teal-100/90">
                  Last visit {formatDate(latestVisit.visited_on)}
                  {latestVisit.complaint ? ` · ${latestVisit.complaint}` : ''}
                </p>
              )}
              {!openAppointment && (
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={() => setBookOpen(true)}
                    className="bg-white text-slate-900 hover:bg-slate-100 shadow-sm"
                  >
                    Book appointment
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

      {openAppointment && (
        <Section
          title="Upcoming appointment"
          description={
            openAppointment.status === 'pending'
              ? 'Waiting for clinic staff to approve this request. You can cancel and book again.'
              : openAppointment.status === 'scheduled'
                ? 'Confirmed. Come to the clinic at this time. Cancel if you cannot attend.'
                : 'You are on the clinic queue for this visit.'
          }
        >
          <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-sky-950">{formatDateTime(openAppointment.scheduled_at || openAppointment.visited_on)}</p>
              <p className="text-sm text-sky-800/80 mt-1">{openAppointment.complaint || 'Clinic appointment'}</p>
              <div className="mt-2"><StatusPill value={openAppointment.status} /></div>
            </div>
            {['pending', 'scheduled'].includes(String(openAppointment.status)) && (
              <Button
                type="button"
                onClick={() => cancelAppointment(openAppointment.id)}
                disabled={cancellingId === openAppointment.id}
                className="shrink-0 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                {cancellingId === openAppointment.id ? <Spinner label="Cancelling…" /> : 'Cancel'}
              </Button>
            )}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Section title="Health profile" description="Medical details on your clinic file.">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Blood type" value={display(profile?.blood_type)} />
            <Field label="Genotype" value={display(profile?.genotype)} />
            <div className="sm:col-span-2">
              <Field label="Allergies" value={display(profile?.allergies)} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Conditions" value={display(profile?.conditions)} />
            </div>
          </dl>
        </Section>

        <Section title="NHIS" description="National Health Insurance coverage for clinic bills.">
          {nhis ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Coverage</p>
                <p className="mt-1 text-3xl font-semibold text-emerald-800">{coverage}%</p>
                <p className="mt-1 text-sm text-emerald-800/80">
                  {profile.nhis_coverage_percent == null ? 'Campus default rate' : 'Personal coverage override'}
                </p>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="NHIS number" value={display(profile.nhis_number)} />
                <Field label="Provider" value={display(profile.nhis_provider)} />
                <div className="sm:col-span-2">
                  <Field label="Valid until" value={profile.nhis_valid_until ? formatDate(profile.nhis_valid_until) : '—'} />
                </div>
              </dl>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-4">
              <p className="text-sm font-medium text-amber-900">Not enrolled on NHIS</p>
              <p className="text-sm text-amber-800/80 mt-1">
                Clinic charges are billed in full. Book an appointment and choose <span className="font-medium">NHIS enrolment</span> as the reason, then bring your NHIS details to the clinic.
              </p>
            </div>
          )}
        </Section>
      </div>

      <Section title="Clinic visits" description="Consultations and treatment on your campus clinic record.">
        {visits.length === 0 ? (
          <EmptyState message="No clinic visits yet." />
        ) : (
          <ul className="space-y-3">
            {visits.map((visit: any) => (
              <li key={visit.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {visit.scheduled_at ? formatDateTime(visit.scheduled_at) : formatDate(visit.visited_on)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 capitalize">{titleCase(visit.visit_type)}</p>
                  </div>
                  <StatusPill value={visit.status} />
                </div>
                <p className="mt-3 text-sm text-slate-700">{visit.complaint || 'No complaint recorded.'}</p>
                {visit.diagnosis && (
                  <p className="mt-1.5 text-sm text-slate-500">Diagnosis: <span className="font-medium text-slate-800">{visit.diagnosis}</span></p>
                )}
                {visit.bill && (
                  <p className="mt-2 text-sm text-slate-600">
                    Payable {formatNaira(visit.bill.student_payable_amount ?? visit.bill.amount)}
                    <span className="text-slate-400"> · </span>
                    <span className="capitalize">{visit.bill.status}</span>
                    {visit.bill.nhis_applied ? ` · NHIS covered ${formatNaira(visit.bill.nhis_covered_amount)}` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Section title="Immunizations" description="Vaccines recorded by the campus clinic.">
          {immunizations.length === 0 ? (
            <EmptyState message="No immunizations recorded." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {immunizations.map((row: any) => (
                <li key={row.id} className="py-3 flex items-start justify-between gap-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-slate-900">{row.vaccine}</p>
                  <p className="text-xs font-medium text-slate-500 shrink-0">{formatDate(row.given_on)}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Sick notes" description="Excuse notes issued after a clinic visit.">
          {sickNotes.length === 0 ? (
            <EmptyState message="No sick notes issued." />
          ) : (
            <ul className="space-y-3">
              {sickNotes.map((note: any) => (
                <li key={note.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {formatDate(note.valid_from)} → {formatDate(note.valid_to)}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{note.reason || 'No reason recorded.'}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => printNote(note.id)}
                    disabled={printLoading}
                    className="shrink-0 bg-sky-600 hover:bg-sky-700 text-white shadow-sm text-xs px-3 py-1.5"
                  >
                    {printLoading ? <Spinner label="Opening…" className="text-white" /> : 'View / print'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="Clinic invoices"
        description="Medical charges billed to your campus wallet."
        action={
          <Link to="/invoices" className="text-sm font-medium text-sky-600 hover:text-sky-700 shrink-0">
            Transaction history
          </Link>
        }
      >
        {invoices.length === 0 ? (
          <EmptyState message="No medical invoices." />
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
      </Section>

      {bookOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60"
          onClick={() => !booking && setBookOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-appointment-title"
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 id="book-appointment-title" className="font-semibold text-slate-900">Book an appointment</h3>
                <p className="text-sm text-slate-500 mt-0.5">Choose a date and time. Clinic staff must approve the request before your visit is confirmed.</p>
              </div>
              <button
                type="button"
                onClick={() => !booking && setBookOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <form onSubmit={bookAppointment} className="p-5 space-y-4">
              <div>
                <Label htmlFor="clinic-date">Date</Label>
                <Input
                  id="clinic-date"
                  type="date"
                  min={todayInputValue()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-1.5">Time</span>
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <div>
                    <Label htmlFor="clinic-hour">Hour</Label>
                    <select id="clinic-hour" className={selectClass} value={hour} onChange={(e) => setHour(e.target.value)} required>
                      {Array.from({ length: 24 }, (_, i) => {
                        const value = String(i).padStart(2, '0');
                        return <option key={value} value={value}>{value}</option>;
                      })}
                    </select>
                  </div>
                  <span className="pb-2.5 text-lg font-semibold text-slate-400" aria-hidden>:</span>
                  <div>
                    <Label htmlFor="clinic-minute">Minute</Label>
                    <select id="clinic-minute" className={selectClass} value={minute} onChange={(e) => setMinute(e.target.value)} required>
                      {Array.from({ length: 60 }, (_, i) => {
                        const value = String(i).padStart(2, '0');
                        return <option key={value} value={value}>{value}</option>;
                      })}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="clinic-reason">Reason</Label>
                <select id="clinic-reason" className={selectClass} value={reason} onChange={(e) => setReason(e.target.value)} required>
                  {APPOINTMENT_REASONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="clinic-complaint">Details (optional)</Label>
                <textarea
                  id="clinic-complaint"
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Symptoms, NHIS number, or anything the nurse should know"
                  className={`${selectClass} min-h-[5.5rem]`}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button
                  type="button"
                  onClick={() => setBookOpen(false)}
                  disabled={booking}
                  className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={booking}
                  className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                >
                  {booking ? <Spinner label="Submitting…" className="text-white" /> : 'Submit request'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {(printLoading || printHtml) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => !printLoading && setPrintHtml(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Sick note"
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50">
              <h3 className="font-semibold text-slate-900">Sick note</h3>
              <div className="flex items-center gap-2 shrink-0">
                {printHtml && (
                  <button
                    type="button"
                    onClick={() => {
                      const frame = document.getElementById('student-sick-note-frame') as HTMLIFrameElement | null;
                      frame?.contentWindow?.print();
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Print
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPrintHtml(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-slate-100">
              {printLoading || !printHtml ? (
                <div className="flex items-center justify-center py-24 text-slate-500">
                  <Spinner label="Loading sick note…" />
                </div>
              ) : (
                <iframe
                  id="student-sick-note-frame"
                  title="Sick note"
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
