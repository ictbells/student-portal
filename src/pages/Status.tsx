import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { Breadcrumb, PageHeader, StepIndicator } from '../components/portal';
import { PassportPhoto } from '../components/PassportPhoto';
import { useToast } from '../components/toast';
import { formatStage, liveStage, studentFacingStatus, studentJourneyIndex, STUDENT_JOURNEY_STEPS } from '../constants/lifecycle';
import { Alert, Button, Card, Spinner } from '../components/ui';
import { formatNaira } from '../lib/money';
import { hasPendingAdmissionOffer, openOfferPrompt } from '../lib/offer';
import { storageUrl } from '../lib/storage';

function statusTone(stage?: string) {
  if (!stage) return 'default' as const;
  if (['rejected', 'withdrawn'].includes(stage)) return 'error' as const;
  if (['offer_issued', 'awaiting_acceptance_fee', 'acceptance_paid', 'matriculated', 'admission'].includes(stage)) return 'success' as const;
  if (['submitted', 'screening', 'verification', 'credit_assessment', 'shortlisting', 'recommended', 'recommendation', 'approved', 'approval', 'proposal_review', 'supervisor', 'panel'].includes(stage)) return 'info' as const;
  if (['awaiting_application_fee', 'fee_paid', 'form_in_progress'].includes(stage)) return 'warning' as const;
  return 'default' as const;
}

type PrintDoc = { title: string; label: string; html: string };

export default function Status() {
  const { auth, refresh } = useAuth();
  const toast = useToast();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [printDoc, setPrintDoc] = useState<PrintDoc | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [payingAcceptance, setPayingAcceptance] = useState(false);

  useEffect(() => {
    if (!auth?.application_id) {
      setLoading(false);
      return;
    }
    api.get(`/api/applications/${auth.application_id}`)
      .then((r) => setApp(r.data))
      .catch(() => setApp(null))
      .finally(() => setLoading(false));
  }, [auth?.application_id]);

  useEffect(() => {
    if (!printDoc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPrintDoc(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [printDoc]);

  const stage = liveStage(auth?.lifecycle_stage, app?.stage);
  const journeyIndex = studentJourneyIndex(stage, app?.current_step, auth?.is_student);
  const journeyComplete = journeyIndex >= STUDENT_JOURNEY_STEPS.length;
  const tone = statusTone(stage);
  const canPrintForm = !!auth?.application_id && stage !== 'awaiting_application_fee';
  const canPrintOffer = !!app?.offer_reference;

  const openPrint = async (kind: 'form' | 'offer') => {
    if (!auth?.application_id) return;
    setPrintLoading(true);
    setPrintDoc(null);
    try {
      const path = kind === 'form' ? 'form-print' : 'offer-letter';
      const { data } = await api.get(`/api/applications/${auth.application_id}/${path}`, { responseType: 'text' });
      setPrintDoc({
        title: kind === 'form' ? 'Application form' : 'Admission letter',
        label: kind === 'form' ? 'Application form printout' : 'Admission offer letter',
        html: data,
      });
    } catch (e: any) {
      toast.error(e.response?.data?.message || `Could not open ${kind === 'form' ? 'application form' : 'admission letter'}.`);
    } finally {
      setPrintLoading(false);
    }
  };

  const printCurrent = () => {
    const frame = document.getElementById('status-print-frame') as HTMLIFrameElement | null;
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
          const { data: fresh } = await api.get(`/api/applications/${auth.application_id}`);
          setApp(fresh);
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

  const reviews = useMemo(() => {
    const list = Array.isArray(app?.reviews) ? [...app.reviews] : [];
    return list.sort((a, b) => {
      const byTime = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      return byTime !== 0 ? byTime : (b.id || 0) - (a.id || 0);
    });
  }, [app?.reviews]);

  const summary = useMemo(() => ([
    {
      label: 'Status',
      value: studentFacingStatus(stage, auth?.is_student),
    },
    {
      label: 'Application number',
      value: app?.application_number || '—',
    },
    {
      label: 'Admission category',
      value: app?.entry_mode ? String(app.entry_mode).toUpperCase() : '—',
    },
    {
      label: 'Programme',
      value: app?.program?.name || 'Not selected yet',
    },
  ]), [stage, auth?.is_student, app]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Spinner label="Loading status…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Status' }]} />
        <PageHeader
          eyebrow="Admissions"
          title="Application status"
          description="Track where your admission file is. Steps 1–7 are yours; review after submission is handled by admissions."
        />
      </div>

      {auth?.application_id && (
        <Card className="!p-4 sm:!p-5">
          <div className="flex items-center gap-4">
            <PassportPhoto
              applicationId={auth.application_id}
              src={storageUrl(app?.steps?.find((s: any) => s.step_key === 'biodata')?.payload?.photo_path) || auth?.nin_identity?.photo_url || null}
              alt="Passport photograph"
              className="h-24 w-20 rounded-xl object-cover ring-1 ring-slate-200 bg-slate-100"
              placeholder={(
                <div className="flex h-24 w-20 items-center justify-center rounded-xl bg-slate-100 text-slate-400 text-xs text-center px-2">
                  No photo
                </div>
              )}
            />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 truncate">{auth.user?.name || 'Applicant'}</p>
              <p className="text-sm text-slate-500 mt-0.5">{studentFacingStatus(stage, auth.is_student)}</p>
              {app?.eligibility && app?.entry_mode === 'pg' && (
                <div className={`mt-2 text-sm ${app.eligibility.meets ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {app.eligibility.meets ? 'Meets eligibility' : 'Does not meet eligibility'}
                  {!app.eligibility.meets && (
                    <ul className="list-disc pl-4 mt-1">
                      {(app.eligibility.failed || []).map((item: any) => (
                        <li key={item.rule}>{item.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {!auth?.application_id && (
        <Alert tone="info">
          You have not started an application yet.{' '}
          <Link to="/apply" className="underline font-medium">Start application</Link>
        </Alert>
      )}

      {hasPendingAdmissionOffer(auth) && (
        <Card className="border-emerald-200 bg-emerald-50/50 space-y-4">
          <div>
            <h2 className="font-semibold text-emerald-900">Congratulations — you have an admission offer</h2>
            <p className="text-sm text-emerald-800/80 mt-1">
              Your offer is ready. Review the admission letter, then pay the non-refundable acceptance fee to complete acceptance and create your student record.
            </p>
            {app?.acceptance_fee_invoice && (
              <p className="text-sm font-medium text-emerald-900 mt-2">
                Acceptance fee: {formatNaira(app.acceptance_fee_invoice.amount)}
                {' · '}
                <span className="capitalize">{app.acceptance_fee_invoice.status}</span>
              </p>
            )}
            {app?.offer_reference && (
              <p className="text-xs text-emerald-800/70 mt-1 font-mono">Offer ref: {app.offer_reference}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={openOfferPrompt}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              Accept offer
            </Button>
            {canPrintOffer && (
              <Button
                onClick={() => openPrint('offer')}
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

      {auth?.unpaid_application_fee && (
        <Alert tone="warning">
          Your application fee is unpaid. Payment unlocks the form.{' '}
          <Link to="/apply" className="underline font-medium">Pay now</Link>
        </Alert>
      )}

      {auth?.application_id && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {summary.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className={`mt-1.5 text-base font-semibold break-words ${
                  item.label === 'Status'
                    ? tone === 'success' ? 'text-emerald-700'
                      : tone === 'warning' ? 'text-amber-700'
                        : tone === 'error' ? 'text-red-700'
                          : tone === 'info' ? 'text-sky-700'
                            : 'text-slate-900'
                    : 'text-slate-900'
                }`}>
                  {item.label === 'Application number' && item.value !== '—' ? (
                    <span className="font-mono">{item.value}</span>
                  ) : item.value}
                </p>
              </div>
            ))}
          </div>

          {!auth?.is_student && (
            <Card className="!p-4 sm:!p-5 bg-slate-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-900">Your application journey</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Steps 1–7 only. Staff review stages are not shown here.</p>
                </div>
                {journeyComplete && (
                  <span className="inline-flex self-start rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                    Pending
                  </span>
                )}
              </div>
              <StepIndicator
                steps={STUDENT_JOURNEY_STEPS}
                currentIndex={Math.min(journeyIndex, STUDENT_JOURNEY_STEPS.length - 1)}
                isStepComplete={(index) => journeyComplete || index < journeyIndex}
              />
            </Card>
          )}

          {(app?.offer_reference || app?.application_fee_invoice || app?.acceptance_fee_invoice) && (
            <Card className="space-y-4">
              <h2 className="font-semibold text-slate-900">Key references</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {app?.offer_reference && (
                  <div>
                    <dt className="text-slate-500">Offer reference</dt>
                    <dd className="font-medium font-mono text-slate-900 mt-0.5">{app.offer_reference}</dd>
                  </div>
                )}
                {app?.application_fee_invoice && (
                  <div>
                    <dt className="text-slate-500">Application fee</dt>
                    <dd className="font-medium text-slate-900 mt-0.5">
                      {formatNaira(app.application_fee_invoice.amount)} · {app.application_fee_invoice.status}
                    </dd>
                  </div>
                )}
                {app?.acceptance_fee_invoice && (
                  <div>
                    <dt className="text-slate-500">Acceptance fee</dt>
                    <dd className="font-medium text-slate-900 mt-0.5">
                      {formatNaira(app.acceptance_fee_invoice.amount)} · {app.acceptance_fee_invoice.status}
                    </dd>
                  </div>
                )}
                {app?.intake?.term?.session_label && (
                  <div>
                    <dt className="text-slate-500">Session</dt>
                    <dd className="font-medium text-slate-900 mt-0.5">{app.intake.term.session_label}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          {reviews.length > 0 && (
            <Card>
              <h2 className="font-semibold text-slate-900 mb-4">Updates</h2>
              <ol className="relative space-y-0 border-l border-slate-200 ml-2">
                {reviews.map((r: any) => (
                  <li key={r.id} className="relative pl-6 pb-5 last:pb-0">
                    <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-sky-500 ring-4 ring-white" />
                    <div className="text-sm font-medium text-slate-900 capitalize">
                      {formatStage(r.to_stage)}
                      {r.decision && r.decision !== 'advanced' ? ` · ${r.decision}` : ''}
                    </div>
                    {r.from_stage && (
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">
                        From {formatStage(r.from_stage)}
                      </p>
                    )}
                    {r.reason && <p className="text-sm text-slate-600 mt-1">{r.reason}</p>}
                    {r.created_at && (
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <div className="flex flex-wrap gap-3">
            {['fee_paid', 'form_in_progress'].includes(stage || '') && (
              <Link to="/wizard">
                <Button className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm">Continue application form</Button>
              </Link>
            )}
            {canPrintForm && (
              <Button
                onClick={() => openPrint('form')}
                disabled={printLoading}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                {printLoading ? <Spinner label="Opening…" /> : 'Print application form'}
              </Button>
            )}
            {canPrintOffer && (
              <Button
                onClick={() => openPrint('offer')}
                disabled={printLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                View admission letter
              </Button>
            )}
            {hasPendingAdmissionOffer(auth) && app?.acceptance_fee_invoice?.id && ['unpaid', 'partial'].includes(app.acceptance_fee_invoice.status) && (
              <Button
                onClick={() => payAcceptance(app.acceptance_fee_invoice.id)}
                disabled={payingAcceptance}
                className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
              >
                {payingAcceptance ? <Spinner label="Starting payment…" /> : 'Accept admission — pay fee'}
              </Button>
            )}
            <Link to="/invoices">
              <Button className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">Transaction history</Button>
            </Link>
            <Link to="/documents">
              <Button className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">View documents</Button>
            </Link>
          </div>
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
                  id="status-print-frame"
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
