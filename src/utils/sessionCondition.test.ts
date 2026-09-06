import { describe, expect, it } from 'vitest';
import { dedupeSessions, type BankrollSession } from './bankroll';
import { isSessionCondition } from './sessionCondition';
const base: BankrollSession = { id: 'same', kind: 'cash', datetime: '', profit: 1, winLoss: 1, tags: [] };
describe('session condition journal', () => {
  it('retains annotations when reimport overwrites money, and keeps kinds separate', () => {
    const condition = { focus: 4, memo: 'break' };
    const result = dedupeSessions([{ ...base, condition }, { ...base, profit: 9 }, { ...base, kind: 'tournament' }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ profit: 9, condition });
    expect(result[1].condition).toBeUndefined();
  });
  it('honors explicit clearing through later reimports', () => {
    expect(dedupeSessions([{ ...base, condition: { tilt: 5 } }, { ...base, condition: null }, base])[0].condition).toBeNull();
  });
  it('validates optional integer scales and bounded text', () => {
    expect(isSessionCondition({ focus: 1, fatigue: 5, memo: '' })).toBe(true);
    expect(isSessionCondition(null)).toBe(true);
    for (const value of [{ focus: 0 }, { tilt: 6 }, { fatigue: 1.5 }, { focus: '3' }, { memo: 42 }, { memo: 'a'.repeat(2001) }, [], { other: 1 }]) {
      expect(isSessionCondition(value)).toBe(false);
    }
  });
});
