import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { Breadcrumb, PageHeader } from '../components/portal';
import { useToast } from '../components/toast';
import { Button, Card, Spinner } from '../components/ui';

function formatWhen(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Notifications() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/api/notifications')
      .then((r) => setRows(r.data.data || r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markRead = async (row: any) => {
    try {
      await api.post(`/api/notifications/${row.id}/read`);
      setRows((prev) => prev.map((n) => (n.id === row.id ? { ...n, read_at: new Date().toISOString() } : n)));
    } catch {
      toast.error('Could not mark that notification as read.');
    }
  };

  const markAll = async () => {
    try {
      await api.post('/api/notifications/read-all');
      const now = new Date().toISOString();
      setRows((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Could not mark notifications as read.');
    }
  };

  const unread = rows.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Notifications' }]} />
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Alerts about announcements, fees, and campus services."
        action={
          unread > 0 ? (
            <Button className="bg-sky-600 hover:bg-sky-700 text-white" onClick={markAll}>
              Mark all read
            </Button>
          ) : undefined
        }
      />
      {loading ? (
        <Spinner label="Loading notifications…" className="text-slate-500" />
      ) : !rows.length ? (
        <Card>
          <p className="text-sm text-slate-500">You have no notifications yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Card key={n.id} className={!n.read_at ? '!border-sky-200 !bg-sky-50/40' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                  {n.body && <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{n.body}</p>}
                  <p className="mt-2 text-xs text-slate-500">{formatWhen(n.created_at)}</p>
                  {n.type === 'announcement' && (
                    <Link to="/announcements" className="mt-2 inline-block text-xs font-medium text-sky-700 hover:underline">
                      View announcements
                    </Link>
                  )}
                </div>
                {!n.read_at && (
                  <Button
                    className="shrink-0 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 !px-3 !py-1.5 text-xs"
                    onClick={() => markRead(n)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
