import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

type Props = {
  title: string;
  subtitle: string;
  kicker?: string;
  children: ReactNode;
  footer?: ReactNode;
};

type PortalInfo = {
  admissions_email: string;
  admissions_phone: string;
};

const logo = `${import.meta.env.BASE_URL}logo.png`;

export default function AuthLayout({ title, subtitle, kicker = 'Student admissions', children, footer }: Props) {
  const [contact, setContact] = useState<PortalInfo | null>(null);

  useEffect(() => {
    api
      .get<PortalInfo>('/api/portal-info')
      .then(({ data }) => setContact({
        admissions_email: (data.admissions_email || '').trim(),
        admissions_phone: (data.admissions_phone || '').trim(),
      }))
      .catch(() => setContact({ admissions_email: '', admissions_phone: '' }));
  }, []);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-brand lg:flex flex-col justify-between px-12 py-12 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 12%, rgba(201,162,39,0.28), transparent 36%), radial-gradient(circle at 88% 78%, rgba(22,101,52,0.35), transparent 42%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-crest-gold via-[#f0d789] to-crest-gold" />

        <div className="relative">
          <div className="flex items-center gap-4">
            <img
              src={logo}
              alt="Bells University of Technology crest"
              className="h-20 w-20 rounded-full bg-white p-1 shadow-xl ring-2 ring-crest-gold/80"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e8d48a]">Est. 2005 · Ota, Nigeria</p>
              <p className="mt-1 text-sm text-sky-100/80">Official applicant portal</p>
            </div>
          </div>
          <h1 className="mt-10 max-w-xl font-serif text-4xl leading-tight font-medium tracking-tight">
            Bells University of Technology
            <span className="mx-3 font-sans text-xl font-normal text-crest-gold/70" aria-hidden>
              ·
            </span>
            <span className="font-serif text-2xl italic font-normal text-[#f0d789]">Chords of Knowledge</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-sky-100/85">
            A secure portal for applications, admission status, and enrolment services.
          </p>
          <div className="mt-10 flex flex-wrap gap-2">
            {['Apply online', 'Track status', 'Pay securely'].map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-medium text-sky-50"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <AdmissionsContact contact={contact} />
      </aside>

      <main className="relative flex items-center justify-center bg-parchment px-4 py-8 sm:px-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage: 'radial-gradient(ellipse at top right, rgba(10,35,66,0.06), transparent 42%)',
          }}
        />
        <div className="relative w-full max-w-[440px]">
          <div className="mb-7 text-center lg:hidden">
            <img
              src={logo}
              alt="Bells University of Technology crest"
              className="mx-auto h-[4.5rem] w-[4.5rem] rounded-full bg-white p-1 shadow-md ring-2 ring-crest-gold/70"
            />
            <p className="mt-3 font-serif text-xl text-brand">
              Bells University of Technology
              <span className="mx-2 text-sm text-crest-gold/80" aria-hidden>·</span>
              <span className="font-serif text-base italic text-[#8a7320]">Chords of Knowledge</span>
            </p>
            <AdmissionsContact contact={contact} compact />
          </div>

          <div className="overflow-hidden rounded-3xl border border-[#e4ddd0] bg-white shadow-[0_24px_60px_-28px_rgba(7,26,51,0.35)]">
            <div className="h-1 bg-linear-to-r from-brand via-crest-gold to-crest-green" />
            <div className="p-6 sm:p-9">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a7320]">{kicker}</p>
              <h2 className="mt-2 font-serif text-[1.7rem] leading-tight text-brand">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{subtitle}</p>
              <div className="mt-7">{children}</div>
              {footer && <div className="mt-7 border-t border-[#eee8dc] pt-5 text-center text-sm">{footer}</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function AdmissionsContact({ contact, compact = false }: { contact: PortalInfo | null; compact?: boolean }) {
  if (!contact) return null;
  const email = contact.admissions_email;
  const phone = contact.admissions_phone;
  if (!email && !phone) return null;

  if (compact) {
    return (
      <p className="mt-4 text-xs text-slate-500">
        {email && (
          <a href={`mailto:${email}`} className="font-medium text-brand hover:text-crest-gold">
            {email}
          </a>
        )}
        {email && phone ? <span className="mx-1.5 text-slate-300">·</span> : null}
        {phone && (
          <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-brand">
            {phone}
          </a>
        )}
      </p>
    );
  }

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8d48a]">Admissions contact</p>
      {email && (
        <a href={`mailto:${email}`} className="mt-3 block text-sm font-medium text-white hover:text-[#f0d789]">
          {email}
        </a>
      )}
      {phone && (
        <a href={`tel:${phone.replace(/\s+/g, '')}`} className="mt-1 block text-sm text-sky-100/80 hover:text-white">
          {phone}
        </a>
      )}
    </div>
  );
}

export function AuthLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`font-semibold text-brand hover:text-crest-gold transition ${className}`}>
      {children}
    </Link>
  );
}

export const authPrimaryClass =
  'w-full h-11 rounded-xl bg-brand hover:bg-brand-dark text-white shadow-md shadow-brand/20';
