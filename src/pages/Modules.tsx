import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { DocumentPreviewThumb } from '../components/DocumentPreviewThumb';
import { Breadcrumb, PageHeader } from '../components/portal';
import { useToast } from '../components/toast';
import { Alert, Button, Card, Input, Label, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';
import { hasPendingAdmissionOffer, openOfferPrompt } from '../lib/offer';

const WALLET_QUICK_AMOUNTS = [5000, 10000, 20000, 50000];
const ONLINE_FEE_CATEGORIES = ['application_fee', 'acceptance_fee', 'transcript'];
const TUITION_INSTALLMENT_OPTIONS = [
  { value: 25, label: '25% — 1st installment' },
  { value: 50, label: '50% — 2nd installment' },
  { value: 75, label: '75% — 3rd installment' },
  { value: 100, label: '100% — pay in full' },
] as const;

function isOnlineFee(category?: string) {
  return ONLINE_FEE_CATEGORIES.includes(String(category || ''));
}

function formatTxnDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function WalletIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm16 0V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.5" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const value = (status || 'unknown').toLowerCase();
  const tones: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    issued: 'bg-sky-50 text-sky-700 ring-sky-200',
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    unpaid: 'bg-amber-50 text-amber-700 ring-amber-200',
    partial: 'bg-amber-50 text-amber-700 ring-amber-200',
    cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
    rejected: 'bg-red-50 text-red-700 ring-red-200',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 capitalize ${tones[value] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
      {value === 'cancelled' ? 'Disabled' : (status || 'unknown')}
    </span>
  );
}

export function WalletPage() {
  const [w, setW] = useState<any>(null);
  const [amount, setAmount] = useState('5000');
  const [loading, setLoading] = useState(true);
  const [funding, setFunding] = useState(false);
  const [missing, setMissing] = useState(false);
  const { auth } = useAuth();
  const toast = useToast();

  const load = () => {
    setLoading(true);
    setMissing(false);
    return api.get('/api/wallet')
      .then((r) => {
        setW(r.data);
        setMissing(false);
      })
      .catch(() => {
        setW(null);
        setMissing(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (auth?.is_student) load();
  }, [auth?.is_student]);

  if (!auth?.is_student) return <Navigate to="/" replace />;

  if (loading && !w) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Spinner label="Loading wallet…" />
      </div>
    );
  }

  if (missing || !w) {
    return (
      <div className="space-y-6">
        <div>
          <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Wallet' }]} />
          <PageHeader
            eyebrow="Payments"
            title="Campus wallet"
            description="Your wallet opens after admission is accepted and a student record is created."
          />
        </div>
        <Card className="text-center py-10 sm:py-14">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
            <WalletIcon className="h-7 w-7" />
          </div>
          <p className="font-semibold text-slate-900">Wallet not ready yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Complete admission and acceptance fee payment. Your campus wallet will appear once your student record is created.
          </p>
        </Card>
      </div>
    );
  }

  const fund = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 100) {
      toast.error('Enter at least ₦100 to fund your wallet.');
      return;
    }
    setFunding(true);
    try {
      const { data } = await api.post('/api/wallet/topup', { amount: value, portal: 'student' });
      if (data.demo) {
        await api.get(`/api/payments/paystack/verify/${data.reference}`);
        toast.success('Wallet funded');
        await load();
      } else if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.error('Could not start wallet funding.');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not fund wallet.');
    } finally {
      setFunding(false);
    }
  };

  const transactions = w.transactions || [];
  const creditTotal = transactions
    .filter((t: any) => String(t.type).toLowerCase() === 'credit')
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
  const debitTotal = transactions
    .filter((t: any) => String(t.type).toLowerCase() === 'debit')
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
  const parsedAmount = Number(amount);
  const canFund = Number.isFinite(parsedAmount) && parsedAmount >= 100 && !funding && !loading;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Wallet' }]} />
        <PageHeader
          eyebrow="Payments"
          title="Campus wallet"
          description="Fund your wallet online, then pay school charges from it. Application and acceptance fees are paid online separately."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
        <div className="lg:col-span-3 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-6 sm:p-8 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200/80">Available balance</p>
              <p className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums">{formatNaira(w.balance)}</p>
              <p className="mt-3 text-sm text-slate-300">Use this balance to pay tuition and other school charges.</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
              <WalletIcon className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="relative mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Active
            </span>
            {auth?.current_session && (
              <span>
                {auth.current_session_kind === 'application' ? 'Application session' : 'Admission session'}{' '}
                {auth.current_session}
              </span>
            )}
            <Link to="/invoices" className="ml-auto font-medium text-sky-200 hover:text-white transition">
              Transaction history →
            </Link>
          </div>
        </div>

        <Card className="lg:col-span-2 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">Add funds</h2>
            <p className="text-sm text-slate-500 mt-0.5">Choose a preset or enter an amount.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {WALLET_QUICK_AMOUNTS.map((preset) => {
              const selected = Number(amount) === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  disabled={funding}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium tabular-nums transition ${
                    selected
                      ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-200 hover:bg-sky-50'
                  }`}
                >
                  {formatNaira(preset)}
                </button>
              );
            })}
          </div>
          <div>
            <Label htmlFor="wallet-amount">Amount (NGN)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-slate-500">₦</span>
              <Input
                id="wallet-amount"
                type="number"
                min={100}
                step="100"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 tabular-nums"
                disabled={funding}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Minimum top-up is ₦100.</p>
          </div>
          <Button
            onClick={fund}
            disabled={!canFund}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
          >
            {funding ? <Spinner label="Processing…" /> : 'Fund Wallet'}
          </Button>
          <p className="text-xs text-slate-500 leading-relaxed">
            Payments are processed securely. Credits appear in your ledger after confirmation.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Credits', value: formatNaira(creditTotal), hint: 'Money in', tone: 'success' },
          { label: 'Debits', value: formatNaira(debitTotal), hint: 'Money out', tone: 'warning' },
          { label: 'Transactions', value: String(transactions.length), hint: 'Last 25 shown', tone: 'info' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border p-4 shadow-sm ${
              stat.tone === 'warning' ? 'border-amber-100 bg-amber-50/60'
                : stat.tone === 'success' ? 'border-emerald-100 bg-emerald-50/60'
                  : 'border-sky-100 bg-sky-50/60'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-1.5 text-lg font-semibold text-slate-900 tabular-nums">{stat.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{stat.hint}</p>
          </div>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 sm:px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Recent transactions</h2>
            <p className="text-sm text-slate-500 mt-0.5">Credits, fee payments, and other wallet activity.</p>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div className="px-5 sm:px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-200">
              <WalletIcon className="h-6 w-6" />
            </div>
            <p className="font-medium text-slate-900">No transactions yet</p>
            <p className="text-sm text-slate-500 mt-1">Fund your wallet to see activity here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {transactions.map((t: any) => {
              const isCredit = String(t.type).toLowerCase() === 'credit';
              return (
                <li key={t.id} className="flex items-start gap-3 px-5 sm:px-6 py-3.5 hover:bg-slate-50/70">
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      isCredit ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                    }`}
                    aria-hidden
                  >
                    {isCredit ? '+' : '−'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">
                      {t.description || (isCredit ? 'Wallet credit' : 'Wallet debit')}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatTxnDate(t.created_at)}
                      {t.reference ? ` · ${t.reference}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold tabular-nums ${isCredit ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {isCredit ? '+' : '−'}{formatNaira(t.amount)}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                        isCredit ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.type || 'entry'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function Invoices() {
  const { auth } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const [receiptTitle, setReceiptTitle] = useState('Receipt');
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [installmentPercent, setInstallmentPercent] = useState(25);
  const [creatingTuition, setCreatingTuition] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [confirmInvoice, setConfirmInvoice] = useState<any | null>(null);
  const [feeSchedule, setFeeSchedule] = useState<{
    schedule_set: boolean;
    total_amount: number | null;
    tuition_percent_paid: number;
    available_installment_percents: number[];
    prior_unpaid_count: number;
    prior_unpaid_amount: number;
  } | null>(null);

  const loadFeeSchedule = () => {
    if (!auth?.is_student) {
      setFeeSchedule(null);
      return;
    }
    api.get('/api/my-programme-fees')
      .then((r) => setFeeSchedule({
        schedule_set: !!r.data.schedule_set,
        total_amount: r.data.total_amount != null ? Number(r.data.total_amount) : null,
        tuition_percent_paid: Number(r.data.tuition_percent_paid ?? 0),
        available_installment_percents: Array.isArray(r.data.available_installment_percents)
          ? r.data.available_installment_percents.map(Number)
          : TUITION_INSTALLMENT_OPTIONS.map((option) => option.value),
        prior_unpaid_count: Number(r.data.prior_unpaid_count ?? 0),
        prior_unpaid_amount: Number(r.data.prior_unpaid_amount ?? 0),
      }))
      .catch(() => setFeeSchedule({
        schedule_set: false,
        total_amount: null,
        tuition_percent_paid: 0,
        available_installment_percents: TUITION_INSTALLMENT_OPTIONS.map((option) => option.value),
        prior_unpaid_count: 0,
        prior_unpaid_amount: 0,
      }));
  };

  const load = () => {
    setLoading(true);
    api.get('/api/transactions')
      .then((r) => setRows(r.data.data || r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
    loadFeeSchedule();
  };

  const loadWallet = () => {
    if (!auth?.is_student) return;
    api.get('/api/wallet').then((r) => setWalletBalance(Number(r.data.balance ?? 0))).catch(() => setWalletBalance(null));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadWallet(); }, [auth?.is_student]);
  useEffect(() => { loadFeeSchedule(); }, [auth?.is_student]);

  useEffect(() => {
    if (!receiptHtml && !confirmInvoice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReceiptHtml(null);
        setConfirmInvoice(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [receiptHtml, confirmInvoice]);

  const payOnline = async (id: number) => {
    setPayingId(id);
    try {
      const { data } = await api.post('/api/payments/paystack/initialize', {
        invoice_id: id,
        portal: 'student',
      });
      if (data.demo) {
        await api.get(`/api/payments/paystack/verify/${encodeURIComponent(data.reference)}`);
        toast.success('Payment confirmed');
        load();
      } else if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.error('Payment could not be started.');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Payment could not be started.');
    } finally {
      setPayingId(null);
    }
  };

  const payWallet = async () => {
    if (!confirmInvoice) return;
    setPayingId(confirmInvoice.id);
    try {
      await api.post(`/api/wallet/pay/${confirmInvoice.id}`);
      toast.success('Paid from wallet');
      setConfirmInvoice(null);
      load();
      loadWallet();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not pay from wallet. Fund your wallet and try again.');
    } finally {
      setPayingId(null);
    }
  };

  const fetchInvoiceReceipt = async (invoiceId: number) => {
    const { data } = await api.get(`/api/invoices/${invoiceId}/receipt`, { responseType: 'text' });
    return typeof data === 'string' ? data : String(data);
  };

  const fetchPaymentReceipt = async (paymentId: number) => {
    const { data } = await api.get(`/api/payments/${paymentId}/receipt`, { responseType: 'text' });
    return typeof data === 'string' ? data : String(data);
  };

  const openReceipt = async (opts: { invoiceId?: number; paymentId?: number; receiptNo?: string }) => {
    setReceiptLoading(true);
    setReceiptHtml(null);
    try {
      const receiptNo = opts.receiptNo || opts.invoiceId || opts.paymentId;
      setReceiptTitle(`Receipt ${receiptNo}`);
      const html = opts.paymentId
        ? await fetchPaymentReceipt(opts.paymentId)
        : await fetchInvoiceReceipt(opts.invoiceId!);
      setReceiptHtml(html);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not open receipt.');
    } finally {
      setReceiptLoading(false);
    }
  };

  const downloadReceipt = async (opts?: { invoiceId?: number; paymentId?: number; html?: string | null; receiptNo?: string }) => {
    try {
      const content = opts?.html
        || (opts?.paymentId ? await fetchPaymentReceipt(opts.paymentId) : null)
        || (opts?.invoiceId ? await fetchInvoiceReceipt(opts.invoiceId) : null);
      if (!content) return;
      const receiptNo = opts?.receiptNo || receiptTitle.replace(/^Receipt\s+/, '') || 'receipt';
      const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptNo}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Receipt downloaded');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not download receipt.');
    }
  };

  const printReceipt = () => {
    const frame = document.getElementById('receipt-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const createTuitionInstallment = async () => {
    setCreatingTuition(true);
    try {
      await api.post('/api/invoices/tuition-installment', {
        installment_percent: installmentPercent,
      });
      toast.success('Tuition invoice created');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not create tuition invoice.');
    } finally {
      setCreatingTuition(false);
    }
  };

  const invoiceRows = rows.filter((row) => row.kind !== 'wallet_topup');
  const walletTopups = rows.filter((row) => row.kind === 'wallet_topup');
  const unpaid = invoiceRows.filter((i) => ['unpaid', 'partial'].includes(i.status));
  const paid = invoiceRows.filter((i) => i.status === 'paid');
  const totalDue = unpaid.reduce((sum, i) => sum + Number(i.balance ?? i.amount ?? 0), 0);
  const hasOpenTuition = invoiceRows.some((i) => i.category === 'tuition' && ['unpaid', 'partial'].includes(i.status));
  const programmeFeeReady = feeSchedule?.schedule_set ?? !!auth?.programme_fee_set;
  const programmeFeeTotal = feeSchedule?.total_amount ?? auth?.programme_fee_total ?? null;
  const availableInstallments = useMemo(() => {
    const paidPercent = Number(feeSchedule?.tuition_percent_paid ?? 0);
    const fromApi = feeSchedule?.available_installment_percents;
    const base = fromApi
      ? fromApi
      : TUITION_INSTALLMENT_OPTIONS.map((option) => option.value);
    return base.filter((percent) => percent > paidPercent);
  }, [feeSchedule]);
  const tuitionFullyPaid = programmeFeeReady && availableInstallments.length === 0 && !(feeSchedule?.prior_unpaid_count);
  const hasPriorUnpaid = Number(feeSchedule?.prior_unpaid_count ?? 0) > 0;

  useEffect(() => {
    if (!availableInstallments.length) return;
    if (!availableInstallments.includes(installmentPercent)) {
      setInstallmentPercent(availableInstallments[0]);
    }
  }, [availableInstallments, installmentPercent]);

  const stats = useMemo(() => ([
    { label: 'Outstanding', value: formatNaira(totalDue), tone: totalDue > 0 ? 'warning' : 'success' },
    { label: 'Open invoices', value: String(unpaid.length), tone: unpaid.length ? 'warning' : 'success' },
    { label: 'Completed', value: String(paid.length + walletTopups.length), tone: 'info' },
  ]), [unpaid.length, paid.length, walletTopups.length, totalDue]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Transaction history' }]} />
        <PageHeader
          eyebrow="Payments"
          title="Transaction history"
          description={auth?.is_student
            ? 'View invoices, wallet funding, and download receipts for completed payments.'
            : 'Pay application and acceptance fees online, then view or download your receipts.'}
        />
      </div>

      {auth?.is_student && hasPriorUnpaid && (
        <Alert tone="warning">
          Pay {formatNaira(feeSchedule?.prior_unpaid_amount ?? 0)} from previous sessions and levels before current-session tuition. Open those invoices below and pay them first.
        </Alert>
      )}

      {auth?.is_student && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Pay tuition by installment</h3>
              <p className="text-sm text-slate-500 mt-1">
                {!programmeFeeReady
                  ? 'Tuition installments are unavailable until the bursary assigns fee items to your programme.'
                  : hasPriorUnpaid
                    ? 'Settle previous session invoices first. Current-session installments stay locked until those are paid.'
                    : tuitionFullyPaid
                      ? 'Tuition is paid in full. Paid invoices stay in your transaction history for receipts.'
                      : 'Choose the next unpaid share. Already-paid installments stay off this list, and the new invoice only bills unpaid fee items.'}
              </p>
              {programmeFeeReady && programmeFeeTotal != null && (
                <p className="text-sm text-slate-600 mt-1">
                  Programme schedule total: {formatNaira(programmeFeeTotal)}
                </p>
              )}
            </div>
            {!tuitionFullyPaid && !hasPriorUnpaid && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={installmentPercent}
                onChange={(e) => setInstallmentPercent(Number(e.target.value))}
                disabled={!programmeFeeReady || hasOpenTuition || creatingTuition || !availableInstallments.length}
              >
                {availableInstallments.map((p) => (
                  <option key={p} value={p}>
                    {TUITION_INSTALLMENT_OPTIONS.find((option) => option.value === p)?.label ?? `${p}%`}
                  </option>
                ))}
              </select>
              <Button
                onClick={createTuitionInstallment}
                disabled={!programmeFeeReady || hasOpenTuition || creatingTuition || !availableInstallments.length}
              >
                {creatingTuition
                  ? 'Creating…'
                  : !programmeFeeReady
                    ? 'Programme fees not assigned'
                    : hasOpenTuition
                      ? 'Open tuition invoice exists'
                      : 'Create tuition invoice'}
              </Button>
            </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border p-4 shadow-sm ${
              stat.tone === 'warning' ? 'border-amber-100 bg-amber-50/60'
                : stat.tone === 'success' ? 'border-emerald-100 bg-emerald-50/60'
                  : 'border-sky-100 bg-sky-50/60'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-1.5 text-lg font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12 text-slate-500">
            <Spinner label="Loading transactions…" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-slate-900">No transactions yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Payments and wallet funding will appear here with receipts you can view or download.
            </p>
            {!auth?.is_student && (
              <Link to="/apply" className="inline-block mt-4 text-sm text-sky-600 font-medium hover:underline">
                Start application
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const isWalletTopup = row.kind === 'wallet_topup';
                  const isPaid = isWalletTopup || row.status === 'paid';
                  const isCancelled = !isWalletTopup && row.status === 'cancelled';
                  const waived = !isWalletTopup && isPaid && Number(row.rebate_total) > 0 && !(row.payments?.length);
                  const rowKey = isWalletTopup ? `wallet-${row.payment_id}` : `invoice-${row.id}`;
                  const receiptNo = row.receipt_no || row.payments?.[0]?.receipt_no || row.number;
                  return (
                    <tr key={rowKey} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold font-mono text-slate-900">{row.number}</div>
                        {receiptNo && receiptNo !== row.number && (
                          <div className="text-xs text-slate-500 mt-0.5">Receipt {receiptNo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 capitalize text-slate-700">
                        {(row.category || 'Fee').replaceAll('_', ' ')}
                        {row.installment_label || (row.installment_percent ? `${row.installment_percent}% installment` : null) ? (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {row.installment_label || `${row.installment_percent}% installment`}
                          </div>
                        ) : null}
                        {(row.level_code && row.level_code !== 'all') || row.academic_session?.label ? (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {[row.level_code && row.level_code !== 'all' ? `${row.level_code} level` : null, row.academic_session?.label]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-slate-800 whitespace-nowrap">
                        {formatNaira(row.amount)}
                        {!isWalletTopup && row.full_amount != null && Number(row.full_amount) !== Number(row.amount) && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            of {formatNaira(row.full_amount)}
                          </div>
                        )}
                        {!isWalletTopup && Number(row.rebate_total) > 0 && (
                          <div className="text-xs text-emerald-700 mt-0.5">
                            Rebate {formatNaira(row.rebate_total)}
                          </div>
                        )}
                        {!isPaid && row.balance != null && Number(row.balance) !== Number(row.amount) && (
                          <div className="text-xs text-amber-700 mt-0.5">
                            Balance {formatNaira(row.balance)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={isWalletTopup ? 'paid' : row.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap justify-end gap-2">
                          {isPaid && waived ? (
                            <span className="text-xs text-emerald-700">Waived</span>
                          ) : isPaid ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openReceipt(
                                  isWalletTopup
                                    ? { paymentId: row.payment_id, receiptNo }
                                    : { invoiceId: row.id, receiptNo },
                                )}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
                              >
                                View receipt
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadReceipt(
                                  isWalletTopup
                                    ? { paymentId: row.payment_id, receiptNo }
                                    : { invoiceId: row.id, receiptNo },
                                )}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Download
                              </button>
                            </>
                          ) : isCancelled ? (
                            <span className="text-xs text-slate-500">Disabled</span>
                          ) : isOnlineFee(row.category) ? (
                            <Button
                              onClick={() => payOnline(row.id)}
                              disabled={payingId === row.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm !px-3 !py-1.5 text-xs"
                            >
                              {payingId === row.id ? <Spinner label="Opening…" /> : 'Pay online'}
                            </Button>
                          ) : auth?.is_student ? (
                            <Button
                              onClick={() => setConfirmInvoice(row)}
                              disabled={payingId === row.id}
                              className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm !px-3 !py-1.5 text-xs"
                            >
                              Pay from wallet
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-500">Pay from wallet after admission</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {confirmInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => payingId == null && setConfirmInvoice(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm wallet payment"
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">Wallet payment</p>
              <h2 className="text-lg font-semibold text-slate-900 mt-1">Review and approve</h2>
              <p className="text-sm text-slate-500 mt-1">
                Confirm the charges below before debiting your campus wallet.
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Invoice</span>
                  <span className="font-mono font-medium text-slate-900">{confirmInvoice.number}</span>
                </div>
                <div className="flex justify-between gap-3 mt-1.5">
                  <span className="text-slate-500">Category</span>
                  <span className="capitalize text-slate-800">{String(confirmInvoice.category || 'Fee').replaceAll('_', ' ')}</span>
                </div>
                {confirmInvoice.installment_percent ? (
                  <div className="flex justify-between gap-3 mt-1.5">
                    <span className="text-slate-500">Installment</span>
                    <span className="text-slate-800">{confirmInvoice.installment_percent}% installment</span>
                  </div>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Breakdown</p>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {(confirmInvoice.items?.length ? confirmInvoice.items : [{ description: String(confirmInvoice.category || 'Charge').replaceAll('_', ' '), amount: confirmInvoice.balance ?? confirmInvoice.amount }]).map((item: any, index: number) => (
                    <li key={item.id || index} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className={Number(item.amount) < 0 ? 'text-emerald-700' : 'text-slate-700'}>{item.description || 'Fee line'}</span>
                      <span className={`font-medium tabular-nums shrink-0 ${Number(item.amount) < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>{formatNaira(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <dl className="space-y-1.5 text-sm">
                {Number(confirmInvoice.rebate_total) > 0 ? (
                  <>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Original</dt>
                      <dd className="tabular-nums text-slate-800">{formatNaira(confirmInvoice.amount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Rebate</dt>
                      <dd className="tabular-nums text-emerald-700">−{formatNaira(confirmInvoice.rebate_total)}</dd>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Amount due</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{formatNaira(confirmInvoice.balance ?? confirmInvoice.amount)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Wallet balance</dt>
                  <dd className="tabular-nums text-slate-800">{walletBalance == null ? '—' : formatNaira(walletBalance)}</dd>
                </div>
                {walletBalance != null && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Balance after payment</dt>
                    <dd className={`tabular-nums font-medium ${walletBalance - Number(confirmInvoice.balance ?? confirmInvoice.amount) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {formatNaira(walletBalance - Number(confirmInvoice.balance ?? confirmInvoice.amount))}
                    </dd>
                  </div>
                )}
              </dl>
              {walletBalance != null && walletBalance < Number(confirmInvoice.balance ?? confirmInvoice.amount) && (
                <Alert tone="warning">
                  Insufficient wallet balance.{' '}
                  <Link to="/wallet" className="font-medium underline">Fund wallet</Link>
                </Alert>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button
                type="button"
                onClick={() => setConfirmInvoice(null)}
                disabled={payingId === confirmInvoice.id}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={payWallet}
                disabled={payingId === confirmInvoice.id || (walletBalance != null && walletBalance < Number(confirmInvoice.balance ?? confirmInvoice.amount))}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                {payingId === confirmInvoice.id ? <Spinner label="Paying…" /> : 'Approve payment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {(receiptLoading || receiptHtml) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => !receiptLoading && setReceiptHtml(null)}
          role="dialog"
          aria-modal="true"
          aria-label={receiptTitle}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
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
                    <button
                      type="button"
                      onClick={printReceipt}
                      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadReceipt({ html: receiptHtml })}
                      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                    >
                      Download
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setReceiptHtml(null)}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-[#e8eef3]">
              {receiptLoading || !receiptHtml ? (
                <div className="flex items-center justify-center py-24 text-slate-500">
                  <Spinner label="Loading receipt…" />
                </div>
              ) : (
                <iframe
                  id="receipt-frame"
                  title={receiptTitle}
                  srcDoc={receiptHtml}
                  className="w-full h-[min(78vh,900px)] border-0 bg-[#e8eef3]"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Documents() {
  const { auth, refresh } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [appDocs, setAppDocs] = useState<any[]>([]);
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [printDoc, setPrintDoc] = useState<{ title: string; label: string; html: string } | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [payingAcceptance, setPayingAcceptance] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const docs = await api.get('/api/documents');
        setRows(docs.data.data || docs.data || []);
        if (auth?.application_id) {
          const res = await api.get(`/api/applications/${auth.application_id}`);
          setApp(res.data);
          setAppDocs(res.data.documents || []);
        }
      } catch {
        setRows([]);
        setAppDocs([]);
        setApp(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [auth?.application_id]);

  useEffect(() => {
    if (!printDoc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPrintDoc(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [printDoc]);

  const issued = rows;
  const uploads = appDocs;
  const canViewOffer = !!auth?.application_id && (!!app?.offer_reference || issued.some((d) => d.type === 'offer_letter'));

  const openOfferLetter = async (doc?: any) => {
    setPrintLoading(true);
    setPrintDoc(null);
    try {
      let html = doc?.html_body as string | undefined;
      if (!html && auth?.application_id) {
        const { data } = await api.get(`/api/applications/${auth.application_id}/offer-letter`, { responseType: 'text' });
        html = typeof data === 'string' ? data : String(data);
      }
      if (!html) {
        toast.error('Admission letter is not available yet.');
        return;
      }
      setPrintDoc({
        title: doc?.title || 'Admission letter',
        label: 'Admission offer letter',
        html,
      });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not open admission letter.');
    } finally {
      setPrintLoading(false);
    }
  };

  const printCurrent = () => {
    const frame = document.getElementById('documents-print-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const downloadCurrent = () => {
    if (!printDoc) return;
    const blob = new Blob([printDoc.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${printDoc.title.replace(/\s+/g, '-').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const payAcceptance = async (invoiceId: number) => {
    setPayingAcceptance(true);
    try {
      const { data } = await api.post('/api/payments/paystack/initialize', {
        invoice_id: invoiceId,
        portal: 'student',
      });
      if (data.demo) {
        await api.get(`/api/payments/paystack/verify/${encodeURIComponent(data.reference)}`);
        toast.success('Acceptance fee paid. Your student record will open shortly.');
        await refresh();
        if (auth?.application_id) {
          const res = await api.get(`/api/applications/${auth.application_id}`);
          setApp(res.data);
        }
      } else if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.error('Payment could not be started.');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Payment could not be started.');
    } finally {
      setPayingAcceptance(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Documents' }]} />
        <PageHeader
          eyebrow="Records"
          title="Documents"
          description={auth?.is_student
            ? 'Official documents issued to you, plus files from your admission application.'
            : 'Uploaded application files and any letters issued during admission.'}
        />
      </div>

      {hasPendingAdmissionOffer(auth) && (
        <Card className="border-emerald-200 bg-emerald-50/50 space-y-4">
          <div>
            <h2 className="font-semibold text-emerald-900">Congratulations — you have an admission offer</h2>
            <p className="text-sm text-emerald-800/80 mt-1">
              Open your admission letter, then pay the acceptance fee to accept the offer.
            </p>
            {app?.acceptance_fee_invoice && (
              <p className="text-sm font-medium text-emerald-900 mt-2">
                Acceptance fee: {formatNaira(app.acceptance_fee_invoice.amount)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={openOfferPrompt}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              Accept offer
            </Button>
            {canViewOffer && (
              <Button
                onClick={() => openOfferLetter(issued.find((d) => d.type === 'offer_letter'))}
                disabled={printLoading}
                className="bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 shadow-sm"
              >
                {printLoading ? <Spinner label="Opening…" /> : 'View admission letter'}
              </Button>
            )}
            {app?.acceptance_fee_invoice?.id && ['unpaid', 'partial'].includes(app.acceptance_fee_invoice.status) && (
              <Button
                onClick={() => payAcceptance(app.acceptance_fee_invoice.id)}
                disabled={payingAcceptance}
                className="bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 shadow-sm"
              >
                {payingAcceptance ? <Spinner label="Starting payment…" /> : 'Pay acceptance fee'}
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Issued documents</p>
          <p className="mt-1.5 text-lg font-semibold text-slate-900">{issued.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Application uploads</p>
          <p className="mt-1.5 text-lg font-semibold text-slate-900">{uploads.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Spinner label="Loading documents…" />
        </div>
      ) : (
        <>
          <Card className="space-y-4">
            <div>
              <h2 className="font-semibold text-slate-900">Issued by the university</h2>
              <p className="text-sm text-slate-500 mt-0.5">Offer letters, credentials, and other official documents.</p>
            </div>
            {issued.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No issued documents yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {issued.map((doc) => {
                  const isOffer = doc.type === 'offer_letter';
                  return (
                    <li key={doc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{doc.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 capitalize">
                          {(doc.type || 'document').replaceAll('_', ' ')}
                          {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <StatusBadge status={doc.status || 'issued'} />
                        {(isOffer || doc.html_body) && (
                          <Button
                            onClick={() => (isOffer ? openOfferLetter(doc) : setPrintDoc({
                              title: doc.title || 'Document',
                              label: (doc.type || 'document').replaceAll('_', ' '),
                              html: doc.html_body,
                            }))}
                            disabled={printLoading}
                            className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm text-xs px-3 py-1.5"
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-900">Application uploads</h2>
                <p className="text-sm text-slate-500 mt-0.5">Files you attached during the application form.</p>
              </div>
              {['fee_paid', 'form_in_progress'].includes(auth?.lifecycle_stage || '') && (
                <Link to="/wizard" className="text-sm text-sky-600 font-medium hover:underline">
                  Manage in form
                </Link>
              )}
            </div>
            {uploads.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No application files uploaded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {uploads.map((doc) => (
                  <li key={doc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {auth?.application_id ? (
                        <DocumentPreviewThumb
                          applicationId={auth.application_id}
                          documentId={doc.id}
                          sourceUrl={doc.doc_type === 'passport' ? `/api/applications/${auth.application_id}/passport` : null}
                          label={doc.original_name || doc.doc_type || 'Upload'}
                          originalName={doc.original_name}
                          path={doc.path}
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{doc.original_name || doc.doc_type || 'Upload'}</p>
                        <p className="text-xs text-slate-500 mt-0.5 capitalize">
                          {(doc.doc_type || 'supporting').replaceAll('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status="uploaded" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {(printLoading || printDoc) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => !printLoading && setPrintDoc(null)}
          role="dialog"
          aria-modal="true"
          aria-label={printDoc?.title || 'Document'}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{printDoc?.label || 'Document'}</p>
                <h3 className="font-semibold text-slate-900 truncate">{printDoc?.title || 'Loading…'}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {printDoc && (
                  <>
                    <button type="button" onClick={printCurrent} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Print
                    </button>
                    <button type="button" onClick={downloadCurrent} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Download
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setPrintDoc(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-slate-100">
              {printLoading || !printDoc ? (
                <div className="flex items-center justify-center py-24 text-slate-500">
                  <Spinner label="Loading document…" />
                </div>
              ) : (
                <iframe
                  id="documents-print-frame"
                  title={printDoc.title}
                  srcDoc={printDoc.html}
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

export function Academic() {
  const { auth } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [tr, setTr] = useState<any>(null);
  const [clearance, setClearance] = useState<any>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printHtml, setPrintHtml] = useState('');
  const [printLoading, setPrintLoading] = useState(false);
  const [printMeta, setPrintMeta] = useState({ eyebrow: 'Unofficial', title: 'Academic transcript (not signed)' });

  useEffect(() => {
    if (!auth?.is_student) return;
    api.get('/api/academic/my-enrollments').then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get('/api/academic/transcript').then((r) => setTr(r.data)).catch(() => {});
    api.get('/api/exam-clearance').then((r) => setClearance(r.data)).catch(() => setClearance(null));
  }, [auth?.is_student]);

  const openPrint = async (kind: 'transcript' | 'clearance') => {
    setPrintMeta(kind === 'transcript'
      ? { eyebrow: 'Unofficial', title: 'Academic transcript (not signed)' }
      : { eyebrow: 'Exam sitting', title: 'Exam clearance' });
    setPrintLoading(true);
    setPrintOpen(true);
    setPrintHtml('');
    try {
      const { data } = await api.get(kind === 'transcript' ? '/api/academic/transcript' : '/api/exam-clearance', {
        params: { format: 'html' },
        responseType: 'text',
        headers: { Accept: 'text/html' },
      });
      setPrintHtml(typeof data === 'string' ? data : String(data));
    } catch {
      toast.error(kind === 'transcript' ? 'Could not open unofficial transcript.' : 'Could not open exam clearance for printing.');
      setPrintOpen(false);
    } finally {
      setPrintLoading(false);
    }
  };

  const printCurrent = () => {
    const frame = document.getElementById('academic-print-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  if (!auth?.is_student) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Academic' }]} />
        <PageHeader title="Academic" description="Exam clearance, course standing, and your unofficial transcript." />
      </div>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Course registration</h2>
            <p className="text-sm text-slate-500 mt-0.5">Add or drop courses for the current semester.</p>
          </div>
          <Link to="/course-registration" className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white">
            Open course registration
          </Link>
        </div>
      </Card>
      {clearance && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-slate-900">Exam clearance</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {clearance.term?.name ? `Conditions for ${clearance.term.name}.` : 'Conditions required before you can sit exams.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${clearance.cleared ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
                {clearance.cleared ? 'Cleared' : 'Not cleared'}
              </span>
              <Button
                type="button"
                onClick={() => openPrint('clearance')}
                className="bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Print
              </Button>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-800 mb-3">
            {clearance.cleared ? 'You are cleared to sit exams.' : 'You are not yet cleared to sit exams.'}
          </p>
          <ul className="divide-y divide-slate-100 text-sm">
            {(clearance.checks || []).map((check: any) => (
              <li key={check.key} className="py-2.5">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-slate-800">{check.label}</span>
                  <span className={check.passed ? 'text-emerald-700' : 'text-amber-800'}>{check.passed ? 'Met' : 'Not met'}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{check.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-slate-900">Transcript</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Released results only. You can view an unofficial copy — it is not signed and is not for official use.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => openPrint('transcript')}
            className="bg-sky-600 text-white hover:bg-sky-700"
          >
            View unofficial transcript
          </Button>
        </div>
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-3 text-sm text-amber-900">
          {tr?.notice || 'Unofficial transcript for viewing only. Official signed copies are issued by the Registry.'}
          {' '}
          <Link to="/transcript-request" className="font-medium text-amber-950 underline underline-offset-2">
            Request an official transcript
          </Link>
        </div>
        {tr && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">CGPA</p>
              <p className="text-2xl font-semibold text-sky-700 mt-1">{tr.cgpa ?? tr.gpa ?? '—'}</p>
            </div>
            {Array.isArray(tr.terms) && tr.terms.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest term GPA</p>
                <p className="text-2xl font-semibold text-slate-800 mt-1">{tr.terms[tr.terms.length - 1]?.gpa ?? '—'}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {tr.terms[tr.terms.length - 1]?.session_label} {tr.terms[tr.terms.length - 1]?.name}
                </p>
              </div>
            )}
          </div>
        )}
        {(rows || []).length === 0 && <p className="text-sm text-slate-500">No course registrations yet.</p>}
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map((e) => (
            <li key={e.id} className="py-2.5 flex justify-between gap-3">
              <span>{e.offering?.course?.code} {e.offering?.course?.title}</span>
              <span className="font-medium text-slate-700">
                {e.grade?.letter || (e.pending_grade ? 'Pending' : '—')}
              </span>
            </li>
          ))}
        </ul>
        {Array.isArray(tr?.terms) && tr.terms.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold text-slate-900">By semester</h3>
            {tr.terms.map((term: any) => (
              <div key={term.academic_term_id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">{term.session_label} · {term.name}</span>
                  <span>GPA {term.gpa}</span>
                </div>
                <ul className="text-sm divide-y divide-slate-50">
                  {(term.rows || []).map((row: any) => (
                    <li key={row.id} className="py-1.5 flex justify-between">
                      <span>{row.course?.code} {row.course?.title}</span>
                      <span>{row.letter || '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {printOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setPrintOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">{printMeta.eyebrow}</p>
                <h3 className="font-semibold text-slate-900 truncate">{printMeta.title}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!printLoading && printHtml && (
                  <button type="button" onClick={printCurrent} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Print
                  </button>
                )}
                <button type="button" onClick={() => setPrintOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
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
                  id="academic-print-frame"
                  title={printMeta.title}
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
