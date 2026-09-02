import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { AppUser, UserRole } from '@/lib/types';

interface AuthState {
  user: AppUser | null;
  profile: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ error: string | null }>;
  signInDemo: () => Promise<{ error: string | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const STORAGE_KEY = 'ae_demo_session';

const DEMO_ADMIN: AppUser = {
  id: 'f36ef19c-9983-4392-aa3d-21c5587b442a',
  full_name: 'Amir Ali (Admin)',
  role: 'admin',
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(DEMO_ADMIN);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Direct demo access still works when browser storage is unavailable.
    }
  }, []);

  const signInDemo = useCallback(async () => {
    setUser(DEMO_ADMIN);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Direct demo access still works when browser storage is unavailable.
    }
    return { error: null };
  }, []);

  const signIn = useCallback(async () => signInDemo(), [signInDemo]);
  const signUp = useCallback(async () => signInDemo(), [signInDemo]);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  }, []);

  const value: AuthState = {
    user,
    profile: user,
    loading,
    isAdmin: true,
    signIn,
    signUp,
    signInDemo,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
