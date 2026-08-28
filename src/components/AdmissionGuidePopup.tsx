import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { Spinner } from './ui';

export type AdmissionGuide = {
  id: number;
  title: string;
  intro?: string | null;
  sections?: { heading?: string; body?: string }[];
  published_at?: string | null;
  updated_at?: string | null;
};

const SEEN_KEY = 'bells-admission-guide-seen';

function seenVersion(guide: AdmissionGuide) {
  return String(guide.updated_at || guide.published_at || guide.id);
}

export default function AdmissionGuidePopup({
  autoOpen = true,
  triggerLabel = 'Admission guide',
  trigger = 'link',
}: {
  autoOpen?: boolean;
  triggerLabel?: string;
  trigger?: 'link' | 'card';
}) {
  const [guide, setGuide] = useState<AdmissionGuide | null>(null);
  const [open, setOpen] = useState(false);
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  useEffect(() => {
    api.get('/api/admission-guide')
      .then((r) => {
        const next = r.data?.guide ?? null;
        setGuide(next);
        if (!autoOpen || !next) return;
        try {
          if (localStorage.getItem(SEEN_KEY) === seenVersion(next)) return;
        } catch {
          // ignore storage
        }
        setOpen(true);
      })
      .catch(() => setGuide(null));
  }, [autoOpen]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markSeen = () => {
    if (!guide) return;
    try {
      localStorage.setItem(SEEN_KEY, seenVersion(guide));
    } catch {
      // ignore
    }
  };

  const close = () => {
    markSeen();
    setOpen(false);
    setPrintHtml(null);
  };

  const loadPrint = async () => {
    if (printHtml || printLoading) return printHtml;
    setPrintLoading(true);
    try {
      const { data } = await api.get('/api/admission-guide/print', { responseType: 'text' });
      setPrintHtml(data);
      return data as string;
    } catch {
      return null;
    } finally {
      setPrintLoading(false);
    }
  };

  const download = async () => {
    const html = printHtml || await loadPrint();
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'admission-guide.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = async () => {
    const html = printHtml || await loadPrint();
    if (!html) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Admission guide print');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    iframe.srcdoc = html;
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 1500);
    };
  };

  if (!guide) return null;

  return (
    <>
      {trigger === 'card' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 text-left shadow-sm transition hover:border-sky-200 hover:shadow-md hover:bg-sky-50/30"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Admissions</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{triggerLabel}</p>
          <p className="text-xs text-slate-500 mt-1">Read or download the current published guide.</p>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-brand hover:text-crest-gold transition underline-offset-2 hover:underline"
        >
          {triggerLabel}
        </button>
      )}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admission-guide-title"
        >
          <div
            className="w-full max-w-3xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 bg-slate-50">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7320]">Admissions</p>
                <h3 id="admission-guide-title" className="mt-1 font-semibold text-slate-900">{guide.title}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void print()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Print
                </button>
                <button type="button" onClick={() => void download()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Download
                </button>
                <button type="button" onClick={close} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4">
              {guide.intro && <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{guide.intro}</p>}
              {(guide.sections || []).map((section, index) => (
                <section key={index}>
                  <h4 className="text-sm font-semibold text-slate-900">{section.heading}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{section.body}</p>
                </section>
              ))}
              {printLoading && (
                <div className="flex justify-center py-2 text-slate-500">
                  <Spinner label="Preparing download…" />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
