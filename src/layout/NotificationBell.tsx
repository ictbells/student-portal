import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';

type InboxItem = {
  id: number;
  title: string;
  body?: string | null;
  type?: string | null;
  read_at?: string | null;
  created_at?: string | null;
};

function BellIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function relativeTime(iso?: string | null) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const nav = useNavigate();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const refreshCount = useCallback(() => {
    api.get('/api/notifications/unread-count')
      .then((r) => setCount(Number(r.data?.count || 0)))
      .catch(() => {});
  }, []);

  const loadList = useCallback(() => {
    setLoadingList(true);
    api.get('/api/notifications', { params: { per_page: 8 } })
      .then((r) => setItems(r.data.data || r.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount, location.pathname]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') refreshCount();
    };
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refreshCount]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    loadList();
    refreshCount();
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, loadList, refreshCount]);

  const badge = count > 99 ? '99+' : String(count);

  const openItem = async (item: InboxItem) => {
    if (!item.read_at) {
      try {
        await api.post(`/api/notifications/${item.id}/read`);
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)));
        setCount((n) => Math.max(0, n - 1));
      } catch {
        /* still navigate */
      }
    }
    setOpen(false);
    if (item.type === 'announcement') nav('/announcements');
    else nav('/notifications');
  };

  const markAll = async () => {
    try {
      await api.post('/api/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setCount(0);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition touch-manipulation"
        aria-label={count ? `${count} unread notifications` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-rose-600 text-[10px] font-semibold leading-[1.1rem] text-white text-center">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-3.5rem))] origin-top-right rounded-xl border border-slate-200 bg-white shadow-lg z-30 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {count > 0 && (
              <button type="button" className="text-xs font-medium text-sky-700 hover:underline" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loadingList && !items.length ? (
              <p className="px-3 py-6 text-sm text-slate-500">Loading…</p>
            ) : !items.length ? (
              <p className="px-3 py-6 text-sm text-slate-500">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => openItem(item)}
                  className={`flex min-h-11 w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-slate-50 transition touch-manipulation ${
                    item.read_at ? '' : 'bg-sky-50/70'
                  }`}
                >
                  <span className={`text-sm ${item.read_at ? 'font-medium text-slate-800' : 'font-semibold text-slate-900'}`}>
                    {item.title}
                  </span>
                  {item.body && <span className="line-clamp-2 text-xs text-slate-500">{item.body}</span>}
                  <span className="text-[11px] text-slate-400">{relativeTime(item.created_at)}</span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-slate-100 px-3 py-2">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-sky-700 hover:underline"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
