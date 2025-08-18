import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContextInternal';
import { supabase } from '../lib/supabaseClient';

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  roles?: string[];
  // Add other claims as needed
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  setUser: (user: AuthUser | null) => void;
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (role: string) => boolean;
}

async function fetchCurrentUser(): Promise<AuthUser | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[Auth] session error', error.message);
    return null;
  }
  const user = session?.user;
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || undefined,
    name: user.user_metadata?.name || user.user_metadata?.full_name || undefined,
    avatarUrl: user.user_metadata?.avatar_url,
    roles: (user.app_metadata?.roles as string[]) || []
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const u = await fetchCurrentUser();
      setUser(u);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Supabase v2 returns { data: { subscription } }
    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      const u = session?.user;
      setUser(u ? {
        id: u.id,
        email: u.email || undefined,
        name: u.user_metadata?.name || u.user_metadata?.full_name || undefined,
        avatarUrl: u.user_metadata?.avatar_url,
        roles: (u.app_metadata?.roles as string[]) || []
      } : null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [load]);

  // Bridge auth state to window for legacy/services access without React imports
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__ARCHON_AUTH__ = { user };
    }
  }, [user]);

  const hasRole = useCallback((role: string) => {
    return !!user?.roles?.includes(role);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, error, setUser, refresh: load, isAuthenticated: !!user, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};
export default AuthContext;
