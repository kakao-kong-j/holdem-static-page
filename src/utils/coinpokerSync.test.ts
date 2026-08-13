import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoinPokerHand } from './coinpokerParser';
import { COINPOKER_UPLOAD_MAX_BYTES, pushCoinPokerHands, splitCoinPokerUploadBatches } from './coinpokerSync';

function hand(handId: string, rawText = 'CoinPoker Hand'): CoinPokerHand {
  return {
    handId,
    gameType: 'cash',
    rawText,
    startedAt: '2026-08-14',
    smallBlind: 0.5,
    bigBlind: 1,
    ante: 0,
    tableSize: 6,
    buttonSeat: 1,
    heroSeat: 2,
    heroStack: 100,
    heroStackBb: 100,
    heroPosition: 'UTG',
    heroCards: ['As', 'Kd'],
    heroHand: 'AKo',
    preflopActions: [],
    heroFirstAction: 'raises',
    rfiEligible: true,
    exclusionReason: null,
  };
}

describe('CoinPoker upload sync', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('splits hand uploads by UTF-8 JSON body size', () => {
    const hands = [hand('first', '한'.repeat(700_000)), hand('second', '한'.repeat(700_000))];

    const batches = splitCoinPokerUploadBatches(hands);

    expect(batches).toEqual([[hands[0]], [hands[1]]]);
    for (const batch of batches) {
      expect(new TextEncoder().encode(JSON.stringify({ hands: batch })).byteLength).toBeLessThanOrEqual(COINPOKER_UPLOAD_MAX_BYTES);
    }
  });

  it('rejects a hand that cannot fit in one upload request', async () => {
    const tooLarge = hand('too-large', 'x'.repeat(3_200_000));

    await expect(pushCoinPokerHands([tooLarge])).rejects.toThrow('too large');
  });

  it('starts a fresh byte count after flushing a full batch', () => {
    const first = hand('first', 'x'.repeat(3_130_000));
    const second = hand('second', 'x'.repeat(20_000));
    const third = hand('third', 'x'.repeat(20_000));

    expect(splitCoinPokerUploadBatches([first, second, third])).toEqual([[first], [second, third]]);
  });

  it('uploads batches sequentially and reports completed hands', async () => {
    const hands = [hand('first', '한'.repeat(700_000)), hand('second', '한'.repeat(700_000))];
    const uploadedHandIds: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      uploadedHandIds.push(JSON.parse(init?.body as string).hands[0].handId);
      return new Response(JSON.stringify({ added: 1 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const progress: { completed: number; total: number }[] = [];

    await expect(pushCoinPokerHands(hands, value => progress.push(value))).resolves.toEqual({ added: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(uploadedHandIds).toEqual(['first', 'second']);
    expect(progress).toEqual([{ completed: 1, total: 2 }, { completed: 2, total: 2 }]);
  });
});
