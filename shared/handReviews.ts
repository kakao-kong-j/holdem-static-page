export interface HandSnapshot {
  handId: string;
  gameType: 'cash' | 'tournament';
  rawText: string;
  heroHand: string;
  heroPosition: string;
  startedAt: string;
}
export interface HandReview {
  key: string;
  snapshot: HandSnapshot;
  thoughts: string;
  conclusion: string;
  status: 'pending' | 'completed';
  createdAt: string;
  updatedAt: string;
}
export type ReviewMutation = { action: 'save'; snapshot: HandSnapshot }
  | { action: 'update'; key: string; thoughts: string; conclusion: string; status: HandReview['status'] }
  | { action: 'delete'; key: string };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
export const reviewKey = (snapshot: HandSnapshot) => `${snapshot.gameType}:${snapshot.handId}`;
export function isSnapshot(v: unknown): v is HandSnapshot {
  return record(v) && text(v.handId, 100) && /^[a-zA-Z0-9_-]+$/.test(v.handId)
    && (v.gameType === 'cash' || v.gameType === 'tournament') && text(v.rawText, 100000)
    && text(v.heroHand, 20) && text(v.heroPosition, 20) && text(v.startedAt, 100);
}
export function isReview(v: unknown): v is HandReview {
  return record(v) && isSnapshot(v.snapshot) && v.key === reviewKey(v.snapshot)
    && text(v.thoughts, 10000) && text(v.conclusion, 10000)
    && (v.status === 'pending' || v.status === 'completed') && text(v.createdAt, 50) && text(v.updatedAt, 50);
}
export function isMutation(v: unknown): v is ReviewMutation {
  if (!record(v)) return false;
  if (v.action === 'save') return isSnapshot(v.snapshot);
  if (!text(v.key, 120) || !/^(cash|tournament):[a-zA-Z0-9_-]+$/.test(v.key)) return false;
  return v.action === 'delete' || (v.action === 'update' && text(v.thoughts, 10000)
    && text(v.conclusion, 10000) && (v.status === 'pending' || v.status === 'completed'));
}
