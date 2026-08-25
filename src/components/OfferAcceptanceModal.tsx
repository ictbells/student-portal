import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth';
import {
  OFFER_PROMPT_EVENT,
  dismissOfferPrompt,
  hasPendingAdmissionOffer,
  isOfferPromptDismissed,
} from '../lib/offer';
import { formatNaira } from '../lib/money';
import { useToast } from './toast';
import { Button, Spinner } from './ui';

export default function OfferAcceptanceModal() {
  const { auth, refresh } = useAuth();
  const toast = useToast();
  const pending = hasPendingAdmissionOffer(auth);
  const [open, setOpen] = useState(false);
  const [app, setApp] = useState<any>(null);
  const [paying, setPaying] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printHtml, setPrintHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!pending || !auth?.application_id) {
      setApp(null);
      setOpen(false);
      return;
    }
    api.get(`/api/applications/${auth.application_id}`)
      .then((r) => setApp(r.data))
      .catch(() => setApp(null));
    if (!isOfferPromptDismissed()) setOpen(true);
  }, [pending, auth?.application_id]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OFFER_PROMPT_EVENT, onOpen);
    return () => window.removeEventListener(OFFER_PROMPT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (printHtml) setPrintHtml(null);
        else later();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, printHtml]);

  const later = () => {
    dismissOfferPrompt();
    setOpen(false);
  };

  const openLetter = async () => {
    if (!auth?.application_id) return;
    setPrintLoading(true);
    try {
      const { data } = await api.get(`/api/applications/${auth.application_id}/offer-letter`, { responseType: 'text' });
      setPrintHtml(data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not open the admission letter.');
    } finally {
      setPrintLoading(false);
    }
  };

  const pay = async () => {
    const invoiceId = app?.acceptance_fee_invoice?.id;
    if (!invoiceId || app.acceptance_fee_invoice.status === 'paid') {
      toast.error('Acceptance fee invoice is not ready yet. Contact admissions if this persists.');
      return;
    }
    setPaying(true);
    try {
      const { data } = await api.post('/api/payments/paystack/initialize', {
        invoice_id: invoiceId,
        portal: 'student',
      });
      if (data.demo) {
        await api.get(`/api/payments/paystack/verify/${encodeURIComponent(data.reference)}`);
        toast.success('Acceptance fee paid. Your student record will open shortly.');
        setOpen(false);
        await refresh();
      } else if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.error('Payment could not be started.');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Payment could not be started.');
    } finally {
      setPaying(false);
    }
  };

  if (!pending || !open) return null;

  const firstName = auth?.user?.name?.split(' ')[0] || 'applicant';
  const programme = app?.program?.name;
  const session = app?.intake?.term?.session_label;
  const invoice = app?.acceptance_fee_invoice;
  const canPay = !!invoice?.id && invoice.status !== 'paid';

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[1px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-prompt-title"
      >
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl">
          <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-sky-700 px-6 py-7 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">Admission offer</p>
            <h2 id="offer-prompt-title" className="mt-2 font-serif text-2xl sm:text-3xl leading-tight">
              Congratulations, {firstName}!
            </h2>
            <p className="mt-2 text-sm text-emerald-50/95 leading-relaxed">
              You have been offered admission to Bells University of Technology.
              Review your letter and pay the acceptance fee to accept the offer.
            </p>
          </div>
          <div className="space-y-4 px-6 py-5">
            {(programme || session || app?.offer_reference || invoice) && (
              <dl className="grid grid-cols-1 gap-3 text-sm">
                {programme && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Programme</dt>
                    <dd className="mt-0.5 font-semibold text-slate-900">{programme}</dd>
                  </div>
                )}
                {session && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Session</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{session}</dd>
                  </div>
                )}
                {app?.offer_reference && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Offer reference</dt>
                    <dd className="mt-0.5 font-mono text-sm text-slate-800">{app.offer_reference}</dd>
                  </div>
                )}
                {invoice && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Acceptance fee</dt>
                    <dd className="mt-0.5 font-semibold text-slate-900">
                      {formatNaira(invoice.amount)}
                      <span className="ml-1.5 font-normal capitalize text-slate-500">{invoice.status}</span>
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <Button
                type="button"
                onClick={later}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Remind me later
              </Button>
              <Button
                type="button"
                onClick={openLetter}
                disabled={printLoading || !auth?.application_id}
                className="bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50"
              >
                {printLoading ? <Spinner label="Opening…" /> : 'View admission letter'}
              </Button>
              <Button
                type="button"
                onClick={pay}
                disabled={paying || !canPay}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {paying ? <Spinner label="Starting payment…" className="text-white" /> : 'Accept offer — pay fee'}
              </Button>
            </div>
            {!canPay && (
              <p className="text-xs text-amber-700">
                Your letter is ready. The acceptance fee invoice will appear here once admissions sets the amount.
              </p>
            )}
          </div>
        </div>
      </div>
      {printHtml && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50"
          onClick={() => setPrintHtml(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Admission letter"
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50">
              <h3 className="font-semibold text-slate-900">Admission offer letter</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const frame = document.getElementById('offer-print-frame') as HTMLIFrameElement | null;
                    frame?.contentWindow?.focus();
                    frame?.contentWindow?.print();
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setPrintHtml(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              id="offer-print-frame"
              title="Admission letter"
              srcDoc={printHtml}
              className="w-full h-[min(70vh,720px)] border-0 bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}
