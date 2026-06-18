import type { BankrollSession } from './bankroll';

const ENDPOINT = '/api/bankroll';

export interface BankrollStore {
  cash: BankrollSession[];
  tournament: BankrollSession[];
}

export const EMPTY_BANKROLL_STORE: BankrollStore = { cash: [], tournament: [] };

function normalize(data: unknown): BankrollStore {
  const d = (data ?? {}) as Partial<BankrollStore>;
  return {
    cash: Array.isArray(d.cash) ? d.cash : [],
    tournament: Array.isArray(d.tournament) ? d.tournament : [],
  };
}

export function flattenStore(store: BankrollStore): BankrollSession[] {
  return [...store.cash, ...store.tournament];
}

/** Load the stored cash + tournament sessions for the logged-in user. */
export async function fetchBankrollSessions(): Promise<BankrollStore> {
  const res = await fetch(ENDPOINT, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return normalize(await res.json());
}

/**
 * Merge the given sessions into the server store (dedupe by id, per type) and
 * return the merged union. The server keeps one cash file and one tournament
 * file and overwrites same-id sessions in place.
 */
export async function pushBankrollSessions(sessions: BankrollSession[]): Promise<BankrollStore> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sessions }),
  });
  if (!res.ok) throw new Error(`push failed: ${res.status}`);
  return normalize(await res.json());
}

/** Replace one stored session list exactly; used after deleting records. */
export async function replaceBankrollSessions(
  kind: 'cash' | 'tournament',
  sessions: BankrollSession[],
): Promise<BankrollStore> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ replace: kind, sessions }),
  });
  if (!res.ok) throw new Error(`replace failed: ${res.status}`);
  return normalize(await res.json());
}

/** Delete the stored sessions for one type (or all). Returns the new store. */
export async function clearBankroll(kind: 'cash' | 'tournament' | 'all'): Promise<BankrollStore> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ clear: kind }),
  });
  if (!res.ok) throw new Error(`clear failed: ${res.status}`);
  return normalize(await res.json());
}
