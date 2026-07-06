import type { VercelRequest, VercelResponse } from '@vercel/node';
import { del, head, put } from '@vercel/blob';
import { getSessionUser } from './_lib/session.js';

interface StoredTransaction {
  id: string;
  [key: string]: unknown;
}

function blobPath(sub: string): string {
  const safe = sub.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `users/${safe}/transactions.json`;
}

async function readTransactions(path: string): Promise<StoredTransaction[]> {
  try {
    const meta = await head(path);
    const res = await fetch(`${meta.url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as StoredTransaction[]) : [];
  } catch {
    return [];
  }
}

async function writeTransactions(path: string, transactions: StoredTransaction[]): Promise<void> {
  await put(path, JSON.stringify(transactions), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

function mergeById(existing: StoredTransaction[], incoming: StoredTransaction[]): StoredTransaction[] {
  const byId = new Map<string, StoredTransaction>();
  for (const tx of existing) if (tx && typeof tx.id === 'string') byId.set(tx.id, tx);
  for (const tx of incoming) if (tx && typeof tx.id === 'string') byId.set(tx.id, tx);
  return [...byId.values()];
}

function cleanTransactions(value: unknown): StoredTransaction[] {
  return Array.isArray(value)
    ? (value as StoredTransaction[]).filter(tx => tx && typeof tx.id === 'string')
    : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const path = blobPath(user.sub);

  if (req.method === 'GET') {
    res.status(200).json(await readTransactions(path));
    return;
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { transactions?: unknown; clear?: unknown; replace?: unknown };

    if (body.clear === true) {
      try {
        const meta = await head(path);
        await del(meta.url);
      } catch {
        /* no existing blob */
      }
      res.status(200).json([]);
      return;
    }

    const incoming = cleanTransactions(body.transactions);
    if (body.replace === true) {
      await writeTransactions(path, incoming);
      res.status(200).json(incoming);
      return;
    }

    const merged = mergeById(await readTransactions(path), incoming);
    if (incoming.length > 0) await writeTransactions(path, merged);
    res.status(200).json(merged);
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
}
