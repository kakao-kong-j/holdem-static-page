import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { BankrollPage } from './BankrollPage';
import type { BankrollSession } from '../utils/bankroll';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it('filters records, totals and charts together and resets all filters', async () => {
  const base: BankrollSession = {
    id: 'regular', kind: 'tournament', name: 'Main Event', datetime: '2026-09-01',
    profit: 20, winLoss: 30, buyIn: 10, tags: ['Regular'],
  };
  const sessions = {
    cash: [{ ...base, id: 'cash', kind: 'cash', name: 'Cash Session', profit: 5, winLoss: 5, tags: ['Cash'] }],
    tournament: [base, { ...base, id: 'sat', name: '2 Seats to ₮11 Main', datetime: '2026-09-02', profit: -2, winLoss: 0, buyIn: 2, tags: ['Satellite'] }],
  };
  const fetchSpy = vi.fn(async (url: unknown) => ({
    ok: true, json: async () => url === '/api/bankroll' ? sessions : {},
  }));
  vi.stubGlobal('fetch', fetchSpy);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root?.render(<BankrollPage />); });
  const select = container.querySelector<HTMLSelectElement>('select[aria-label="세틀라이트 필터"]');
  expect(select).not.toBeNull();
  const choose = (value: string) => act(() => {
    select!.value = value;
    select!.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const text = () => container.textContent ?? '';
  const records = () => container.querySelector('tbody')?.textContent ?? '';
  expect(text()).toContain('Bankroll: $23.00');
  choose('exclude');
  expect(records()).not.toContain('2 Seats to');
  expect(records()).toContain('Cash Session');
  expect(text()).toContain('Bankroll: $25.00');
  expect(text()).toContain('2 points');
  expect(text()).toContain('1 games');
  choose('only');
  expect(records()).toContain('2 Seats to');
  expect(records()).not.toContain('Cash Session');
  expect(records()).not.toContain('Main Event');
  expect(text()).toContain('Bankroll: -$2.00');
  expect(text()).toContain('1 points');
  const date = container.querySelector<HTMLInputElement>('input[type="date"]')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(date, '2026-09-03');
    date.dispatchEvent(new Event('input', { bubbles: true }));
    date.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
  expect(text()).toContain('Bankroll: $0.00');
  const reset = [...container.querySelectorAll('button')].find(button => button.textContent === '초기화')!;
  act(() => reset.click());
  expect(select!.value).toBe('all');
  expect(date.value).toBe('');
  expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  expect(text()).toContain('Bankroll: $23.00');
  expect(fetchSpy.mock.calls).toHaveLength(2);
});
