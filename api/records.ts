import type { VercelRequest, VercelResponse } from '@vercel/node';
import { head, put } from '@vercel/blob';
import { getSessionUser } from './_lib/session';

/** Minimal shape we rely on for merging; the full QuizRecord lives in the frontend. */
interface StoredRecord {
  timestamp: number;
  [key: string]: unknown;
}

function blobPath(sub: string): string {
  // sub comes from the verified session, never from client input.
  const safe = sub.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `users/${safe}/records.json`;
}

async function readRecords(path: string): Promise<StoredRecord[]> {
  try {
    const meta = await head(path);
    // Cache-bust: an overwritten fixed-path blob is served stale from the CDN
    // even with cacheControlMaxAge:0, which would corrupt the next merge.
    const res = await fetch(`${meta.url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as StoredRecord[]) : [];
  } catch {
    // BlobNotFoundError (first write) or any read error → treat as empty.
    return [];
  }
}

async function writeRecords(path: string, records: StoredRecord[]): Promise<void> {
  await put(path, JSON.stringify(records), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const path = blobPath(user.sub);

  if (req.method === 'GET') {
    const records = await readRecords(path);
    res.status(200).json({ records });
    return;
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { records?: unknown; mode?: unknown };
    const incoming: StoredRecord[] = Array.isArray(body.records)
      ? (body.records as StoredRecord[]).filter(r => r && typeof r.timestamp === 'number')
      : [];
    const mode = body.mode === 'replace' ? 'replace' : 'merge';

    let merged: StoredRecord[];
    if (mode === 'replace') {
      merged = incoming;
    } else {
      const existing = await readRecords(path);
      const seen = new Set(existing.map(r => r.timestamp));
      merged = [...existing, ...incoming.filter(r => !seen.has(r.timestamp))];
    }

    await writeRecords(path, merged);
    res.status(200).json({ records: merged });
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
}
