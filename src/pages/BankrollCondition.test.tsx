import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { BankrollPage } from './BankrollPage';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.unstubAllGlobals());
it.each([false, true])('edits and clears a journal with visible save outcome (failure=%s)', async (fail) => {
  const session = { id: 'one', kind: 'cash', datetime: '2026-09-01 12:00:00', profit: 2, winLoss: 2, tags: [], condition: { focus: 4, memo: 'before' } };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.method) return { ok: true, json: async () => ({ cash: [session], tournament: [] }) };
    const body = JSON.parse(String(init.body));
    if (fail) return { ok: false, status: 503 };
    session.condition = body.journal.condition;
    return { ok: true, json: async () => ({ session }) };
  }));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const click = async (label: string) => {
    const button = [...container.querySelectorAll('button')].find(b => b.textContent === label);
    expect(button, label).toBeDefined();
    await act(async () => button!.click());
  };
  try {
    await act(async () => root.render(<BankrollPage />));
    expect(container.textContent).toContain('집중도 4');
    await click('컨디션 수정');
    const memo = container.querySelector('textarea')!;
    expect(memo.value).toBe('before');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(memo, 'after');
      memo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click('컨디션 저장');
    if (fail) {
      expect(container.querySelector('[role="alert"]')?.textContent).toContain('저장하지 못했습니다');
      expect(container.querySelector('textarea')?.value).toBe('after');
      expect(session.condition.memo).toBe('before');
    } else {
      expect(session.condition.memo).toBe('after');
      expect(container.querySelector('textarea')).toBeNull();
      await click('컨디션 수정');
      expect(container.querySelector('textarea')?.value).toBe('after');
      await click('컨디션 기록 지우기');
      expect(session.condition).toBeNull();
      expect(container.textContent).toContain('컨디션 기록 없음');
    }
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
it('locks the journal and row actions until save settles', async () => {
  const session = { id: 'one', kind: 'cash', datetime: '2026-09-01', profit: 2, winLoss: 2, tags: [] };
  let resolveSave!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.method) return { ok: true, json: async () => ({ cash: [session], tournament: [] }) };
    return new Promise(resolve => { resolveSave = resolve; });
  }));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<BankrollPage />));
    const button = (label: string) => [...container.querySelectorAll('button')].find(b => b.textContent === label)!;
    act(() => button('컨디션 기록').click());
    await act(async () => button('컨디션 저장').click());
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(button('수정').disabled).toBe(true);
    expect(button('삭제').disabled).toBe(true);
    expect(container.querySelector('textarea')).not.toBeNull();
    await act(async () => resolveSave({ ok: true, json: async () => ({ session: { ...session, condition: null } }) }));
    expect(container.querySelector('textarea')).toBeNull();
    expect(button('수정').disabled).toBe(false);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
