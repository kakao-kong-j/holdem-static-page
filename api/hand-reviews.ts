import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BlobNotFoundError, head, put } from '@vercel/blob';
import { getSessionUser } from './_lib/session.js';
import { isMutation, isReview, reviewKey, type HandReview } from '../shared/handReviews.js';

async function readReviews(path: string): Promise<HandReview[]> {
  let url: string;
  try { url = (await head(path)).url; }
  catch (error) {
    if (error instanceof BlobNotFoundError) return [];
    throw error;
  }
  const response = await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('review read failed');
  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(isReview)) throw new Error('invalid review storage');
  return data;
}
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const user = await getSessionUser(req);
  res.setHeader?.('Cache-Control', 'no-store');
  if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  const mutation: unknown = req.body;
  if (req.method === 'POST' && !isMutation(mutation)) { res.status(400).json({ error: 'invalid review' }); return; }
  const path = `users/${user.sub.replace(/[^a-zA-Z0-9_-]/g, '_')}/hand-reviews.json`;
  try {
    let reviews = await readReviews(path);
    if (req.method === 'POST' && isMutation(mutation)) {
      const now = new Date().toISOString();
      if (mutation.action === 'save') {
        const key = reviewKey(mutation.snapshot);
        if (!reviews.some(r => r.key === key)) {
          if (reviews.length >= 500) { res.status(409).json({ error: '복기 노트는 최대 500개입니다. 기존 노트를 정리해 주세요.' }); return; }
          // Pick fields explicitly; do not persist arbitrary client properties.
          const { handId, gameType, rawText, heroHand, heroPosition, startedAt } = mutation.snapshot;
          reviews = [{ key, snapshot: { handId, gameType, rawText, heroHand, heroPosition, startedAt }, thoughts: '', conclusion: '', status: 'pending', createdAt: now, updatedAt: now }, ...reviews];
        } else { res.status(200).json({ reviews }); return; }
      } else {
        if (!reviews.some(r => r.key === mutation.key)) { res.status(404).json({ error: 'review not found' }); return; }
        reviews = mutation.action === 'delete' ? reviews.filter(r => r.key !== mutation.key)
          : reviews.map(r => r.key === mutation.key ? { ...r, thoughts: mutation.thoughts, conclusion: mutation.conclusion, status: mutation.status, updatedAt: now } : r);
      }
      const serialized = JSON.stringify(reviews);
      if (Buffer.byteLength(serialized, 'utf8') > 3_000_000) { res.status(409).json({ error: '복기 노트 저장 용량(3 MB)을 초과했습니다. 기존 노트를 정리해 주세요.' }); return; }
      await put(path, serialized, { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
    }
    res.status(200).json({ reviews });
  } catch { res.status(503).json({ error: '복기 노트 저장소에 연결할 수 없습니다. 다시 시도해 주세요.' }); }
}
