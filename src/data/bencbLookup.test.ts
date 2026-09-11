import { describe, expect, it } from 'vitest';
import { describeBencbChart, filterBencbCharts, getBencbOptions, type BencbEntry } from './bencbLookup';
import type { BencbChart } from './bencb';
function chart(category: string, subcategory: string, scenario: string): BencbChart {
  return { id: `${category}/${subcategory}/${scenario}`, category, subcategory, scenario, source: `${category}/${subcategory}/${scenario}.PNG`, hands: {}, legend: [], total_marked_combos: 0, mixed_hands: [] };
}
const entry = (c: BencbChart): BencbEntry => ({ chart: c, ...describeBencbChart(c) });
describe('Bencb lookup metadata', () => {
  it('separates hero and opener from stack in flatting charts', () => {
    expect(describeBencbChart(chart('Flatting _ 3Betting', '50bb+', 'BTN vs CO'))).toMatchObject({ hero: 'BTN', opponent: 'CO 오픈', stack: '50 BB+', strategy: '콜 / 3벳' });
  });
  it('does not treat BB opening percentage as a stack', () => {
    expect(describeBencbChart(chart('BB Strategy', 'Defending', 'vs12_'))).toMatchObject({ hero: 'BB', strategy: 'BB 디펜스', stack: '스택 미표기', condition: '상대 오픈 12%' });
  });
  it('keeps all stacks in a rejam chart together', () => {
    const c = chart('Rejamming', 'SB', 'vs BTN');
    c.legend = [{ id: 'a', color: '#fff', label: '20bb', combo_count: 1 }, { id: 'b', color: '#fff', label: '15bb', combo_count: 1 }];
    expect(describeBencbChart(c)).toMatchObject({ hero: 'SB', opponent: 'BTN 오픈', stack: '여러 스택 통합', stackDetail: '15 / 20 BB' });
  });
  it('uses explicit squeeze exceptions instead of the broad parent stack', () => {
    expect(describeBencbChart(chart('Squeezing', '40bb+', '90BBCOvsUTGopen+Fishcall'))).toMatchObject({ hero: 'CO', stack: '90 BB', opponent: 'UTG 오픈 + HJ 콜', condition: '콜러 피시' });
    expect(describeBencbChart(chart('Squeezing', '40bb+', 'SBvs20BBCOopen+BUflat'))).toMatchObject({ hero: 'SB', stack: 'CO 20 BB', opponent: 'CO 오픈 + BTN 콜' });
  });
  it('normalizes SB styles and heads-up situations', () => {
    expect(describeBencbChart(chart('Openraising', '40bb+ SB', 'mixed vs passive'))).toMatchObject({ hero: 'SB', stack: '40 BB+', condition: '혼합 / 패시브 상대' });
    expect(describeBencbChart(chart('HU', '25BB- OOP', '15-20BB vs LIMP'))).toMatchObject({ hero: 'BB', opponent: 'SB', stack: '15–20 BB', condition: '림프 대응' });
  });
  it('records the heads-up filename typo correction from the original image', () => {
    const meta = describeBencbChart(chart('HU', '25BB- FROM SB', 'LIMP SHOVE 10-25BB'));
    expect(meta.stack).toBe('10–15 BB');
    expect(meta.note).toContain('10-25BB');
  });
});
describe('Bencb filters', () => {
  const entries = [entry(chart('Flatting _ 3Betting', '50bb+', 'BTN vs CO')), entry(chart('Flatting _ 3Betting', '20bb', 'SB vs CO')), entry(chart('Rejamming', 'BTN', 'vs CO'))];
  it('matches multiple words and position aliases', () => {
    expect(filterBencbCharts(entries, {}, 'BU CO 50bb')).toHaveLength(1);
    expect(filterBencbCharts(entries, {}, '없는차트')).toHaveLength(0);
    const blinds = [entry(chart('Openraising', '10-20bb', 'SB'))];
    expect(filterBencbCharts(blinds, {}, 'SB BB')).toHaveLength(1);
    expect(filterBencbCharts(entries, {}, 'BTN CO 50 BB+')).toHaveLength(1);
  });
  it('finds every stack in an integrated rejam chart, not only the maximum', () => {
    const c = chart('Rejamming', 'BB', 'vs BTN');
    c.legend = [15, 20, 25, 30].map(value => ({ id: String(value), color: '#fff', label: `${value}bb`, combo_count: 1 }));
    for (const value of [15, 20, 25, 30]) expect(filterBencbCharts([entry(c)], {}, `리잼 BB BTN ${value}bb`)).toHaveLength(1);
    expect(filterBencbCharts([entry(c)], {}, '리잼 BB BTN 40bb')).toHaveLength(0);
  });
  it('keeps filters distinct and offers only matching stack options', () => {
    expect(filterBencbCharts(entries, { hero: 'BTN', strategy: '콜 / 3벳' })).toHaveLength(1);
    expect(getBencbOptions(entries, { hero: 'BTN', strategy: '콜 / 3벳' }, 'stack')).toEqual(['50 BB+']);
  });
});
