import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionEntry } from './transactions';
import {
  clearTransactions,
  fetchTransactions,
  pushTransactions,
  replaceTransactions,
} from './transactionsSync';

const entry: TransactionEntry = {
  id: 'id|reward|Pending Bonus Release|2026-07-05|1',
  txnId: 'id',
  txnType: 'reward',
  subType: 'Pending Bonus Release',
  date: '2026-07-05 10:00:00',
  amount: 1,
  signedAmount: 1,
  direction: 'income',
  category: 'Reward',
  description: 'Pending Bonus Release',
  raw: {},
};

describe('transactionsSync', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and normalizes stored transactions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [entry] })));

    await expect(fetchTransactions()).resolves.toEqual([entry]);
    expect(fetch).toHaveBeenCalledWith('/api/transactions', { credentials: 'include' });
  });

  it('turns malformed server payloads into an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ nope: true }) })));

    await expect(fetchTransactions()).resolves.toEqual([]);
  });

  it('pushes transactions', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [entry] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(pushTransactions([entry])).resolves.toEqual([entry]);
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ transactions: [entry] }),
    }));
  });

  it('replaces and clears transactions', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [] }));
    vi.stubGlobal('fetch', fetchMock);

    await replaceTransactions([entry]);
    await clearTransactions();

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/transactions', expect.objectContaining({ body: JSON.stringify({ replace: true, transactions: [entry] }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/transactions', expect.objectContaining({ body: JSON.stringify({ clear: true }) }));
  });
});
