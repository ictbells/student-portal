import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Shell } from './layout/Shell';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Forgot from './pages/Forgot';
import Reset from './pages/Reset';
import Home from './pages/Home';
import Apply from './pages/Apply';
import PaymentCallback from './pages/PaymentCallback';
import Wizard from './pages/Wizard';
import Status from './pages/Status';
import { WalletPage, Invoices, Documents, Academic } from './pages/Modules';
import Clinic from './pages/Clinic';
import Hostel from './pages/Hostel';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword';
import CourseRegistration from './pages/CourseRegistration';
import Announcements from './pages/Announcements';
import Notifications from './pages/Notifications';
import Referee from './pages/Referee';
import NotFound from './pages/NotFound';
import TranscriptRequestPage from './pages/TranscriptRequest';
import TranscriptRequestCallback from './pages/TranscriptRequestCallback';
import RequestPayPage from './pages/RequestPay';
import RequestPayCallback from './pages/RequestPayCallback';
import UnsignedTranscript from './pages/UnsignedTranscript';
import FinancialStatus from './pages/FinancialStatus';
import VerifyNin from './pages/VerifyNin';

function Guard({ children }: { children: React.ReactNode }) {
  const { auth, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-500">Loading…</div>;
  if (!auth) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function FeeGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  if (!auth?.portal_access && auth?.unpaid_application_fee) {
    return <Navigate to="/apply" replace />;
  }
  return <>{children}</>;
}

function StudentNinGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const location = useLocation();
  if (auth?.is_student && auth.nin_verified !== true) {
    const allowed = location.pathname === '/verify-nin' || location.pathname === '/change-password';
    if (!allowed) {
      return <Navigate to="/verify-nin" replace />;
    }
  }
  if (auth?.is_student && auth.nin_verified && location.pathname === '/verify-nin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<Forgot />} />
      <Route path="/reset-password" element={<Reset />} />
      <Route path="/referee/:token" element={<Referee />} />
      <Route path="/payments/callback" element={<PaymentCallback />} />
      <Route path="/transcript-request" element={<TranscriptRequestPage />} />
      <Route path="/transcript-request/callback" element={<TranscriptRequestCallback />} />
      <Route path="/transcript-request/:channel" element={<TranscriptRequestPage />} />
      <Route path="/request-pay" element={<RequestPayPage />} />
      <Route path="/request-pay/callback" element={<RequestPayCallback />} />
      <Route path="/" element={<Guard><StudentNinGuard><Shell /></StudentNinGuard></Guard>}>
        <Route index element={<Home />} />
        <Route path="apply" element={<Apply />} />
        <Route path="verify-nin" element={<VerifyNin />} />
        <Route path="wizard" element={<FeeGuard><Wizard /></FeeGuard>} />
        <Route path="status" element={<Status />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="finance-status" element={<FinancialStatus />} />
        <Route path="profile" element={<Profile />} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="clinic" element={<Clinic />} />
        <Route path="hostel" element={<Hostel />} />
        <Route path="academic" element={<Academic />} />
        <Route path="academic/unsigned-transcript" element={<UnsignedTranscript />} />
        <Route path="course-registration" element={<CourseRegistration />} />
        <Route path="documents" element={<Documents />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
