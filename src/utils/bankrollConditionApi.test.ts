import { beforeEach, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
vi.mock('../../api/_lib/session.js', () => ({ getSessionUser: async () => ({ sub: 'user' }) }));
vi.mock('@vercel/blob', () => ({ head: vi.fn(), put: vi.fn(), del: vi.fn() }));
import { head, put } from '@vercel/blob';
import handler from '../../api/bankroll';
const condition = { focus: 4, memo: 'rest' };
const cash = { id: 'same', kind: 'cash', profit: 3, condition };
let records: Record<string, unknown[]>;
beforeEach(() => {
  vi.clearAllMocks();
  records = { cash: [cash], tournament: [{ id: 'same', kind: 'tournament', profit: 7 }] };
  vi.mocked(head).mockImplementation(async (path) => ({ url: String(path) }) as Awaited<ReturnType<typeof head>>);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => records[url.includes('bankroll-cash') ? 'cash' : 'tournament'] })));
});
async function post(body: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler({ method: 'POST', body } as VercelRequest, res as unknown as VercelResponse);
  return res;
}
it('retains annotations on API raw reimport while overwriting money', async () => {
  const res = await post({ sessions: [{ id: 'same', kind: 'cash', profit: 9 }] });
  expect(res.json).toHaveBeenCalledWith({ cash: [{ ...cash, profit: 9 }], tournament: records.tournament });
});
it('edits only condition for selected kind and supports explicit clearing', async () => {
  const res = await post({ journal: { kind: 'cash', id: 'same', condition: null } });
  expect(res.json).toHaveBeenCalledWith({ session: { ...cash, condition: null } });
  expect(put).toHaveBeenCalledTimes(1);
  expect(vi.mocked(put).mock.calls[0][1]).toBe(JSON.stringify([{ ...cash, condition: null }]));
});
it('rejects invalid ratings without writing', async () => {
  const res = await post({ journal: { kind: 'cash', id: 'same', condition: { tilt: 8 } } });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(put).not.toHaveBeenCalled();
});
it('does not create a missing journal session', async () => {
  const res = await post({ journal: { kind: 'cash', id: 'missing', condition } });
  expect(res.status).toHaveBeenCalledWith(404);
  expect(put).not.toHaveBeenCalled();
});
it('reports storage read failures without replacing financial data', async () => {
  vi.mocked(head).mockRejectedValue(new Error('unavailable'));
  const res = await post({ journal: { kind: 'cash', id: 'same', condition } });
  expect(res.status).toHaveBeenCalledWith(503);
  expect(put).not.toHaveBeenCalled();
});
it('ignores malformed session entries without throwing', async () => {
  const res = await post({ sessions: [4, 'bad', null] });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(put).not.toHaveBeenCalled();
});
it('preserves explicit clearing on repeated raw imports', async () => {
  records.cash = [{ ...cash, condition: null }];
  for (const profit of [5, 8]) {
    const res = await post({ sessions: [{ id: 'same', kind: 'cash', profit }] });
    expect(res.json).toHaveBeenCalledWith({ cash: [{ id: 'same', kind: 'cash', profit, condition: null }], tournament: records.tournament });
  }
});
it('reports a journal write failure', async () => {
  vi.mocked(put).mockRejectedValueOnce(new Error('write failed'));
  const res = await post({ journal: { kind: 'cash', id: 'same', condition } });
  expect(res.status).toHaveBeenCalledWith(503);
});
it('validates condition on replacement and regular import too', async () => {
  for (const replace of [undefined, 'cash']) {
    const res = await post({ replace, sessions: [{ ...cash, condition: { memo: 42 } }] });
    expect(res.status).toHaveBeenCalledWith(400);
  }
  expect(put).not.toHaveBeenCalled();
});
