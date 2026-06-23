import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuth, type SessionUser } from './useAuth';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function AuthProbe() {
  const auth = useAuth();
  return <pre data-testid="auth-state">{JSON.stringify(auth)}</pre>;
}

function renderAuthProbe() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<AuthProbe />);
  });

  return {
    readState() {
      const text = container.querySelector('[data-testid="auth-state"]')?.textContent;
      if (!text) throw new Error('auth state was not rendered');
      return JSON.parse(text) as {
        user: SessionUser | null;
        isAuthenticated: boolean;
        checking: boolean;
      };
    },
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useAuth', () => {
  let rendered: { cleanup: () => void } | undefined;

  afterEach(() => {
    rendered?.cleanup();
    rendered = undefined;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses a mock authenticated user in local development bypass mode without calling the auth API', async () => {
    vi.stubEnv('VITE_LOCAL_AUTH_BYPASS', '1');
    const fetchSpy = vi.fn(async () => ({ ok: false }));
    vi.stubGlobal('fetch', fetchSpy);

    const view = renderAuthProbe();
    rendered = view;
    await flushEffects();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(view.readState()).toEqual({
      checking: false,
      isAuthenticated: true,
      user: {
        sub: 'local-dev',
        name: 'Local Dev',
        email: 'local@example.com',
      },
    });
  });
});
