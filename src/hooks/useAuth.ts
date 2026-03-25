import { useState, useCallback } from 'react';

const PASSWORD_HASH = import.meta.env.VITE_PASSWORD_HASH;
if (!PASSWORD_HASH) {
  console.error('[auth] VITE_PASSWORD_HASH is not set — authentication will always fail.');
}
const AUTH_STORAGE_KEY = 'holdem_auth';

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  );

  const login = useCallback(async (password: string): Promise<boolean> => {
    const hash = await sha256(password);
    if (hash === PASSWORD_HASH) {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  return { isAuthenticated, login };
}
