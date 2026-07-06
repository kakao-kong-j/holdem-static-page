import type { TransactionEntry } from './transactions';

const ENDPOINT = '/api/transactions';

function normalize(data: unknown): TransactionEntry[] {
  return Array.isArray(data) ? (data as TransactionEntry[]) : [];
}

async function post(body: unknown): Promise<TransactionEntry[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`transactions sync failed: ${res.status}`);
  return normalize(await res.json());
}

export async function fetchTransactions(): Promise<TransactionEntry[]> {
  const res = await fetch(ENDPOINT, { credentials: 'include' });
  if (!res.ok) throw new Error(`transactions fetch failed: ${res.status}`);
  return normalize(await res.json());
}

export function pushTransactions(transactions: TransactionEntry[]): Promise<TransactionEntry[]> {
  return post({ transactions });
}

export function replaceTransactions(transactions: TransactionEntry[]): Promise<TransactionEntry[]> {
  return post({ replace: true, transactions });
}

export function clearTransactions(): Promise<TransactionEntry[]> {
  return post({ clear: true });
}
