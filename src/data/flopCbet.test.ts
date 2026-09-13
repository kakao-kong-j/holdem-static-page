import { describe, expect, it } from 'vitest';
import { filterFlopCbetRecords, getFlopCbetSelection, summarizeFlopCbet, validateFlopCbetData } from './flopCbet';
import { flopCbetFixture } from '../test/flopCbetFixture';

describe('flop C-bet data', () => {
  it('resolves dependent filters to a supported context, including 50BB-only 4BP', () => {
    const data = validateFlopCbetData(flopCbetFixture());
    const defaults = getFlopCbetSelection(data, {});
    expect(defaults.selection).toEqual({ spot: 'srp-ip', profile: 'GTO', stack_bb: 50, position: 'BTNvsBB' });
    const changed = getFlopCbetSelection(data, { ...defaults.selection, spot: '4bp-oop', stack_bb: 20 });
    expect(changed.selection).toEqual({ spot: '4bp-oop', profile: 'GTO', stack_bb: 50, position: 'UTGvsBTN' });
    expect(changed.options.stacks).toEqual([50]);
    expect(changed.options.positions).toEqual(['UTGvsBTN']);
  });

  it('filters the selected context before sorting and calculating displayed-board means', () => {
    const data = validateFlopCbetData(flopCbetFixture());
    const { selection } = getFlopCbetSelection(data, {});
    const rows = filterFlopCbetRecords(data, selection, '', 'frequency-asc');
    expect(rows.map(row => row.frequency_pct)).toEqual([20, 80]);
    expect(summarizeFlopCbet(rows)).toEqual({ count: 2, mean: 50, sizes: [
      { label: '25%', count: 1, mean: 80 }, { label: '50%', count: 1, mean: 20 },
    ] });
    for (const query of ['AK3', 'AsKs3h', 'A♠ K♠ 3♥', ' a k 3 ']) {
      expect(filterFlopCbetRecords(data, selection, query, 'source').map(row => row.board_id)).toEqual(['AsKs3h']);
    }
    expect(summarizeFlopCbet(filterFlopCbetRecords(data, selection, '222', 'source'))).toEqual({ count: 0, mean: null, sizes: [] });
    expect(data.records[0].frequency_pct).toBe(80);
  });

  it.each(['unknown-board', 'invalid-frequency', 'duplicate', 'unsafe-link', 'wrong-action', 'wrong-stack', 'invalid-size', 'invalid-texture'])('rejects data corruption: %s', corruption => {
    const data = flopCbetFixture();
    if (corruption === 'unknown-board') data.records[0].board_id = 'missing';
    if (corruption === 'invalid-frequency') data.records[0].frequency_pct = 100.1;
    if (corruption === 'duplicate') data.records.push(data.records[0]);
    if (corruption === 'unsafe-link') data.records[0].source.url = 'javascript:alert(1)';
    if (corruption === 'wrong-action') data.records[0].action = 'stab';
    if (corruption === 'wrong-stack') data.records[3].stack_bb = 20;
    if (corruption === 'invalid-size') data.records[0].size = { kind: 'pot', pct: -25 };
    if (corruption === 'invalid-texture') data.boards[0].textures = [''];
    expect(() => validateFlopCbetData(data)).toThrow();
  });
});
