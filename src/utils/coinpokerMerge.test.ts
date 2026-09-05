import { describe, expect, it } from 'vitest';
import { parseCoinPokerHands } from './coinpokerParser';
import { mergeCoinPokerStore } from './coinpokerSync';

const [hand] = parseCoinPokerHands(`CoinPoker Hand #123: NLH (1/2) 2026/06/08 12:00:00 KST
Table 'Test' 6-max Seat #1 is the button
Seat 1: Hero (200 in chips)
Seat 2: Villain (200 in chips)
Dealt to Hero [Ac Ad]
Hero: raises 4 to 6
Villain: folds`);

describe('mergeCoinPokerStore', () => {
  it('keeps only the first incoming copy per game type', () => {
    expect(hand).toBeDefined();
    const cash = { ...hand, gameType: 'cash' as const };
    const tournament = { ...hand, gameType: 'tournament' as const };
    const result = mergeCoinPokerStore({ cash: [], tournament: [] }, [
      cash, { ...cash, rawText: 'duplicate' }, tournament, tournament,
    ]);
    expect(result).toEqual({ cash: [cash], tournament: [tournament] });
  });

  it('preserves existing hands and order without mutating either input', () => {
    const existing = { ...hand, gameType: 'cash' as const };
    const fresh = { ...existing, handId: '456' };
    const store = { cash: [existing], tournament: [] };
    const incoming = [{ ...existing, rawText: 'replacement' }, fresh, fresh];
    const before = structuredClone({ store, incoming });
    const result = mergeCoinPokerStore(store, incoming);
    expect(result).toEqual({ cash: [existing, fresh], tournament: [] });
    expect({ store, incoming }).toEqual(before);
    expect(mergeCoinPokerStore(result, incoming)).toEqual(result);
  });
});
