import type { CoinPokerHand, CoinPokerGameType } from './coinpokerParser';
import { selectNewHands } from '../../shared/coinpokerHands';

const ENDPOINT = '/api/coinpoker';

/** Keep well below Vercel Function's 4.5 MB request payload limit. */
export const COINPOKER_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

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

export interface UploadProgress {
  /** Number of hands acknowledged by the server so far. */
  completed: number;
  /** Total hands in this import. */
  total: number;
}

export interface UploadResult {
  /** Number of newly persisted hands, excluding server-side duplicates. */
  added: number;
}

function uploadBodyBytes(hands: CoinPokerHand[]): number {
  return new TextEncoder().encode(JSON.stringify({ hands })).byteLength;
}

/**
 * Split uploads by the UTF-8 size of the complete API envelope, rather than
 * hand count: raw hand text can vary dramatically in length.
 */
export function splitCoinPokerUploadBatches(hands: CoinPokerHand[]): CoinPokerHand[][] {
  const batches: CoinPokerHand[][] = [];
  let batch: CoinPokerHand[] = [];
  // `{"hands":[]}` is 12 bytes; each additional item after the first adds a comma.
  const emptyBodyBytes = uploadBodyBytes([]);
  let batchBytes = emptyBodyBytes;

  for (const hand of hands) {
    const handBytes = uploadBodyBytes([hand]) - emptyBodyBytes;
    if (emptyBodyBytes + handBytes > COINPOKER_UPLOAD_MAX_BYTES) {
      throw new Error('A single hand history is too large to upload.');
    }
    const nextBytes = batchBytes + handBytes + (batch.length > 0 ? 1 : 0);
    if (batch.length > 0 && nextBytes > COINPOKER_UPLOAD_MAX_BYTES) {
      batches.push(batch);
      batch = [hand];
      batchBytes = emptyBodyBytes + handBytes;
    } else {
      batch.push(hand);
      batchBytes = nextBytes;
    }
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
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

/** Persist upload-sized batches sequentially and report acknowledgement progress. */
export async function pushCoinPokerHands(
  hands: CoinPokerHand[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  const batches = splitCoinPokerUploadBatches(hands);
  let added = 0;
  let completed = 0;

  for (const batch of batches) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ hands: batch }),
    });
    if (!res.ok) throw new Error(`push failed: ${res.status}`);
    const result = (await res.json()) as Partial<UploadResult>;
    added += typeof result.added === 'number' ? result.added : 0;
    completed += batch.length;
    onProgress?.({ completed, total: hands.length });
  }

  return { added };
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
  const add = (existing: CoinPokerHand[], incoming: CoinPokerHand[]): CoinPokerHand[] =>
    [...existing, ...selectNewHands(existing, incoming)];
  return {
    cash: add(store.cash, hands.filter(h => h.gameType !== 'tournament')),
    tournament: add(store.tournament, hands.filter(h => h.gameType === 'tournament')),
  };
}

export { EMPTY as EMPTY_COINPOKER_STORE };
