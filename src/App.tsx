import { Navigate, Route, Routes } from 'react-router-dom';
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
import CourseRegistration from './pages/CourseRegistration';
import Announcements from './pages/Announcements';
import Notifications from './pages/Notifications';
import Referee from './pages/Referee';
import NotFound from './pages/NotFound';

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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<Forgot />} />
      <Route path="/reset-password" element={<Reset />} />
      <Route path="/referee/:token" element={<Referee />} />
      <Route path="/payments/callback" element={<PaymentCallback />} />
      <Route path="/" element={<Guard><Shell /></Guard>}>
        <Route index element={<Home />} />
        <Route path="apply" element={<Apply />} />
        <Route path="wizard" element={<FeeGuard><Wizard /></FeeGuard>} />
        <Route path="status" element={<Status />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="profile" element={<Profile />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="clinic" element={<Clinic />} />
        <Route path="hostel" element={<Hostel />} />
        <Route path="academic" element={<Academic />} />
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
