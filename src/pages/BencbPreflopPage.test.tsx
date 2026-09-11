import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { RANKS } from '../constants';
import { getHandName } from '../utils/hand';
import type { BencbChart } from '../data/bencb';
import { BencbPreflopPage } from './BencbPreflopPage';
import { getViewMeta } from '../app/viewRegistry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Synthetic charts keep the test suite independent of private data and DATA_KEY.
function fixtureChart(id: string, category: string, subcategory: string): BencbChart {
  const hands = Object.fromEntries(RANKS.flatMap((_, row) => RANKS.map((__, column) => [getHandName(row, column), { unmarked: 1 }])));
  return {
    id, category, subcategory, scenario: '테스트 상황', source: 'synthetic-test.png',
    hands: { ...hands, A5s: { color_4caf50: 0.5, color_ffc107: 0.5 }, '86s': { color_2196f3: 1 } },
    legend: [
      { id: 'color_4caf50', color: '#4caf50', label: 'flatcall', combo_count: 2 },
      { id: 'color_ffc107', color: '#ffc107', label: '3B / Fold', combo_count: 2 },
      { id: 'color_2196f3', color: '#2196f3', label: null, combo_count: 4 },
    ],
    total_marked_combos: 8, mixed_hands: ['A5s'],
  };
}
const payload = {
  schema_version: 1, incomplete_sources: [],
  charts: [
    fixtureChart('test-open', 'Openraising', '40bb+'),
    fixtureChart('flatting_3betting_50bb_btn_vs_co', 'Flatting _ 3Betting', '50bb+'),
    fixtureChart('flatting_3betting_40_50bb_sb_vs_co', 'Flatting _ 3Betting', '40-50bb'),
    fixtureChart('test-calling', 'Calling rejams', 'BTN'),
  ],
};
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); vi.unstubAllGlobals(); });
async function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  dispose = () => { act(() => root.unmount()); container.remove(); };
  await act(async () => { root.render(<BencbPreflopPage />); });
  return container;
}
function select(container: HTMLElement, label: string, value: string) {
  const node = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  act(() => { node.value = value; node.dispatchEvent(new Event('change', { bubbles: true })); });
}
it('registers a separate page without the unrelated global stack tabs', () => {
  expect(getViewMeta('bencb-preflop')).toMatchObject({ label: 'Bencb 프리플랍', showStackTabs: false });
});
it('switches dependent filters and displays a mixed hand', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })));
  const c = await mount();
  expect(c.querySelectorAll('[data-hand]')).toHaveLength(169);
  select(c, '카테고리', 'Flatting _ 3Betting');
  select(c, '스택 / 포지션', '50bb+');
  select(c, '차트', 'flatting_3betting_50bb_btn_vs_co');
  const hand = c.querySelector<HTMLButtonElement>('[data-hand="A5s"]')!;
  expect(hand.style.background).toContain('linear-gradient');
  act(() => hand.click());
  const detail = c.querySelector('[aria-label="선택한 핸드 상세"]')!;
  expect(detail.textContent).toContain('A5s');
  expect(detail.textContent).toContain('50%');
  expect(detail.textContent).toContain('3B / Fold');
  select(c, '카테고리', 'Calling rejams');
  expect(c.querySelectorAll('[data-hand]')).toHaveLength(169);
  expect(c.querySelector('h2')?.textContent).not.toContain('Flatting');
});
it('keeps missing legends and unmarked cells distinct from fold', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })));
  const c = await mount();
  select(c, '카테고리', 'Flatting _ 3Betting');
  select(c, '스택 / 포지션', '40-50bb');
  select(c, '차트', 'flatting_3betting_40_50bb_sb_vs_co');
  act(() => c.querySelector<HTMLButtonElement>('[data-hand="86s"]')!.click());
  expect(c.querySelector('[aria-label="선택한 핸드 상세"]')?.textContent).toContain('범례 없음');
  act(() => c.querySelector<HTMLButtonElement>('[data-hand="72o"]')!.click());
  expect(c.querySelector('[aria-label="선택한 핸드 상세"]')?.textContent).toContain('미표시');
  expect(c.querySelector('[aria-label="선택한 핸드 상세"]')?.textContent).not.toContain('Fold');
});
it('shows a retry action on failed fetch and recovers', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, json: async () => payload }));
  const c = await mount();
  expect(c.querySelector('[role="alert"]')?.textContent).toContain('503');
  await act(async () => { c.querySelector<HTMLButtonElement>('button')!.click(); });
  expect(c.querySelectorAll('[data-hand]')).toHaveLength(169);
});
