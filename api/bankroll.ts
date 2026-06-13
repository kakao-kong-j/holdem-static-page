import type { VercelRequest, VercelResponse } from '@vercel/node';
import { del, head, put } from '@vercel/blob';
import { getSessionUser } from './_lib/session.js';

type Kind = 'cash' | 'tournament';

/**
 * Minimal shape we rely on for merging; the full BankrollSession lives in the
 * frontend. `id` is the dedupe key (cash → internal_ref, tournament →
 * tournament_id) so re-importing an existing tournament overwrites in place.
 */
interface StoredSession {
  id: string;
  kind?: Kind;
  [key: string]: unknown;
}

function blobPath(sub: string, kind: Kind): string {
  // sub comes from the verified session, never from client input.
  const safe = sub.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `users/${safe}/bankroll-${kind}.json`;
}

async function readSessions(path: string): Promise<StoredSession[]> {
  try {
    const meta = await head(path);
    // Cache-bust: an overwritten fixed-path blob is served stale from the CDN
    // even with cacheControlMaxAge:0, which would corrupt the next merge.
    const res = await fetch(`${meta.url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as StoredSession[]) : [];
  } catch {
    // BlobNotFoundError (first write) or any read error → treat as empty.
    return [];
  }
}

async function writeSessions(path: string, sessions: StoredSession[]): Promise<void> {
  await put(path, JSON.stringify(sessions), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

/** Merge by id; incoming overwrites an existing session with the same id. */
function mergeById(existing: StoredSession[], incoming: StoredSession[]): StoredSession[] {
  const byId = new Map<string, StoredSession>();
  for (const s of existing) if (s && typeof s.id === 'string') byId.set(s.id, s);
  for (const s of incoming) if (s && typeof s.id === 'string') byId.set(s.id, s);
  return [...byId.values()];
}

/** Merge incoming into one type's file. No-op write when incoming is empty. */
async function mergeKind(sub: string, kind: Kind, incoming: StoredSession[]): Promise<StoredSession[]> {
  const path = blobPath(sub, kind);
  const existing = await readSessions(path);
  if (incoming.length === 0) return existing;
  const merged = mergeById(existing, incoming);
  await writeSessions(path, merged);
  return merged;
}

async function clearKind(sub: string, kind: Kind): Promise<void> {
  try {
    const meta = await head(blobPath(sub, kind));
    await del(meta.url);
  } catch {
    /* nothing stored yet → nothing to delete */
  }
}

async function readBoth(sub: string): Promise<{ cash: StoredSession[]; tournament: StoredSession[] }> {
  const [cash, tournament] = await Promise.all([
    readSessions(blobPath(sub, 'cash')),
    readSessions(blobPath(sub, 'tournament')),
  ]);
  return { cash, tournament };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const sub = user.sub;

  if (req.method === 'GET') {
    res.status(200).json(await readBoth(sub));
    return;
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { sessions?: unknown; clear?: unknown };

    if (body.clear === 'cash' || body.clear === 'tournament' || body.clear === 'all') {
      // Return the post-clear state directly. Re-reading via head() right after
      // del() can hit Blob's eventual consistency and resurrect deleted data,
      // so we only re-read the type that was NOT cleared.
      if (body.clear === 'all') {
        await Promise.all([clearKind(sub, 'cash'), clearKind(sub, 'tournament')]);
        res.status(200).json({ cash: [], tournament: [] });
        return;
      }
      await clearKind(sub, body.clear);
      const other = body.clear === 'cash' ? 'tournament' : 'cash';
      const otherSessions = await readSessions(blobPath(sub, other));
      res.status(200).json({
        cash: body.clear === 'cash' ? [] : otherSessions,
        tournament: body.clear === 'tournament' ? [] : otherSessions,
      });
      return;
    }

    const all: StoredSession[] = Array.isArray(body.sessions)
      ? (body.sessions as StoredSession[]).filter(s => s && typeof s.id === 'string')
      : [];
    const incomingCash = all.filter(s => s.kind === 'cash');
    const incomingTournament = all.filter(s => s.kind === 'tournament');

    const [cash, tournament] = await Promise.all([
      mergeKind(sub, 'cash', incomingCash),
      mergeKind(sub, 'tournament', incomingTournament),
    ]);
    res.status(200).json({ cash, tournament });
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
}
