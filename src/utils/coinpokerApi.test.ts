import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { list, put } from '@vercel/blob';
import handler from '../../api/coinpoker';

vi.mock('@vercel/blob', () => ({ list: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('../../api/_lib/session.js', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ sub: 'test-user' }),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('CoinPoker upload', () => {
  it('writes each new hand once and counts unique additions', async () => {
    const existing = { handId: 'old', gameType: 'cash', rawText: 'original' };
    const cash = { handId: 'new', gameType: 'cash' };
    const tournament = { handId: 'new', gameType: 'tournament' };
    vi.mocked(list).mockImplementation(async (options) => ({
      blobs: options?.prefix?.endsWith('coinpoker-cash/')
        ? [{ url: 'https://blob.test/cash' }] : [],
      hasMore: false,
    } as Awaited<ReturnType<typeof list>>));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => [existing],
    }));
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json };
    await handler({ method: 'POST', body: { hands: [
      { ...existing, rawText: 'replacement' }, cash, cash, tournament, tournament,
    ] } } as VercelRequest, res as unknown as VercelResponse);

    expect(json).toHaveBeenCalledWith({ added: 2 });
    const saved = vi.mocked(put).mock.calls.map(([path, body]) => ({
      path, hands: JSON.parse(body as string),
    })).sort((a, b) => a.path.localeCompare(b.path));
    expect(saved).toEqual([
      { path: 'users/test-user/coinpoker-cash/chunk.json', hands: [cash] },
      { path: 'users/test-user/coinpoker-tournament/chunk.json', hands: [tournament] },
    ]);
  });
});
