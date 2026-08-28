import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, useState } from 'react';

function EyeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium touch-manipulation transition disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
        className={`w-full border border-[#e4ddd0] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-crest-gold/25 focus:border-crest-gold transition ${className}`}
      {...props}
    />
  );
}

export function PasswordInput({ className = '', id, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={`w-full border border-[#e4ddd0] rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-crest-gold/25 focus:border-crest-gold transition ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 touch-manipulation"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1.5">{children}</label>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm shadow-slate-200/40 ${className}`}>
      {children}
    </div>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'success' | 'error' | 'warning'; children: ReactNode }) {
  const tones = {
    info: 'bg-sky-50/80 border-sky-200/80 text-sky-950',
    success: 'bg-emerald-50/80 border-emerald-200/80 text-emerald-950',
    error: 'bg-red-50/80 border-red-200/80 text-red-950',
    warning: 'bg-amber-50/80 border-amber-200/80 text-amber-950',
  };
  return <div className={`border rounded-xl px-4 py-3.5 text-sm leading-relaxed ${tones[tone]}`}>{children}</div>;
}

export function Spinner({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      {label}
    </span>
  );
}
