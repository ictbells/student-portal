import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { PageHeader } from '../components/portal';
import { Alert, Card, Spinner } from '../components/ui';
import { useToast } from '../components/toast';
import { formatNaira } from '../lib/money';

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

export default function FinancialStatus() {
  const { auth } = useAuth();
  const toast = useToast();
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
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

  const openReceipt = async (opts: { invoiceId?: number; paymentId?: number; receiptNo?: string }) => {
    setReceiptLoading(true);
    setReceiptHtml(null);
    const receiptNo = opts.receiptNo || opts.invoiceId || opts.paymentId;
    setReceiptTitle(`Receipt ${receiptNo}`);
    try {
      const { data } = opts.paymentId
        ? await api.get(`/api/payments/${opts.paymentId}/receipt`, { responseType: 'text' })
        : await api.get(`/api/invoices/${opts.invoiceId}/receipt`, { responseType: 'text' });
      setReceiptHtml(data);
    } catch (e: any) {
      setReceiptHtml(null);
      toast.error(e.response?.data?.message || 'Could not open receipt.');
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees"
        title="Financial status"
        description={[student.matric_number || student.student_number, student.program, student.current_level ? `${student.current_level}L` : null].filter(Boolean).join(' · ') || 'Your bursary position: billed, paid, and outstanding.'}
      />

      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
        summary.clearance === 'cleared'
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-amber-50 text-amber-800 ring-amber-200'
      }`}>
        {summary.clearance === 'cleared' ? 'Cleared — 100% of school fees paid' : 'Outstanding — school fees not paid in full'}
      </span>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <Stat label="Wallet" value={formatNaira(summary.wallet_balance)} />
        <Stat label="Billed" value={formatNaira(summary.billed)} hint="100% school fees plus other invoices" />
        <Stat label="Rebated" value={formatNaira(summary.rebate_total)} />
        <Stat label="Paid" value={formatNaira(summary.paid)} />
        <Stat label="Outstanding" value={formatNaira(summary.outstanding)} hint={summary.clearance === 'cleared' ? 'School fees paid in full' : 'Includes unpaid school fees'} warning={Number(summary.outstanding) > 0.009} />
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Invoices</h2>
          <p className="text-sm text-slate-500 mt-0.5">Charges billed to you. Paid and balance are calculated from receipts.</p>
        </div>
        {invoices.length === 0 ? (
          <p className="px-4 sm:px-6 py-8 text-sm text-slate-500">No invoices on this record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Billed</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Rebate</th>
                  <th className="px-4 py-3 font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((row: any) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 font-medium font-mono text-slate-900">
                      {row.number}
                      {asRows(row.items).length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-xs font-sans font-normal text-slate-500">
                          {asRows(row.items).map((item: any) => (
                            <li key={item.id || item.description} className="flex justify-between gap-3">
                              <span>{item.description}</span>
                              <span className="whitespace-nowrap">{formatNaira(item.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-700">
                      {String(row.category || '').replaceAll('_', ' ')}
                      {row.installment_percent ? (
                        <div className="text-xs text-slate-500">{row.installment_percent}% installment</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{formatNaira(row.amount)}</td>
                    <td className="px-4 py-3">{formatNaira(row.amount_paid ?? 0)}</td>
                    <td className="px-4 py-3">{Number(row.rebate_total) > 0 ? formatNaira(row.rebate_total) : '—'}</td>
                    <td className="px-4 py-3">{formatNaira(row.balance)}</td>
                    <td className="px-4 py-3 capitalize">{statusLabel(row.status)}</td>
                    <td className="px-4 py-3 text-right">
                      {row.status === 'paid' ? (
                        <button
                          type="button"
                          onClick={() => openReceipt({ invoiceId: row.id, receiptNo: row.payments?.[0]?.receipt_no || row.number })}
                          className="text-xs font-medium text-sky-700 hover:underline"
                        >
                          View
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Successful payments</h2>
            <p className="text-sm text-slate-500 mt-0.5">Receipts that settled these invoices. Wallet top-ups are in the wallet ledger.</p>
          </div>
          {payments.length === 0 ? (
            <p className="px-4 sm:px-6 py-8 text-sm text-slate-500">No successful invoice payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((row: any) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.receipt_no || row.reference || '—'}</div>
                        {row.purpose ? <div className="text-xs text-slate-500 capitalize">{String(row.purpose).replaceAll('_', ' ')}</div> : null}
                      </td>
                      <td className="px-4 py-3 capitalize">{String(row.method || '—').replaceAll('_', ' ')}</td>
                      <td className="px-4 py-3">{formatNaira(row.amount)}</td>
                      <td className="px-4 py-3">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {row.invoice_id || row.id ? (
                          <button
                            type="button"
                            onClick={() => openReceipt(
                              row.invoice_id
                                ? { invoiceId: row.invoice_id, receiptNo: row.receipt_no || row.reference }
                                : { paymentId: row.id, receiptNo: row.receipt_no || row.reference },
                            )}
                            className="text-xs font-medium text-sky-700 hover:underline"
                          >
                            View
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 font-semibold" colSpan={2}>Total (matches Paid)</td>
                    <td className="px-4 py-3 font-semibold">{formatNaira(paymentTotal)}</td>
                    <td className="px-4 py-3" colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="!p-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Wallet ledger</h2>
            <p className="text-sm text-slate-500 mt-0.5">Credits and charges on the campus wallet.</p>
          </div>
          {ledger.length === 0 ? (
            <p className="px-4 sm:px-6 py-8 text-sm text-slate-500">No wallet transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.map((row: any) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 capitalize">{row.type}</td>
                      <td className="px-4 py-3">{row.description || row.reference || '—'}</td>
                      <td className="px-4 py-3">{formatNaira(row.amount)}</td>
                      <td className="px-4 py-3">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {(receiptLoading || receiptHtml) && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-[1px]"
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
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-sky-200">Official bursary receipt</p>
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
            <div className="flex-1 min-h-[60vh] bg-slate-100">
              {receiptLoading || !receiptHtml ? (
                <div className="flex items-center justify-center h-full text-slate-500"><Spinner label="Loading receipt…" /></div>
              ) : (
                <iframe id="finance-receipt-frame" title={receiptTitle} srcDoc={receiptHtml} className="w-full h-full border-0 bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, warning }: { label: string; value: string; hint?: string; warning?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${warning ? 'border-amber-100 bg-amber-50/60' : 'border-slate-200/80 bg-white'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
