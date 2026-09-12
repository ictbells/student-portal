import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { PageHeader } from '../components/portal';
import { Alert, Spinner } from '../components/ui';
import { useToast } from '../components/toast';
import { formatNaira } from '../lib/money';
import { studentLevelLabel } from '../lib/studentLevel';

type InvoiceItem = {
  id?: number;
  description?: string;
  amount?: number;
};

type Charge = {
  id: string | number;
  title: string;
  session: string | null;
  level: string | null;
  arrears: boolean;
  amount: number;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusLabel(status?: string) {
  if (status === 'cancelled' || status === 'disabled') return 'Disabled';
  return String(status || 'unknown').replaceAll('_', ' ');
}

function asRows(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function parseCharge(item: InvoiceItem, index: number): Charge {
  const raw = String(item.description || 'Charge').trim();
  const arrears = /\barrears\b/i.test(raw);
  const session = raw.match(/(\d{4}\/\d{4})/)?.[1] || null;
  const levelMatch = raw.match(/(\d+)\s*level/i) || raw.match(/(\d+)L\b/i);
  const level = levelMatch ? `${levelMatch[1]}L` : null;
  const title = raw
    .replace(/\(\s*\d{4}\/\d{4}[^)]*\)/g, '')
    .replace(/\b\d{4}\/\d{4}\b/g, '')
    .replace(/\b\d+\s*level\b/gi, '')
    .replace(/\barrears\b/gi, '')
    .replace(/[·•|]+/g, ' ')
    .replace(/\(\s*[,;.\s]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[·,.\-–]+\s*$/g, '')
    .trim() || 'Charge';

  return {
    id: item.id ?? `${title}-${index}`,
    title,
    session,
    level,
    arrears,
    amount: Number(item.amount) || 0,
  };
}

function sumAmounts(rows: Charge[]) {
  return rows.reduce((total, row) => total + row.amount, 0);
}

function StatusChip({ status }: { status?: string }) {
  const key = String(status || '').toLowerCase();
  const styles: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    partial: 'bg-sky-50 text-sky-800 ring-sky-200',
    unpaid: 'bg-amber-50 text-amber-900 ring-amber-200',
    cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
    disabled: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${styles[key] || 'bg-slate-50 text-slate-700 ring-slate-200'}`}>
      {statusLabel(status)}
    </span>
  );
}

function WalletIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm16 0V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChargeList({ title, hint, rows, tone = 'default' }: { title: string; hint?: string; rows: Charge[]; tone?: 'default' | 'arrears' }) {
  if (!rows.length) return null;
  const isArrears = tone === 'arrears';
  return (
    <div className={`rounded-xl ring-1 ${isArrears ? 'bg-amber-50/70 ring-amber-100' : 'bg-slate-50/80 ring-slate-100'}`}>
      <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${isArrears ? 'text-amber-800' : 'text-slate-500'}`}>{title}</p>
          {hint ? <p className={`mt-0.5 text-xs ${isArrears ? 'text-amber-800/80' : 'text-slate-500'}`}>{hint}</p> : null}
        </div>
        <p className={`shrink-0 text-sm font-semibold tabular-nums ${isArrears ? 'text-amber-950' : 'text-slate-900'}`}>{formatNaira(sumAmounts(rows))}</p>
      </div>
      <ul className="divide-y divide-white/80">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-slate-800 leading-snug">{row.title}</p>
              {(row.session || row.level) ? (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {[row.session, row.level].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>
            <p className="shrink-0 text-sm tabular-nums text-slate-800">{formatNaira(row.amount)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InvoiceCard({
  row,
  onOpenReceipt,
}: {
  row: any;
  onOpenReceipt: (opts: { invoiceId?: number; paymentId?: number; receiptNo?: string }) => void;
}) {
  const charges = asRows(row.items).map((item, index) => parseCharge(item, index));
  const current = charges.filter((item) => !item.arrears);
  const arrears = charges.filter((item) => item.arrears);
  const arrearsHint = arrears.length
    ? [...new Set(arrears.flatMap((item) => [item.session, item.level].filter(Boolean)))].join(' · ')
    : undefined;
  const unpaid = ['unpaid', 'partial'].includes(String(row.status || '').toLowerCase());
  const [open, setOpen] = useState(unpaid && charges.length > 0);
  const billed = Number(row.amount) || 0;
  const paid = Number(row.amount_paid) || 0;
  const rebate = Number(row.rebate_total) || 0;
  const settled = Math.min(billed, paid + rebate);
  const progress = billed > 0 ? Math.min(100, Math.round((settled / billed) * 100)) : 0;
  const category = String(row.category || '').replaceAll('_', ' ');

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-slate-900">{row.number}</p>
            <p className="mt-1 text-sm capitalize text-slate-500">
              {category || 'Invoice'}
              {row.installment_percent ? ` · ${row.installment_percent}% installment` : ''}
            </p>
          </div>
          <StatusChip status={row.status} />
        </div>

        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-sky-500' : 'bg-amber-400'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">{progress}% settled</p>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Billed</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{formatNaira(row.amount)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Paid</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-emerald-700">{formatNaira(row.amount_paid ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Rebate</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{rebate > 0 ? formatNaira(rebate) : '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Balance</dt>
            <dd className={`mt-1 text-sm font-semibold tabular-nums ${Number(row.balance) > 0.009 ? 'text-amber-800' : 'text-emerald-700'}`}>
              {formatNaira(row.balance)}
            </dd>
          </div>
        </dl>

        {charges.length > 0 ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-900"
              aria-expanded={open}
            >
              {open ? 'Hide charges' : 'View charges'}
              <span className="font-normal text-slate-500">
                ({[
                  current.length ? `${current.length} current` : null,
                  arrears.length ? `${arrears.length} arrears` : null,
                ].filter(Boolean).join(' · ') || charges.length})
              </span>
            </button>
            {open ? (
              <div className="space-y-2.5">
                <ChargeList title="Current charges" rows={current} />
                <ChargeList
                  title="Arrears"
                  hint={arrearsHint ? `${arrearsHint} · carried forward` : 'Carried forward from a previous level'}
                  rows={arrears}
                  tone="arrears"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {unpaid ? (
            <Link
              to="/invoices"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
            >
              Pay this invoice
            </Link>
          ) : null}
          {asRows(row.payments).length > 0 || row.status === 'paid' ? (
            <button
              type="button"
              onClick={() => {
                const payment = asRows(row.payments)[0];
                onOpenReceipt({
                  paymentId: payment?.id,
                  invoiceId: row.id,
                  receiptNo: payment?.receipt_no || row.number,
                });
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View receipt
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function FinancialStatus() {
  const { auth } = useAuth();
  const toast = useToast();
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptTitle, setReceiptTitle] = useState('Receipt');
  const [receiptLoading, setReceiptLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get('/api/my-finance-status')
      .then((res) => setDetail(res.data))
      .catch((err) => {
        setDetail(null);
        setError(err.response?.data?.message || 'Could not load your financial status.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!receiptHtml) {
      setReceiptUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([receiptHtml], { type: 'text/html;charset=utf-8' }));
    setReceiptUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptHtml]);

  useEffect(() => {
    if (!receiptHtml && !receiptLoading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !receiptLoading) {
        setReceiptHtml(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [receiptHtml, receiptLoading]);

  const receiptErrorMessage = (err: any, fallback = 'Could not open receipt.') => {
    const data = err?.response?.data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message;
      } catch {
        // HTML or plain text
      }
    }
    if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    return fallback;
  };

  const fetchReceiptHtml = async (opts: { invoiceId?: number; paymentId?: number }) => {
    const { data } = opts.paymentId
      ? await api.get(`/api/payments/${opts.paymentId}/receipt`, { responseType: 'text' })
      : await api.get(`/api/invoices/${opts.invoiceId}/receipt`, { responseType: 'text' });
    return typeof data === 'string' ? data : String(data ?? '');
  };

  const openReceipt = async (opts: { invoiceId?: number; paymentId?: number; receiptNo?: string }) => {
    if (!opts.paymentId && !opts.invoiceId) return;
    setReceiptLoading(true);
    setReceiptHtml(null);
    const receiptNo = opts.receiptNo || opts.invoiceId || opts.paymentId;
    setReceiptTitle(`Receipt ${receiptNo}`);
    try {
      const html = await fetchReceiptHtml(opts);
      if (!html || html === '[object Object]') {
        throw new Error('Could not open receipt.');
      }
      setReceiptHtml(html);
    } catch (e: any) {
      setReceiptHtml(null);
      toast.error(receiptErrorMessage(e));
    } finally {
      setReceiptLoading(false);
    }
  };

  const printReceipt = () => {
    const frame = document.getElementById('finance-receipt-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const downloadReceipt = () => {
    if (!receiptHtml) return;
    const blob = new Blob([receiptHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${receiptTitle.replace(/\s+/g, '-').toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!auth?.is_student) {
    return (
      <Alert tone="info">
        Financial status is available after you are admitted as a student.{' '}
        <Link to="/invoices" className="text-sky-700 font-medium underline">View transaction history</Link>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Spinner label="Loading financial status…" />
      </div>
    );
  }

  if (error || !detail) {
    return <Alert tone="error">{error || 'Could not load your financial status.'}</Alert>;
  }

  const student = detail.student || {};
  const summary = detail.summary || {};
  const invoices = asRows(detail.invoices);
  const payments = asRows(detail.payments).length
    ? asRows(detail.payments)
    : invoices.flatMap((row: any) => asRows(row.payments));
  const ledger = asRows(detail.wallet_transactions).length
    ? asRows(detail.wallet_transactions)
    : asRows(detail.wallet?.transactions);
  const paymentTotal = payments.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
  const cleared = summary.clearance === 'cleared';
  const outstanding = Number(summary.outstanding) > 0.009;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees"
        title="Financial status"
        description={[student.matric_number || student.student_number, student.program, studentLevelLabel(student, '')].filter(Boolean).join(' · ') || 'Your bursary position: billed, paid, and outstanding.'}
      />

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-5 sm:p-8 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
              cleared
                ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/30'
                : 'bg-amber-400/15 text-amber-100 ring-amber-300/30'
            }`}>
              {cleared ? 'Cleared — school fees paid in full' : 'Outstanding — school fees not paid in full'}
            </span>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200/80">
              {cleared ? 'Balance due' : 'Amount outstanding'}
            </p>
            <p className="mt-2 text-3xl sm:text-5xl font-semibold tracking-tight tabular-nums break-words">
              {formatNaira(summary.outstanding)}
            </p>
            <p className="mt-3 text-sm text-slate-300 max-w-xl">
              {cleared
                ? 'Your bursary record is clear. Receipts stay available below.'
                : 'This includes current charges and any arrears carried forward. Pay from transaction history.'}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm self-start lg:self-end">
            <WalletIcon className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="relative mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-xs text-slate-300">
          <span>Billed {formatNaira(summary.billed)}</span>
          <span>Paid {formatNaira(summary.paid)}</span>
          <span>Wallet {formatNaira(summary.wallet_balance)}</span>
          {outstanding ? (
            <Link to="/invoices" className="ml-auto inline-flex min-h-9 items-center rounded-lg bg-white px-3.5 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100">
              Pay now
            </Link>
          ) : (
            <Link to="/invoices" className="ml-auto font-medium text-sky-200 hover:text-white transition">
              Transaction history →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <Stat label="Wallet" value={formatNaira(summary.wallet_balance)} tone="info" />
        <Stat label="Billed" value={formatNaira(summary.billed)} hint="School fees plus other invoices" />
        <Stat label="Rebated" value={formatNaira(summary.rebate_total)} />
        <Stat label="Paid" value={formatNaira(summary.paid)} tone="success" />
        <Stat
          label="Outstanding"
          value={formatNaira(summary.outstanding)}
          hint={cleared ? 'School fees paid in full' : 'Includes unpaid school fees'}
          tone={outstanding ? 'warning' : 'success'}
        />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Invoices</h2>
          <p className="text-sm text-slate-500 mt-0.5">Charges billed to you. Paid and balance are calculated from receipts.</p>
        </div>
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 sm:px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
            No invoices on this record.
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map((row: any) => (
              <InvoiceCard key={row.id} row={row} onOpenReceipt={openReceipt} />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Successful payments</h2>
            <p className="text-sm text-slate-500 mt-0.5">Receipts that settled these invoices.</p>
          </div>
          {payments.length === 0 ? (
            <p className="px-4 sm:px-5 py-8 text-sm text-slate-500">No successful invoice payments yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.map((row: any) => (
                <li key={row.id} className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{row.receipt_no || row.reference || 'Receipt'}</p>
                    <p className="mt-0.5 text-xs text-slate-500 capitalize">
                      {[String(row.method || '').replaceAll('_', ' '), row.purpose ? String(row.purpose).replaceAll('_', ' ') : null, formatDate(row.created_at)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-emerald-700">{formatNaira(row.amount)}</p>
                    {row.id || row.invoice_id ? (
                      <button
                        type="button"
                        onClick={() => openReceipt({
                          paymentId: row.id,
                          invoiceId: row.invoice_id,
                          receiptNo: row.receipt_no || row.reference,
                        })}
                        className="mt-1 text-xs font-medium text-sky-700 hover:underline"
                      >
                        View
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 bg-slate-50 px-4 sm:px-5 py-3 text-sm font-semibold">
                <span>Total paid</span>
                <span className="tabular-nums">{formatNaira(paymentTotal)}</span>
              </li>
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Wallet ledger</h2>
            <p className="text-sm text-slate-500 mt-0.5">Credits and charges on the campus wallet.</p>
          </div>
          {ledger.length === 0 ? (
            <p className="px-4 sm:px-5 py-8 text-sm text-slate-500">No wallet transactions yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ledger.map((row: any) => {
                const credit = String(row.type || '').toLowerCase() === 'credit';
                return (
                  <li key={row.id} className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 capitalize">{row.type || 'Movement'}</p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">{row.description || row.reference || formatDate(row.created_at)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold tabular-nums ${credit ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {credit ? '+' : '−'}{formatNaira(row.amount)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{formatDate(row.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {(receiptLoading || receiptHtml) && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50"
          onClick={() => !receiptLoading && setReceiptHtml(null)}
          role="dialog"
          aria-modal="true"
          aria-label={receiptTitle}
        >
          <div
            className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-sky-900/20 px-4 py-3 bg-[#0c4a6e] text-white">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-sky-200">Official Receipt</p>
                <h3 className="font-semibold truncate">{receiptTitle}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {receiptHtml && (
                  <>
                    <button type="button" onClick={printReceipt} className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">Print</button>
                    <button type="button" onClick={downloadReceipt} className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">Download</button>
                  </>
                )}
                <button type="button" onClick={() => { setReceiptHtml(null); setReceiptLoading(false); }} disabled={receiptLoading} className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">Close</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-[#e8eef3]">
              {receiptLoading || !receiptUrl ? (
                <div className="flex items-center justify-center py-24 text-slate-500">
                  <Spinner label="Loading receipt…" />
                </div>
              ) : (
                <iframe
                  id="finance-receipt-frame"
                  title={receiptTitle}
                  src={receiptUrl}
                  className="block w-full h-[min(78vh,900px)] border-0 bg-[#e8eef3]"
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

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'info';
}) {
  const tones = {
    default: 'border-slate-200/80 bg-white',
    success: 'border-emerald-100 bg-emerald-50/70',
    warning: 'border-amber-100 bg-amber-50/70',
    info: 'border-sky-100 bg-sky-50/70',
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums break-words">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500 leading-relaxed">{hint}</p> : null}
    </div>
  );
}
