import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CashRangeGrid } from './CashRangeGrid';
import type { CashScenario } from '../utils/cashRange';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const scenario: CashScenario = {
  id: 'utg_rfi',
  position: 'UTG',
  actionHistory: [],
  availableActions: ['raise_2.5', 'fold'],
  hands: { AA: { 'raise_2.5': 71, fold: 29 } },
};

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('CashRangeGrid', () => {
  it('renders mixed frequencies and highlights the entered hand', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<CashRangeGrid scenario={scenario} highlightedHand="AA" />));
    cleanup = () => {
      act(() => root.unmount());
      container.remove();
    };

    const cell = container.querySelector('[data-hand="AA"]') as HTMLElement;
    expect(cell.title).toContain('2.5BB 레이즈 71%');
    expect(cell.title).toContain('폴드 29%');
    expect(cell.style.backgroundImage).toContain('71%');
    expect(cell.getAttribute('data-highlighted')).toBe('true');
  });
});
