import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { HandReviewNotebook, SaveHandReviewButton } from './HandReviewNotebook';
import { useHandReviews } from './useHandReviews';
const snapshot = { handId: '42', gameType: 'cash' as const, rawText: 'Hero: raises', heroHand: 'AKs', heroPosition: 'BTN', startedAt: '' };
const saved = { key: 'cash:42', snapshot, thoughts: 'first thought', conclusion: '', status: 'pending', createdAt: '', updatedAt: '' };
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup = () => {};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Harness() { const store = useHandReviews(); return <><SaveHandReviewButton store={store} snapshot={snapshot} /><HandReviewNotebook store={store} /></>; }
async function render() {
 const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
 cleanup = () => { act(() => root.unmount()); container.remove(); };
 await act(async () => { root.render(<Harness />); });
 return container;
}
async function click(c: HTMLElement, label: string) {
 const button = Array.from(c.querySelectorAll('button')).find(b => b.textContent === label);
 expect(button, label).toBeTruthy(); await act(async () => { button!.click(); });
}
it('keeps failed saves unsaved and successfully reloads independent snapshots', async () => {
 const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ reviews: [] }) })
   .mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ reviews: [saved] }) });
 vi.stubGlobal('fetch', fetcher);
 const c = await render(); await click(c, '복기 노트에 저장');
 expect(c.querySelector('[role="alert"]')).toBeTruthy();
 expect(c.textContent).not.toContain('노트에 저장됨');
 await click(c, '복기 노트에 저장');
 expect(c.textContent).toContain('노트에 저장됨');
 await click(c, '복기 노트 (1)');
 expect(c.textContent).toContain('Hero: raises');
 expect(c.querySelector('textarea')?.value).toBe('first thought');
});
it('keeps edits and existing entries on update/delete failure, then completes and removes after acknowledgement', async () => {
 let fail = true;
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, options) => {
  if (!options?.method) return { ok: true, json: async () => ({ reviews: [saved] }) };
  const mutation = JSON.parse(options.body);
  return { ok: !fail, json: async () => ({ reviews: mutation.action === 'delete' ? [] : [{ ...saved, ...mutation }] }) };
 }));
 const c = await render(); await click(c, '복기 노트 (1)');
 const textarea = c.querySelector('textarea')!;
 await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'new thought'); textarea.dispatchEvent(new Event('input', { bubbles: true })); });
 await click(c, '완료로 저장');
 expect(c.querySelector('[role="alert"]')).toBeTruthy(); expect(textarea.value).toBe('new thought');
 await click(c, '노트 삭제'); await click(c, '삭제 확인'); expect(c.textContent).toContain('Hand #42');
 fail = false; await click(c, '완료로 저장');
 expect(c.textContent).not.toContain('Hand #42');
 await click(c, '완료'); expect(c.textContent).toContain('Hand #42');
 await click(c, '노트 삭제'); await click(c, '삭제 확인'); expect(c.textContent).not.toContain('Hand #42');
});

it('disables editing until pending save acknowledges the captured draft', async () => {
 let resolveSave!: (value: unknown) => void;
 vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ reviews: [saved] }) }).mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; })));
 const c = await render(); await click(c, '복기 노트 (1)'); await click(c, '메모 저장');
 expect(c.querySelector('textarea')!.disabled).toBe(true);
 await act(async () => { resolveSave({ ok: true, json: async () => ({ reviews: [saved] }) }); });
 expect(c.querySelector('textarea')!.disabled).toBe(false);
 expect(c.textContent).toContain('메모를 저장했습니다.');
});
