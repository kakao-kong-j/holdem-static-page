import type { VercelRequest, VercelResponse } from '@vercel/node';
import { del, list, put } from '@vercel/blob';
import { getSessionUser } from './_lib/session';

type GameType = 'cash' | 'tournament';

/** Max hands per chunk file. Each upload's fresh hands are sliced into chunks. */
const CHUNK_SIZE = Number(process.env.COINPOKER_SHARD_SIZE) || 10_000;

/** Minimal shape we rely on for merging; the full CoinPokerHand lives in the frontend. */
interface StoredHand {
  handId: string;
  gameType?: GameType;
  [key: string]: unknown;
}

function safeSub(sub: string): string {
  // sub comes from the verified session, never from client input.
  return sub.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function chunkPrefix(sub: string, type: GameType): string {
  return `users/${safeSub(sub)}/coinpoker-${type}/`;
}

/**
 * Append-only: chunk files are immutable, never overwritten. This sidesteps
 * Vercel Blob's unreliable overwrite read-after-write. `list()` is eventually
 * consistent, but since we never overwrite and dedupe by handId on read, the
 * worst case is transient under-listing or a duplicate chunk on re-upload —
 * never data loss.
 */
async function readAll(sub: string, type: GameType): Promise<StoredHand[]> {
  const { blobs } = await list({ prefix: chunkPrefix(sub, type) });
  if (blobs.length === 0) return [];

  const parts = await Promise.all(
    blobs.map(async b => {
      try {
        const res = await fetch(b.url, { cache: 'no-store' });
        const data = res.ok ? ((await res.json()) as unknown) : [];
        return Array.isArray(data) ? (data as StoredHand[]) : [];
      } catch {
        return [];
      }
    }),
  );

  // Dedupe by handId across chunks (handles duplicate chunks from re-uploads).
  const seen = new Set<string>();
  const out: StoredHand[] = [];
  for (const part of parts) {
    for (const h of part) {
      if (h && typeof h.handId === 'string' && !seen.has(h.handId)) {
        seen.add(h.handId);
        out.push(h);
      }
    }
  }
  return out;
}

/** Write fresh hands as new immutable chunk files (sliced at CHUNK_SIZE). */
async function appendChunks(sub: string, type: GameType, fresh: StoredHand[]): Promise<void> {
  const batches: StoredHand[][] = [];
  for (let i = 0; i < fresh.length; i += CHUNK_SIZE) {
    batches.push(fresh.slice(i, i + CHUNK_SIZE));
  }
  await Promise.all(
    batches.map(batch =>
      put(`${chunkPrefix(sub, type)}chunk.json`, JSON.stringify(batch), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: true, // unique, immutable filename — never overwritten
        cacheControlMaxAge: 0,
      }),
    ),
  );
}

async function mergeType(sub: string, type: GameType, incoming: StoredHand[]): Promise<StoredHand[]> {
  const existing = await readAll(sub, type);
  const seen = new Set(existing.map(h => h.handId));
  const fresh = incoming.filter(h => !seen.has(h.handId));
  if (fresh.length > 0) await appendChunks(sub, type, fresh);
  return [...existing, ...fresh];
}

async function clearType(sub: string, type: GameType): Promise<void> {
  const { blobs } = await list({ prefix: chunkPrefix(sub, type) });
  if (blobs.length > 0) await del(blobs.map(b => b.url));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const sub = user.sub;

  if (req.method === 'GET') {
    const [cash, tournament] = await Promise.all([readAll(sub, 'cash'), readAll(sub, 'tournament')]);
    res.status(200).json({ cash, tournament });
    return;
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { hands?: unknown; clear?: unknown };

    if (body.clear === 'cash' || body.clear === 'tournament') {
      await clearType(sub, body.clear);
      res.status(200).json({ cash: await readAll(sub, 'cash'), tournament: await readAll(sub, 'tournament') });
      return;
    }

    const incoming: StoredHand[] = Array.isArray(body.hands)
      ? (body.hands as StoredHand[]).filter(h => h && typeof h.handId === 'string')
      : [];
    const incomingCash = incoming.filter(h => h.gameType !== 'tournament');
    const incomingTournament = incoming.filter(h => h.gameType === 'tournament');

    const [cash, tournament] = await Promise.all([
      incomingCash.length ? mergeType(sub, 'cash', incomingCash) : readAll(sub, 'cash'),
      incomingTournament.length ? mergeType(sub, 'tournament', incomingTournament) : readAll(sub, 'tournament'),
    ]);

    res.status(200).json({ cash, tournament });
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
}
