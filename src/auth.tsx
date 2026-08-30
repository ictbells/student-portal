import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from './api';

export type AuthState = {
  user: any;
  roles: { id: number; name: string; slug: string }[];
  permissions: string[];
  portal_access: boolean;
  is_student: boolean;
  student_status?: string | null;
  can_apply_again?: boolean;
  is_staff?: boolean;
  lifecycle_stage?: string;
  unpaid_application_fee?: boolean;
  unpaid_acceptance_fee?: boolean;
  application_id?: number;
  nin_verified?: boolean;
  programme_fee_set?: boolean;
  programme_fee_total?: number | null;
  university: { name: string; motto: string };
  current_session?: string | null;
  current_semester?: string | null;
  current_session_kind?: 'application' | 'admission' | string | null;
  current_term?: {
    id?: number | null;
    name?: string | null;
    session_label?: string | null;
    registration_status?: string | null;
    normal_registration_closes_at?: string | null;
    late_registration_closes_at?: string | null;
  } | null;
  nin_identity?: {
    nin: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    date_of_birth?: string;
    gender?: string;
    photo_path?: string | null;
    photo_url?: string | null;
  } | null;
};

const Ctx = createContext<{
  auth: AuthState | null;
  loading: boolean;
  has: (key: string) => boolean;
  refresh: () => Promise<void>;
  setAuth: (a: AuthState | null) => void;
}>({ auth: null, loading: true, has: () => false, refresh: async () => {}, setAuth: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!sessionStorage.getItem('bells_student_token')) {
      setAuth(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/api/me');
      setAuth(data);
    } catch {
      setAuth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(
    () => ({
      auth,
      loading,
      setAuth,
      refresh,
      has: (key: string) => !!auth?.permissions?.includes(key),
    }),
    [auth, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
