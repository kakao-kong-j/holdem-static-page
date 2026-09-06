import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BlobNotFoundError, head, put } from '@vercel/blob';
import { getSessionUser } from '../../api/_lib/session';
import handler from '../../api/hand-reviews';
vi.mock('@vercel/blob', async importOriginal => ({ ...await importOriginal<object>(), head: vi.fn(), put: vi.fn() }));
vi.mock('../../api/_lib/session', () => ({ getSessionUser: vi.fn() }));
const snapshot = { handId: '42', gameType: 'cash', rawText: 'Hero: raises', heroHand: 'AKs', heroPosition: 'BTN', startedAt: '2026-09-06' };
async function call(method: string, body?: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler({ method, body } as VercelRequest, res as unknown as VercelResponse);
  return { status: res.status.mock.calls[0][0], data: res.json.mock.calls[0][0] };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSessionUser).mockResolvedValue({ sub: 'alice' });
  vi.mocked(head).mockRejectedValue(new BlobNotFoundError());
});
describe('hand review persistence', () => {
  it('requires authentication before storage access', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
    expect((await call('GET')).status).toBe(401);
    expect(head).not.toHaveBeenCalled();
  });
  it('saves a first snapshot under the authenticated user and returns it', async () => {
    const result = await call('POST', { action: 'save', snapshot });
    expect(result.status).toBe(200);
    expect(result.data.reviews[0]).toMatchObject({ snapshot, thoughts: '', conclusion: '', status: 'pending' });
    expect(vi.mocked(put).mock.calls[0][0]).toBe('users/alice/hand-reviews.json');
  });
  it.each([null, { action: 'save', snapshot: { ...snapshot, gameType: 'omaha' } }, { action: 'update', key: 'cash:42', thoughts: 42 }, { action: 'save', snapshot: { ...snapshot, rawText: 'x'.repeat(100001) } }])('rejects malformed mutations', async body => {
    expect((await call('POST', body)).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
  it.each(['head', 'http', 'json'])('does not write when existing storage cannot be read: %s', async failure => {
    vi.mocked(head).mockResolvedValue({ url: 'https://blob.test/reviews' } as Awaited<ReturnType<typeof head>>);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: failure !== 'http', json: async () => ({ invalid: true }) }));
    if (failure === 'head') vi.mocked(head).mockRejectedValue(new Error('network'));
    expect((await call('POST', { action: 'save', snapshot })).status).toBe(503);
    expect(put).not.toHaveBeenCalled();
  });
  it('preserves snapshots on duplicate save, updates notes, and removes only the selected key', async () => {
    let stored: unknown = [];
    vi.mocked(head).mockResolvedValue({ url: 'https://blob.test/reviews' } as Awaited<ReturnType<typeof head>>);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ({ ok: true, json: async () => stored })));
    vi.mocked(put).mockImplementation(async (_path, body) => { stored = JSON.parse(body as string); return {} as Awaited<ReturnType<typeof put>>; });
    await call('POST', { action: 'save', snapshot });
    await call('POST', { action: 'save', snapshot: { ...snapshot, gameType: 'tournament' } });
    await call('POST', { action: 'update', key: 'cash:42', thoughts: 'why bet?', conclusion: 'check', status: 'completed' });
    await call('POST', { action: 'save', snapshot: { ...snapshot, rawText: 'replacement' } });
    expect((await call('GET')).data.reviews).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'cash:42', thoughts: 'why bet?', status: 'completed', snapshot })]));
    expect((await call('POST', { action: 'delete', key: 'cash:42' })).data.reviews.map((r: { key: string }) => r.key)).toEqual(['tournament:42']);
  });
  it('rejects total UTF-8 storage beyond 3 MB before writing', async () => {
    const review = { key: 'cash:42', snapshot: { ...snapshot, rawText: '한'.repeat(100000) }, thoughts: '', conclusion: '', status: 'pending', createdAt: '', updatedAt: '' };
    vi.mocked(head).mockResolvedValue({ url: 'https://blob.test/reviews' } as Awaited<ReturnType<typeof head>>);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => Array.from({ length: 10 }, (_, i) => ({ ...review, key: `cash:${i}`, snapshot: { ...review.snapshot, handId: `${i}` } })) }));
    expect((await call('POST', { action: 'save', snapshot })).status).toBe(409);
    expect(put).not.toHaveBeenCalled();
  });
  it('reports write failures without claiming success', async () => {
    vi.mocked(put).mockRejectedValue(new Error('unavailable'));
    expect((await call('POST', { action: 'save', snapshot })).status).toBe(503);
  });
});
