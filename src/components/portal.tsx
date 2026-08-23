import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 mb-1">{eyebrow}</p>}
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-slate-600 mt-1.5 max-w-2xl leading-relaxed">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type Step = { key: string; title: string };

export function StepIndicator({
  steps,
  currentIndex,
  onStepClick,
  isStepLocked,
  isStepComplete,
}: {
  steps: Step[];
  currentIndex: number;
  onStepClick: (index: number) => void;
  isStepLocked: (index: number) => boolean;
  isStepComplete: (index: number) => boolean;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-0">
        {steps.map((step, index) => {
          const locked = isStepLocked(index);
          const complete = isStepComplete(index);
          const active = index === currentIndex;
          const last = index === steps.length - 1;

          return (
            <li key={step.key} className="flex items-center">
              <button
                type="button"
                onClick={() => onStepClick(index)}
                disabled={locked}
                className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                  locked ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/80'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-offset-2 ring-offset-slate-50 transition ${
                    active
                      ? 'bg-sky-600 text-white ring-sky-200'
                      : complete
                        ? 'bg-emerald-600 text-white ring-emerald-100'
                        : 'bg-white text-slate-500 ring-slate-200'
                  }`}
                >
                  {complete && !active ? '✓' : index + 1}
                </span>
                <span
                  className={`hidden sm:block text-left text-sm leading-tight max-w-[9rem] ${
                    active ? 'font-semibold text-slate-900' : complete ? 'text-emerald-800' : 'text-slate-500'
                  }`}
                >
                  {step.title}
                </span>
              </button>
              {!last && (
                <div
                  className={`mx-1 h-0.5 w-6 sm:w-10 rounded-full ${
                    complete ? 'bg-emerald-300' : 'bg-slate-200'
                  }`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function IdentityCard({
  photoUrl,
  name,
  nin,
  gender,
  dateOfBirth,
  verified = true,
}: {
  photoUrl?: string | null;
  name: string;
  nin?: string;
  gender?: string;
  dateOfBirth?: string;
  verified?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        <div className="shrink-0 mx-auto sm:mx-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Passport photograph"
              className="h-32 w-28 rounded-xl border-2 border-white shadow-md object-cover bg-slate-100"
            />
          ) : (
            <div className="h-32 w-28 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-xs text-slate-400 text-center px-2">
              No photo
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
            <h3 className="text-lg font-semibold text-slate-900">{name || '—'}</h3>
            {verified && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                NIN verified
              </span>
            )}
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {nin && (
              <div>
                <dt className="text-slate-500">NIN</dt>
                <dd className="font-medium text-slate-800 font-mono">{nin}</dd>
              </div>
            )}
            {gender && (
              <div>
                <dt className="text-slate-500">Gender</dt>
                <dd className="font-medium text-slate-800">{gender}</dd>
              </div>
            )}
            {dateOfBirth && (
              <div>
                <dt className="text-slate-500">Date of birth</dt>
                <dd className="font-medium text-slate-800">{dateOfBirth}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="text-xs text-slate-500 mb-2" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 && <span className="mx-1.5 text-slate-300">/</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-sky-600 transition">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-700 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
