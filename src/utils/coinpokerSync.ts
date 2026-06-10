import type { CoinPokerHand, CoinPokerGameType } from './coinpokerParser';

const ENDPOINT = '/api/coinpoker';

export interface CoinPokerStore {
  cash: CoinPokerHand[];
  tournament: CoinPokerHand[];
}

const EMPTY: CoinPokerStore = { cash: [], tournament: [] };

function normalize(data: unknown): CoinPokerStore {
  const d = (data ?? {}) as Partial<CoinPokerStore>;
  return {
    cash: Array.isArray(d.cash) ? d.cash : [],
    tournament: Array.isArray(d.tournament) ? d.tournament : [],
  };
}

export interface LoadProgress {
  /** Bytes downloaded so far. */
  received: number;
  /** Total bytes if the server sent Content-Length, else null (indeterminate). */
  total: number | null;
}

/**
 * Load accumulated hands (both game types) from the server, streaming the
 * response body so callers can show download progress.
 */
export async function fetchCoinPokerHands(onProgress?: (p: LoadProgress) => void): Promise<CoinPokerStore> {
  const res = await fetch(ENDPOINT, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);

  const total = Number(res.headers.get('Content-Length')) || null;
  if (!onProgress || !res.body) {
    return normalize(await res.json());
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  onProgress({ received: 0, total });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress({ received, total });
    }
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return normalize(JSON.parse(new TextDecoder().decode(merged)));
}

/** Merge uploaded hands into the server store (deduped by handId), return the merged union. */
export async function pushCoinPokerHands(hands: CoinPokerHand[]): Promise<CoinPokerStore> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ hands }),
  });
  if (!res.ok) throw new Error(`push failed: ${res.status}`);
  return normalize(await res.json());
}

/** Clear one game type on the server, return the resulting store. */
export async function clearCoinPokerHands(type: CoinPokerGameType): Promise<CoinPokerStore> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ clear: type }),
  });
  if (!res.ok) throw new Error(`clear failed: ${res.status}`);
  return normalize(await res.json());
}

/** Client-side merge (dedupe by handId) for optimistic updates / offline fallback. */
export function mergeCoinPokerStore(store: CoinPokerStore, hands: CoinPokerHand[]): CoinPokerStore {
  const add = (existing: CoinPokerHand[], incoming: CoinPokerHand[]): CoinPokerHand[] => {
    const seen = new Set(existing.map(h => h.handId));
    return [...existing, ...incoming.filter(h => !seen.has(h.handId))];
  };
  return {
    cash: add(store.cash, hands.filter(h => h.gameType !== 'tournament')),
    tournament: add(store.tournament, hands.filter(h => h.gameType === 'tournament')),
  };
}

export { EMPTY as EMPTY_COINPOKER_STORE };
