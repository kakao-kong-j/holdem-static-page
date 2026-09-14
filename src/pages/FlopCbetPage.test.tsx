// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { FlopCbetPage } from './FlopCbetPage';
import { flopCbetFixture } from '../test/flopCbetFixture';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
const imageUrl = 'https://synthetic.public.blob.vercel-storage.com/flop-cbet/example';
function mockChartAndImages() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.endsWith('flop-cbet-images.json')
      ? { schema_version: 1, images: { example: imageUrl } }
      : flopCbetFixture(),
  })));
}
async function mount() {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(<FlopCbetPage />); });
  return container;
}
function select(c: HTMLElement, label: string, value: string) {
  const node = c.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  act(() => { node.value = value; node.dispatchEvent(new Event('change', { bubbles: true })); });
}
it('updates graph, dependent controls and action labels without retaining invalid combinations', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => flopCbetFixture() })));
  const c = await mount();
  expect(c.querySelectorAll('tbody tr')).toHaveLength(2);
  expect(c.querySelector('tbody tr')?.textContent).toContain('Paired');
  expect(c.querySelector('[aria-label="조회 보드 평균 빈도"]')?.textContent).toContain('50%');
  expect(c.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('80');
  select(c, '상대 유형', 'Calling Station');
  expect(c.querySelector<HTMLSelectElement>('select[aria-label="스택"]')?.value).toBe('20');
  expect(c.querySelector('tbody')?.textContent).toContain('99%');
  select(c, '상황', '4bp-oop');
  expect(c.querySelectorAll('select[aria-label="스택"] option')).toHaveLength(1);
  expect(c.querySelector<HTMLSelectElement>('select[aria-label="스택"]')?.value).toBe('50');
  expect(c.querySelector('tbody')?.textContent).toContain('ALL-IN');
  select(c, '상황', 'blind-war');
  expect(c.querySelector('thead')?.textContent).toContain('Stab 빈도');
  expect(c.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('0');
});

it('searches, sorts and resets both rows and summary, retaining image previews', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => flopCbetFixture() })));
  const c = await mount();
  select(c, '정렬', 'frequency-asc');
  expect(c.querySelector('tbody tr')?.textContent).toContain('20%');
  const input = c.querySelector<HTMLInputElement>('input[aria-label="보드 검색"]')!;
  const search = (value: string) => act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  search('AsKs3h');
  expect(c.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(c.querySelector('[aria-label="조회 보드 평균 빈도"]')?.textContent).toContain('20%');
  expect(c.querySelector('tbody button[aria-haspopup="dialog"]')).not.toBeNull();
  search('없는보드');
  expect(c.querySelectorAll('tbody tr')).toHaveLength(0);
  expect(c.textContent).toContain('조건에 맞는 보드가 없습니다');
  expect(c.querySelector('[aria-label="조회 보드 평균 빈도"]')?.textContent).toContain('—');
  act(() => [...c.querySelectorAll('button')].find(b => b.textContent === '초기화')!.click());
  expect(c.querySelectorAll('tbody tr')).toHaveLength(2);
});

it.each(['close-button', 'backdrop', 'escape'])('opens the selected source in a modal and restores focus on %s', async method => {
  mockChartAndImages();
  const c = await mount();
  const opener = c.querySelector<HTMLButtonElement>('tbody button[aria-haspopup="dialog"]');
  expect(opener).not.toBeNull();
  opener!.focus();
  await act(async () => opener!.click());
  const dialog = c.querySelector<HTMLDialogElement>('dialog')!;
  expect(dialog.open).toBe(true);
  expect(dialog.textContent).toContain('As Ah 7s');
  expect(dialog.textContent).toContain('BTN vs BB');
  expect(dialog.querySelector('iframe')).toBeNull();
  expect(dialog.querySelector('img')?.src).toBe(imageUrl);
  expect(dialog.querySelector('[role="status"]')).not.toBeNull();
  act(() => dialog.querySelector('img')!.dispatchEvent(new Event('load')));
  expect(dialog.querySelector('[role="status"]')).toBeNull();
  expect(document.body.style.overflow).toBe('hidden');
  act(() => {
    if (method === 'close-button') dialog.querySelector<HTMLButtonElement>('button[aria-label="이미지 닫기"]')!.click();
    if (method === 'backdrop') dialog.click();
    if (method === 'escape') dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  });
  expect(c.querySelector('dialog')).toBeNull();
  expect(document.body.style.overflow).not.toBe('hidden');
  expect(document.activeElement).toBe(opener);
  expect(c.querySelectorAll('tbody tr')).toHaveLength(2);
});

it('retries a failed image without changing the selected chart', async () => {
  mockChartAndImages();
  const c = await mount();
  await act(async () => c.querySelector<HTMLButtonElement>('tbody button[aria-haspopup="dialog"]')!.click());
  const dialog = c.querySelector('dialog')!;
  act(() => dialog.querySelector('img')!.dispatchEvent(new Event('error')));
  expect(dialog.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => [...dialog.querySelectorAll('button')].find(b => b.textContent === '다시 시도')!.click());
  expect(dialog.querySelector('[role="alert"]')).toBeNull();
  expect(dialog.querySelector('img')?.src).toBe(imageUrl);
  act(() => dialog.querySelector('img')!.dispatchEvent(new Event('load')));
  expect(dialog.querySelector('[role="status"]')).toBeNull();
  expect(dialog.textContent).toContain('As Ah 7s');
});

it.each(['http', 'missing', 'unsafe'])('shows an image error while preserving charts when the image index is %s', async failure => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('flop-cbet-images.json')
    ? { ok: failure !== 'http', status: 503, json: async () => ({ schema_version: 1, images: failure === 'missing' ? {} : { example: 'https://evil.test/image' } }) }
    : { ok: true, json: async () => flopCbetFixture() }));
  const c = await mount();
  await act(async () => c.querySelector<HTMLButtonElement>('tbody button[aria-haspopup="dialog"]')!.click());
  expect(c.querySelector('dialog [role="alert"]')).not.toBeNull();
  expect(c.querySelector('dialog img')).toBeNull();
  expect(c.querySelector('iframe')).toBeNull();
  expect(c.querySelectorAll('tbody tr')).toHaveLength(2);
});

it.each(['http', 'invalid-data'])('recovers with retry after %s failure', async failure => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(failure === 'http' ? { ok: false, status: 503 } : { ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => flopCbetFixture() }));
  const c = await mount();
  expect(c.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => { c.querySelector<HTMLButtonElement>('button')!.click(); });
  expect(c.querySelectorAll('tbody tr')).toHaveLength(2);
});

it('distinguishes actual and inferred boards, shows the reference, and respects the current context', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => flopCbetFixture() })));
  const c = await mount();
  const lookup = c.querySelector<HTMLElement>('section[aria-label="플랍 직접 입력"]')!;
  const input = lookup.querySelector<HTMLInputElement>('input')!;
  const lookupBoard = (value: string) => {
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => lookup.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  };
  lookupBoard('asah7s');
  expect(lookup.textContent).toContain('실제 목록');
  expect(lookup.textContent).toContain('Paired');
  lookupBoard('ac kc 3d');
  expect(lookup.textContent).toContain('추측 기반');
  expect(lookup.textContent).toContain('참고 보드: A♠ K♠ 3♥ (AsKs3h)');
  expect(lookup.textContent).toContain('1. 무늬 변경');
  expect(lookup.textContent).toContain('참고 보드의 C-bet: 사이즈 50% · 빈도 20%');
  expect(c.querySelectorAll('tbody tr')).toHaveLength(2);
  expect(c.querySelector('[aria-label="조회 보드 평균 빈도"]')?.textContent).toContain('50%');
  lookupBoard('asjs7s');
  expect(lookup.textContent).toContain('3. 같은 텍스처에서 가장 가까운 보드');
  expect(lookup.textContent).toContain('입력 텍스처(규칙 분류): ABx');
  expect(lookup.textContent).toContain('(AsKs3h)');
  select(c, '상대 유형', 'Calling Station');
  expect(lookup.textContent).toContain('참고 보드 없음');
  expect(lookup.textContent).not.toContain('20%');
  lookupBoard('AsAs7s');
  expect(lookup.querySelector('[role="alert"]')?.textContent).toContain('서로 다른 카드 3장');
  act(() => [...c.querySelectorAll('button')].find(b => b.textContent === '초기화')!.click());
  expect(c.querySelector<HTMLInputElement>('input[aria-label="플랍 보드 입력"]')!.value).toBe('');
});
