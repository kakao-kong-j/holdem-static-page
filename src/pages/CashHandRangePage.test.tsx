import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getViewMeta, renderView } from '../app/viewRegistry';
import { CashHandRangePage } from './CashHandRangePage';
import type { AllData } from '../types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const payload = {
  game: { name: '6-max NL10 cash', stackBb: 100, openSizeBb: 2.5 },
  scenarios: [{
    id: 'utg_rfi',
    position: 'UTG',
    actionHistory: [],
    availableActions: ['raise_2.5', 'fold'],
    hands: {
      AA: { 'raise_2.5': 0, fold: 0 },
      AKs: { 'raise_2.5': 71, fold: 29 },
    },
  }],
};

const emptyStack = {};
const existingData: AllData = {
  '15BB': emptyStack,
  '25BB': emptyStack,
  '40BB': emptyStack,
  '100BB': emptyStack,
};

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

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('CashHandRangePage', () => {
  it('requests cash data only when the cash page mounts', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => payload,
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const openView = renderNode(renderView({
      view: 'open-range',
      stack: '100BB',
      data: existingData,
      onNavigate: vi.fn(),
    }));
    expect(fetchSpy).not.toHaveBeenCalled();
    openView.cleanup();

    const cashView = renderNode(renderView({
      view: 'cash-range',
      stack: '100BB',
      data: existingData,
      onNavigate: vi.fn(),
    }));
    await flushEffects();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/gto-cache-preflop-chart.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    cashView.cleanup();
  });

  it('registers the page without stack tabs', () => {
    expect(getViewMeta('cash-range')).toMatchObject({
      label: '캐시 핸드레인지',
      showStackTabs: false,
    });
  });

  it('shows data unavailable for an all-zero hand', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })));
    const view = renderNode(<CashHandRangePage />);
    await flushEffects();
    expect(view.container.textContent).not.toContain('캐시 데이터');

    const handInput = view.container.querySelector('input[placeholder]') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(handInput, 'AA');
      handInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const chartToggle = view.container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => chartToggle.click());

    expect(view.container.textContent).toContain('데이터 없음');
    view.cleanup();
  });

  it('initializes selection from the first scenario instead of assuming UTG', async () => {
    const hjPayload = {
      ...payload,
      scenarios: [{ ...payload.scenarios[0], id: 'hj_rfi', position: 'HJ' }],
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => hjPayload })));
    const view = renderNode(<CashHandRangePage />);
    await flushEffects();

    expect((view.container.querySelector('select') as HTMLSelectElement).value).toBe('HJ');
    expect(view.container.textContent).not.toContain('선택한 상황의 차트가 없습니다.');
    view.cleanup();
  });

  it('keeps a cash data load failure inside the page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    const view = renderNode(<CashHandRangePage />);
    await flushEffects();
    expect(view.container.textContent).toContain('캐시 데이터 로드 실패');
    view.cleanup();
  });
});
