import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import api from '../api';
import { NotificationBell } from './NotificationBell';
import OfferAcceptanceModal from '../components/OfferAcceptanceModal';
import { PassportPhoto } from '../components/PassportPhoto';
import { hasPendingAdmissionOffer } from '../lib/offer';
import { storageUrl } from '../lib/storage';

function CalendarIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z',
    apply: 'M9 12h6m-8 4h10M7 8h10M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    wizard: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
    status: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    invoices: 'M9 14l2 2 4-4M7 3h10a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z',
    profile: 'M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    wallet: 'M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm16 0V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2',
    academic: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z',
    documents: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z',
    clinic: 'M11 2v6H5v4h6v6h4v-6h6V8h-6V2h-4Z',
    hostel: 'M3 21h18M6 21V8l6-4 6 4v13M9 21v-6h6v6',
  };
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d={paths[name] || paths.home} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function navItems(auth: ReturnType<typeof useAuth>['auth']) {
  const items = [
    { to: '/', label: 'Home', icon: 'home', show: true },
    { to: '/apply', label: 'Apply', icon: 'apply', show: !auth?.is_student },
    { to: '/wizard', label: 'Application form', icon: 'wizard', show: auth?.portal_access && !auth?.is_student && ['fee_paid', 'form_in_progress'].includes(auth?.lifecycle_stage || '') },
    { to: '/status', label: hasPendingAdmissionOffer(auth) ? 'Accept offer' : 'Status', icon: 'status', show: !auth?.is_student && !!auth?.lifecycle_stage && auth.lifecycle_stage !== 'started' },
    { to: '/invoices', label: 'Transaction history', icon: 'invoices', show: true },
    { to: '/profile', label: 'My record', icon: 'profile', show: !!auth?.is_student },
    { to: '/wallet', label: 'Wallet', icon: 'wallet', show: !!auth?.is_student },
    { to: '/clinic', label: 'Clinic', icon: 'clinic', show: !!auth?.is_student },
    { to: '/hostel', label: 'Hostel', icon: 'hostel', show: !!auth?.is_student },
    { to: '/academic', label: 'Academic', icon: 'academic', show: !!auth?.is_student },
    { to: '/course-registration', label: 'Course registration', icon: 'academic', show: !!auth?.is_student },
    { to: '/documents', label: 'Documents', icon: 'documents', show: true },
  ];
  return items.filter((i) => i.show);
}

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/apply': 'Apply for admission',
  '/wizard': 'Application form',
  '/status': 'Application status',
  '/invoices': 'Transaction history',
  '/profile': 'My record',
  '/wallet': 'Wallet',
  '/clinic': 'Clinic',
  '/hostel': 'Hostel',
  '/academic': 'Academic',
  '/course-registration': 'Course registration',
  '/documents': 'Documents',
  '/announcements': 'Announcements',
  '/notifications': 'Notifications',
};

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function formatSemesterLabel(semester: string) {
  return /semester/i.test(semester) ? semester : `${semester} Semester`;
}

function sessionNavLabel(
  session?: string | null,
  semester?: string | null,
  kind?: string | null,
) {
  if (!session) return null;
  if (kind === 'application') {
    return `Application session: ${session}`;
  }
  if (semester) return `Admission session: ${session} - ${formatSemesterLabel(semester)}`;
  return `Admission session: ${session}`;
}

export function Shell() {
  const { auth, setAuth } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const items = navItems(auth);
  const pageTitle = pageTitles[location.pathname] || 'Student portal';

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [userMenuOpen]);

  const logout = async () => {
    setUserMenuOpen(false);
    try { await api.post('/api/logout'); } catch { /* ignore */ }
    sessionStorage.removeItem('bells_student_token');
    setAuth(null);
    nav('/login');
  };

  const sessionLabel = sessionNavLabel(
    auth?.current_session,
    auth?.current_semester,
    auth?.current_session_kind ?? (auth?.is_student ? 'admission' : 'application'),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white flex flex-col shadow-xl lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-[260px] lg:h-screen">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3 p-5" onClick={() => setMenuOpen(false)}>
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Bells crest" className="h-11 w-11 shrink-0 rounded-full bg-white ring-2 ring-white/20" />
            <div className="min-w-0">
              <div className="truncate font-semibold text-sm tracking-wide">Student portal</div>
              <div className="truncate text-xs text-slate-300">Bells University</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="mr-3 rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
        <nav className={`${menuOpen ? 'block' : 'hidden'} lg:flex lg:flex-col flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5 text-sm border-b border-white/10 lg:border-b-0`}>
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${
                  isActive
                    ? 'bg-white text-slate-900 font-medium shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <NavIcon name={i.icon} />
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden lg:block shrink-0 p-4 border-t border-white/10">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <PassportPhoto
              applicationId={auth?.application_id}
              src={auth?.nin_identity?.photo_url || storageUrl(auth?.nin_identity?.photo_path) || null}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover bg-sky-500"
              placeholder={(
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-semibold text-white">
                  {initials(auth?.user?.name)}
                </div>
              )}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{auth?.user?.name}</div>
              <div className="truncate text-xs text-slate-400">{auth?.user?.email}</div>
            </div>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex flex-col lg:ml-[260px] lg:min-h-screen">
        <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur flex items-center justify-between gap-3 px-4 md:px-8 py-3 sm:py-0 sm:h-16">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 hidden sm:block">
              {auth?.is_student ? 'Student portal' : 'Admissions'}
            </p>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{pageTitle}</h2>
            {sessionLabel && (
              <p className="text-xs text-slate-500 sm:hidden mt-0.5 flex items-center gap-1.5">
                <CalendarIcon />
                {sessionLabel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {sessionLabel && (
              <div
                className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200/80 bg-gradient-to-r from-slate-50 to-sky-50/90 px-3.5 py-1.5 text-xs shadow-sm"
                title={auth?.current_session_kind === 'application'
                  ? 'Current application session'
                  : 'Current admission session and semester'}
              >
                <CalendarIcon />
                <span className="font-semibold text-slate-800">{sessionLabel}</span>
              </div>
            )}
            <NotificationBell />
            <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-sky-700 text-xs font-semibold ring-offset-2 hover:bg-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition"
              aria-label="Account menu"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
            >
              <PassportPhoto
                applicationId={auth?.application_id}
                src={auth?.nin_identity?.photo_url || storageUrl(auth?.nin_identity?.photo_path) || null}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
                placeholder={initials(auth?.user?.name)}
              />
            </button>
            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white py-1 shadow-lg z-30"
              >
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <div className="truncate text-sm font-medium text-slate-900">{auth?.user?.name}</div>
                  <div className="truncate text-xs text-slate-500">{auth?.user?.email}</div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                >
                  Sign out
                </button>
              </div>
            )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
        <OfferAcceptanceModal />
      </div>
    </div>
  );
}

export default Shell;
