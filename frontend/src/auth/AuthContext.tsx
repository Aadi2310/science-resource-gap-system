import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { Role, UserSession } from '../types';

interface AuthContextValue {
  user: UserSession | null;
  loading: boolean;
  signIn(email: string, password: string, demoRole: Role): Promise<UserSession>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
function readSession(): UserSession | null {
  try { return JSON.parse(localStorage.getItem('srg_user') ?? 'null') as UserSession | null; } catch { return null; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(readSession);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.auth.restoreSession().then((session) => {
      if (active) {
        setUser(session);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async signIn(email, password, role) { const session = await api.auth.login(email, password, role); setUser(session); return session; },
    async signOut() { await api.auth.logout(); setUser(null); },
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
