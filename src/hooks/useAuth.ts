import { useState, useEffect, useCallback } from 'react';

export interface SessionUser {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then((data: { user?: SessionUser } | null) => {
        if (!cancelled) setUser(data?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    window.location.href = '/api/auth/google';
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore network errors — clear locally regardless */
    }
    setUser(null);
    window.location.reload();
  }, []);

  return { user, isAuthenticated: !!user, checking, login, logout };
}
