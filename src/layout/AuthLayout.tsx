import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-sky-600 to-sky-800 text-white p-10">
        <div>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Bells crest" className="h-24 w-24 rounded-full bg-white p-1" />
          <h1 className="mt-6 text-3xl font-bold">Bells University of Technology</h1>
          <p className="mt-2 text-sky-100 max-w-md">
            Welcome to the student admission portal. Create your account to begin your application journey.
          </p>
          <p className="mt-4 text-green-200 font-medium">Chords of Knowledge</p>
        </div>
        <div className="bg-white/10 rounded-xl p-4 text-sm space-y-2">
          <p className="font-semibold">Admissions contact</p>
          <p>admissions@bellsuniversity.edu.ng</p>
          <p>+234 801 000 0000</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg">
          <div className="lg:hidden text-center mb-6">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Bells crest" className="h-16 w-16 mx-auto rounded-full bg-white shadow" />
          </div>
          <div className="bg-white rounded-2xl shadow-lg border p-5 sm:p-8">
            <h2 className="text-2xl font-semibold text-slate-800">{title}</h2>
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`text-sky-600 font-medium hover:underline ${className}`}>
      {children}
    </Link>
  );
}
