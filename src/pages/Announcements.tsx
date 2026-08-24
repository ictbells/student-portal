import { useEffect, useState } from 'react';
import api from '../api';
import { Breadcrumb, PageHeader } from '../components/portal';
import { Button, Card, Spinner } from '../components/ui';

const PAGE_SIZE = 10;

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Announcements() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0, from: 0, to: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/api/announcements', { params: { page, per_page: PAGE_SIZE } })
      .then((r) => {
        const body = r.data || {};
        const list = Array.isArray(body.data) ? body.data : [];
        setRows(list);
        setMeta({
          page: Number(body.current_page || page),
          lastPage: Math.max(1, Number(body.last_page || 1)),
          total: Number(body.total || 0),
          from: body.from ?? 0,
          to: body.to ?? 0,
        });
      })
      .catch(() => {
        setRows([]);
        setMeta({ page: 1, lastPage: 1, total: 0, from: 0, to: 0 });
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Announcements' }]} />
      <PageHeader
        eyebrow="Campus notices"
        title="Announcements"
        description="Official notices from the university. Newest first."
      />
      {loading ? (
        <Spinner label="Loading announcements…" className="text-slate-500" />
      ) : !rows.length ? (
        <Card>
          <p className="text-sm text-slate-500">No announcements yet.</p>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((item) => (
              <Card key={item.id}>
                <p className="text-xs font-medium text-slate-500">{formatDate(item.published_at || item.created_at)}</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.body}</p>
              </Card>
            ))}
          </div>
          {meta.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-slate-500">
                {meta.from}–{meta.to} of {meta.total}
              </p>
              {meta.lastPage > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 !px-3 !py-1.5 text-xs"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-slate-500">Page {meta.page} of {meta.lastPage}</span>
                  <Button
                    className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 !px-3 !py-1.5 text-xs"
                    disabled={page >= meta.lastPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
