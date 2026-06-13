import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchUsdKrwRate } from './fxRate';

afterEach(() => vi.restoreAllMocks());

const body = {
  country: [
    { value: '1', currencyUnit: '달러' },
    { value: '1,521.20', currencyUnit: '원' },
  ],
};

describe('fetchUsdKrwRate', () => {
  it('parses country[1].value', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })));
    expect(await fetchUsdKrwRate()).toBeCloseTo(1521.2, 2);
  });
  it('returns null on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await fetchUsdKrwRate()).toBeNull();
  });
  it('returns null on bad shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    expect(await fetchUsdKrwRate()).toBeNull();
  });
});
