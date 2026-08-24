import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastApi = {
  push: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const toneClass: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const text = String(message || '').trim();
    if (!text) return;
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-4), { id, message: text, tone }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    push,
    success: (message) => push(message, 'success'),
    error: (message) => push(message, 'error'),
    info: (message) => push(message, 'info'),
    warning: (message) => push(message, 'warning'),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-end gap-2 p-4 sm:p-5"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClass[toast.tone]}`}
            role="status"
          >
            <div className="flex items-start gap-3">
              <p className="flex-1 leading-snug">{toast.message}</p>
              <button
                type="button"
                className="shrink-0 rounded-md px-1.5 py-0.5 text-xs opacity-70 hover:opacity-100"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
