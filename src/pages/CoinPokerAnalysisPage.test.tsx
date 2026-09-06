import { act, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AllData } from '../types';
import type { CoinPokerHand } from '../utils/coinpokerParser';

const testState = vi.hoisted(() => ({
  gameType: 'cash' as 'cash' | 'tournament',
  store: { cash: [] as CoinPokerHand[], tournament: [] as CoinPokerHand[] },
}));

vi.mock('./coinpoker/useCoinPokerStore', () => ({
  useCoinPokerStore: () => ({
    store: testState.store,
    setStore: vi.fn(),
    gameType: testState.gameType,
    setGameType: vi.fn(),
    chartLimit: Number.MAX_SAFE_INTEGER,
    setChartLimit: vi.fn(),
    loading: false,
    progress: null,
    mergeCoinPokerStore: vi.fn(),
    parseCoinPokerHands: vi.fn(() => []),
    clearCoinPokerHands: vi.fn(),
    fetchCoinPokerHands: vi.fn(),
    pushCoinPokerHands: vi.fn(),
  }),
}));

vi.mock('../components/handReviews/useHandReviews', () => ({
  useHandReviews: () => ({ reviews: [], ready: true, busy: false, error: null, request: vi.fn() }),
}));

import { CoinPokerAnalysisPage } from './CoinPokerAnalysisPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cashPayload = {
  game: { name: '6-max NL10 cash', stackBb: 100, openSizeBb: 2.5 },
  scenarios: [{
    id: 'utg_rfi',
    position: 'UTG',
    actionHistory: [],
    availableActions: ['raise_2.5', 'fold'],
    hands: { AA: { 'raise_2.5': 100, fold: 0 } },
  }],
};

const tournamentData: AllData = {
  '15BB': {},
  '25BB': {},
  '40BB': {},
  '100BB': { 'BTN RFI': { raise: ['AA'] } },
};

function hand(overrides: Partial<CoinPokerHand>): CoinPokerHand {
  return {
    handId: '1',
    gameType: 'cash',
    rawText: '',
    startedAt: '',
    smallBlind: 50,
    bigBlind: 100,
    ante: 0,
    tableSize: 6,
    buttonSeat: 1,
    heroSeat: 3,
    heroStack: 10000,
    heroStackBb: 100,
    heroPosition: 'UTG',
    heroCards: ['Ac', 'Ad'],
    heroHand: 'AA',
    preflopActions: [{ player: 'Hero', position: 'UTG', action: 'raises', line: 'Hero: raises 150 to 250' }],
    heroFirstAction: 'raises',
    rfiEligible: true,
    exclusionReason: null,
    ...overrides,
  };
}

function renderNode(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
  throw lastError;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  testState.gameType = 'cash';
  testState.store = { cash: [], tournament: [] };
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('CoinPokerAnalysisPage analysis sources', () => {
  it('uses validated cache ranges for cash rather than tournament chart data', async () => {
    testState.store = { cash: [hand({ heroPosition: 'UTG' })], tournament: [] };
    const request = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const fetchSpy = vi.fn(() => request.promise);
    vi.stubGlobal('fetch', fetchSpy);

    const view = renderNode(<CoinPokerAnalysisPage fallbackStack="100BB" data={tournamentData} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    request.resolve({ ok: true, json: async () => cashPayload });
    await waitFor(() => expect(view.container.textContent).toContain('일치: 플레이'));

    expect(view.container.textContent).toContain('캐시 핸드레인지 기준');
    view.cleanup();
  });

  it('keeps tournament hands on the tournament GTO comparison path', async () => {
    testState.gameType = 'tournament';
    testState.store = {
      cash: [],
      tournament: [hand({ gameType: 'tournament', heroPosition: 'BTN' })],
    };
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => cashPayload }));
    vi.stubGlobal('fetch', fetchSpy);

    const view = renderNode(<CoinPokerAnalysisPage fallbackStack="100BB" data={tournamentData} />);
    await flushEffects();

    expect(view.container.textContent).toContain('토너먼트 GTO 기준');
    expect(view.container.textContent).toContain('일치: 플레이');
    expect(fetchSpy).not.toHaveBeenCalled();
    view.cleanup();
  });

  it('marks cash hands unavailable when cache validation fails instead of using tournament data', async () => {
    testState.store = { cash: [hand({ heroPosition: 'UTG' })], tournament: [] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ invalid: true }) })));

    const view = renderNode(<CoinPokerAnalysisPage fallbackStack="100BB" data={tournamentData} />);
    await flushEffects();

    expect(view.container.textContent).toContain('캐시 데이터 로드 실패');
    expect(view.container.textContent).toContain('cash-range-data-unavailable');
    view.cleanup();
  });

  it('keeps the cash loading state while a replacement cache request is pending', async () => {
    testState.store = { cash: [hand({ heroPosition: 'UTG' })], tournament: [] };
    const requests = [deferred<{ ok: boolean; json: () => Promise<unknown> }>(), deferred<{ ok: boolean; json: () => Promise<unknown> }>()];
    let requestIndex = 0;
    const fetchSpy = vi.fn(() => requests[requestIndex++].promise);
    vi.stubGlobal('fetch', fetchSpy);

    const view = renderNode(
      <StrictMode>
        <CoinPokerAnalysisPage fallbackStack="100BB" data={tournamentData} />
      </StrictMode>,
    );
    await flushEffects();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      requests[0].reject(abortError);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(view.container.textContent).toContain('캐시 데이터 로딩 중...');
    requests[1].resolve({ ok: true, json: async () => cashPayload });
    await flushEffects();
    view.cleanup();
  });
});
