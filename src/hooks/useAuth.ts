import { useState, useEffect, useCallback } from 'react';

export interface SessionUser {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

const LOCAL_DEV_USER: SessionUser = {
  sub: 'local-dev',
  name: 'Local Dev',
  email: 'local@example.com',
};

function isLocalAuthBypass(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_LOCAL_AUTH_BYPASS === '1';
}

export function useAuth() {
  const localAuthBypass = isLocalAuthBypass();
  const [user, setUser] = useState<SessionUser | null>(localAuthBypass ? LOCAL_DEV_USER : null);
  const [checking, setChecking] = useState(!localAuthBypass);

  useEffect(() => {
    if (localAuthBypass) return;

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
  }, [localAuthBypass]);

  const logout = useCallback(async () => {
    if (localAuthBypass) {
      setUser(LOCAL_DEV_USER);
      return;
    }

    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore network errors — clear locally regardless */
    }
    setUser(null);
    window.location.reload();
  }, [localAuthBypass]);

  return { user, isAuthenticated: !!user, checking, logout };
}
