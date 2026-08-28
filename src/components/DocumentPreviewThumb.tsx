import { useEffect, useState } from 'react';
import api from '../api';

type Props = {
  applicationId: number;
  documentId?: number | null;
  sourceUrl?: string | null;
  /** Fallback when there is no application_documents row (e.g. NIN photo data URL). */
  fallbackUrl?: string | null;
  label: string;
  originalName?: string | null;
  path?: string | null;
};

function looksLikeImage(name?: string | null, path?: string | null, contentType?: string | null) {
  if (contentType?.startsWith('image/')) return true;
  const probe = `${name || ''} ${path || ''}`;
  return /\.(jpe?g|png|gif|webp)$/i.test(probe);
}

/**
 * Loads application document previews via the authenticated API (blob),
 * so images work without a public /storage symlink and without exposing files anonymously.
 */
export function DocumentPreviewThumb({
  applicationId,
  documentId,
  sourceUrl,
  fallbackUrl,
  label,
  originalName,
  path,
}: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setBlobUrl(null);
    setContentType(null);
    setFailed(false);
    setOpen(false);

    const endpoints: string[] = [];
    if (documentId) {
      endpoints.push(`/api/applications/${applicationId}/documents/${documentId}/file`);
    }
    if (sourceUrl) {
      endpoints.push(sourceUrl);
    }
    if (endpoints.length === 0) {
      return () => {};
    }

    (async () => {
      for (const endpoint of endpoints) {
        try {
          const { data, headers } = await api.get(endpoint, { responseType: 'blob' });
          if (cancelled) return;
          const type = String(headers['content-type'] || data.type || '');
          if (type.includes('json') || type.includes('text/html')) {
            throw new Error('not a file');
          }
          objectUrl = URL.createObjectURL(data);
          setContentType(type);
          setBlobUrl(objectUrl);
          return;
        } catch {
          // try the next source
        }
      }
      if (!cancelled) setFailed(true);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [applicationId, documentId, sourceUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const displayUrl = blobUrl || (!documentId ? fallbackUrl : null) || (failed ? fallbackUrl : null);
  const isImage = looksLikeImage(originalName, path, contentType)
    || (!!fallbackUrl && !documentId && !/\.pdf$/i.test(originalName || path || ''));

  const modal = open && displayUrl ? (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} preview`}
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92dvh] rounded-t-2xl sm:rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{label}</p>
            {originalName && <p className="text-xs text-slate-500 truncate">{originalName}</p>}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4 flex items-center justify-center min-h-[240px]">
          {isImage ? (
            <img
              src={displayUrl}
              alt={label}
              className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-sm"
            />
          ) : (
            <iframe
              title={`${label} preview`}
              src={displayUrl}
              className="w-full h-[75vh] rounded-lg border border-slate-200 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  ) : null;

  if (displayUrl && isImage) {
    return (
      <>
        <button
          type="button"
          className="block p-0 border-0 bg-transparent cursor-zoom-in"
          title="Preview"
          onClick={() => setOpen(true)}
        >
          <img
            src={displayUrl}
            alt={`${label} preview`}
            className="h-16 w-14 rounded-lg object-cover border border-slate-200 bg-white shadow-sm"
          />
        </button>
        {modal}
      </>
    );
  }

  if (displayUrl) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-16 w-14 rounded-lg border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center text-[10px] font-semibold text-rose-700 hover:bg-rose-50"
          title="Preview document"
        >
          <span className="text-base leading-none">PDF</span>
          <span className="mt-0.5 text-slate-500 font-normal">View</span>
        </button>
        {modal}
      </>
    );
  }

  return (
    <div
      className="h-16 w-14 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 text-center px-1"
      aria-hidden
    >
      No file
    </div>
  );
}
