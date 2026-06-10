import type { QuizRecord } from '../types';
import { loadQuizRecords, replaceQuizRecords } from './quiz';

const ENDPOINT = '/api/records';

interface RecordsResponse {
  records: QuizRecord[];
}

/**
 * Push the full local set to the server (server merges by timestamp), then
 * adopt the merged union locally. Run on login so both sides converge.
 */
export async function syncQuizRecords(): Promise<QuizRecord[]> {
  const local = loadQuizRecords();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ records: local, mode: 'merge' }),
  });
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);
  const data = (await res.json()) as RecordsResponse;
  const merged = Array.isArray(data.records) ? data.records : [];
  replaceQuizRecords(merged);
  return merged;
}

/** Fire-and-forget: merge the given records into the server-side store. */
export async function pushQuizRecords(records: QuizRecord[]): Promise<void> {
  await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ records, mode: 'merge' }),
  });
}

/** Replace the server-side store wholesale (used by clear / import). */
export async function replaceRemoteRecords(records: QuizRecord[]): Promise<void> {
  await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ records, mode: 'replace' }),
  });
}
