# Cash Hand Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated `캐시 핸드레인지` page that lazily loads the encrypted 100BB cash-game dataset and shows either a mixed-frequency 13×13 chart or one hand's action frequencies.

**Architecture:** Keep the existing global chart loader unchanged. The new page owns its fetch lifecycle, while a small pure domain module validates the payload, normalizes hand input, selects scenarios, and derives action display data. A dedicated grid renders mixed frequencies without changing the existing `RangeGrid`.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Tailwind CSS, Vitest 4, OpenSSL AES-256-CBC/PBKDF2

## Global Constraints

- Fetch `gto-cache-preflop-chart.json` only while the `캐시 핸드레인지` page is mounted.
- Keep existing page loading and existing `RangeGrid` behavior unchanged.
- Support all 22 scenarios, including the three SB/BB limp and raise scenarios.
- This page is 100BB-only and must not show the global stack tabs.
- Accept canonical 169-hand notation after trimming and case normalization.
- Show all positive action frequencies; hide 0% actions; preserve bet sizes in labels.
- Render mixed chart cells with frequency-proportional color segments.
- Keep plaintext JSON ignored; commit only `public/gto-cache-preflop-chart.json.enc` using the existing `DATA_KEY` and OpenSSL settings.
- Add no dependencies.

---

### Task 1: Cash range domain model and selection logic

**Files:**

- Create: `src/utils/cashRange.ts`
- Create: `src/utils/cashRange.test.ts`

**Interfaces:**

- Consumes: `RANKS` from `src/constants.ts` and `getHandName` from `src/utils/hand.ts`.
- Produces:
  - `CashPosition = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB'`
  - `CashSituation = 'unopened' | 'opened' | 'sb-limp' | 'sb-raise' | 'bb-raise-after-limp'`
  - `CashScenario`, `CashRangeData`, and `CashAction` interfaces
  - `parseCashRangeData(value: unknown): CashRangeData`
  - `normalizeCashHand(value: string): string | null`
  - `getAvailableCashPositions(data: CashRangeData): CashPosition[]`
  - `getAvailableCashSituations(data: CashRangeData, hero: CashPosition): CashSituation[]`
  - `getAvailableCashOpeners(data: CashRangeData, hero: CashPosition): CashPosition[]`
  - `findCashScenario(data: CashRangeData, hero: CashPosition, situation: CashSituation, opener?: CashPosition): CashScenario | null`
  - `getCashActions(frequencies: Record<string, number>): CashAction[]`
  - `getPrimaryCashActions(actions: CashAction[]): CashAction[]`
  - `getCashActionLabel(action: string): string`
  - `getCashActionColor(action: string): string`
  - `getCashActionGradient(frequencies: Record<string, number>): string`

- [ ] **Step 1: Write failing domain tests**

Create `src/utils/cashRange.test.ts` with a compact fixture containing RFI, opened-pot, and all three blind scenarios:

```ts
import { describe, expect, it } from 'vitest';
import {
  findCashScenario,
  getAvailableCashOpeners,
  getAvailableCashSituations,
  getCashActionGradient,
  getCashActionLabel,
  getCashActions,
  getPrimaryCashActions,
  normalizeCashHand,
  parseCashRangeData,
} from './cashRange';

const scenarios = [
  { id: 'utg_rfi', position: 'UTG', actionHistory: [], availableActions: ['raise_2.5', 'fold'], hands: { AKs: { raise_2.5: 71, fold: 29 } } },
  { id: 'btn_vs_utg', position: 'BTN', actionHistory: [['UTG', 'raise_2.5'], ['HJ', 'fold'], ['CO', 'fold']], availableActions: ['raise_8', 'call', 'fold'], hands: { AKs: { raise_8: 50, call: 50, fold: 0 } } },
  { id: 'btn_vs_co', position: 'BTN', actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'raise_2.5']], availableActions: ['raise_8', 'call', 'fold'], hands: { AKs: { raise_8: 60, call: 40, fold: 0 } } },
  { id: 'bb_vs_sb_limp', position: 'BB', actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'call']], availableActions: ['raise_3.5', 'check'], hands: { AKs: { raise_3.5: 75, check: 25 } } },
  { id: 'bb_vs_sb_raise', position: 'BB', actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'raise_3.5']], availableActions: ['raise_10.5', 'call', 'fold'], hands: { AKs: { raise_10.5: 25, call: 75, fold: 0 } } },
  { id: 'sb_vs_bb_raise_after_limp', position: 'SB', actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'call'], ['BB', 'raise_3.5']], availableActions: ['raise_14', 'call', 'fold'], hands: { AKs: { raise_14: 50, call: 50, fold: 0 } } },
] as const;

const data = parseCashRangeData({
  game: { name: '6-max NL10 cash', stackBb: 100, openSizeBb: 2.5 },
  scenarios,
});

describe('cashRange', () => {
  it('validates the payload boundary', () => {
    expect(data.scenarios).toHaveLength(6);
    expect(() => parseCashRangeData({
      game: { name: 'bad', stackBb: 100, openSizeBb: 2.5 },
      scenarios: [{ id: 'bad' }],
    })).toThrow('Invalid cash range scenario');
    expect(() => parseCashRangeData({
      game: { name: 'bad', stackBb: 100, openSizeBb: 2.5 },
      scenarios: [{ ...scenarios[0], hands: { AKs: { raise_2.5: 'often' } } }],
    })).toThrow('Invalid cash range frequencies');
  });

  it.each([
    [' aks ', 'AKs'],
    ['qjo', 'QJo'],
    ['tt', 'TT'],
    ['KAo', null],
    ['AAo', null],
    ['', null],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeCashHand(input)).toBe(expected);
  });

  it('lists only valid situations and openers for the hero', () => {
    expect(getAvailableCashSituations(data, 'BTN')).toEqual(['opened']);
    expect(getAvailableCashOpeners(data, 'BTN')).toEqual(['UTG', 'CO']);
    expect(getAvailableCashSituations(data, 'BB')).toEqual(['sb-limp', 'sb-raise']);
    expect(getAvailableCashSituations(data, 'SB')).toContain('bb-raise-after-limp');
  });

  it('selects regular and blind scenarios from position and action history', () => {
    expect(findCashScenario(data, 'UTG', 'unopened')?.id).toBe('utg_rfi');
    expect(findCashScenario(data, 'BTN', 'opened', 'CO')?.id).toBe('btn_vs_co');
    expect(findCashScenario(data, 'BB', 'sb-limp')?.id).toBe('bb_vs_sb_limp');
    expect(findCashScenario(data, 'BB', 'sb-raise')?.id).toBe('bb_vs_sb_raise');
    expect(findCashScenario(data, 'SB', 'bb-raise-after-limp')?.id).toBe('sb_vs_bb_raise_after_limp');
  });

  it('drops zero frequencies, sorts descending, and keeps tied primary actions', () => {
    const actions = getCashActions({ raise_8: 50, call: 50, fold: 0 });
    expect(actions).toEqual([
      { action: 'raise_8', frequency: 50 },
      { action: 'call', frequency: 50 },
    ]);
    expect(getPrimaryCashActions(actions)).toEqual(actions);
  });

  it('formats bet sizes and builds a proportional split gradient', () => {
    expect(getCashActionLabel('raise_2.5')).toBe('2.5BB 레이즈');
    expect(getCashActionLabel('all_in_100')).toBe('100BB 올인');
    const gradient = getCashActionGradient({ raise_2.5: 71, fold: 29, all_in_100: 0 });
    expect(gradient).toContain('71%');
    expect(gradient).toContain('100%');
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run: `npm test -- src/utils/cashRange.test.ts`

Expected: FAIL because `./cashRange` does not exist.

- [ ] **Step 3: Implement the minimal domain module**

Create `src/utils/cashRange.ts`. Use a generated set of canonical hands instead of maintaining a second rank table, validate only the fields consumed by the page, and classify scenarios from `position` plus `actionHistory`:

```ts
import { RANKS } from '../constants';
import { getHandName } from './hand';

export type CashPosition = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type CashSituation = 'unopened' | 'opened' | 'sb-limp' | 'sb-raise' | 'bb-raise-after-limp';
export type CashActionFrequencies = Record<string, number>;

export interface CashScenario {
  id: string;
  position: CashPosition;
  actionHistory: [CashPosition, string][];
  availableActions: string[];
  hands: Record<string, CashActionFrequencies>;
}

export interface CashRangeData {
  game: { name: string; stackBb: number; openSizeBb: number };
  scenarios: CashScenario[];
}

export interface CashAction {
  action: string;
  frequency: number;
}

const POSITIONS = new Set<CashPosition>(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
const VALID_HANDS = new Set(
  RANKS.flatMap((_, row) => RANKS.map((__, column) => getHandName(row, column))),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCashRangeData(value: unknown): CashRangeData {
  if (!isRecord(value) || !isRecord(value.game) ||
      typeof value.game.name !== 'string' || typeof value.game.stackBb !== 'number' ||
      typeof value.game.openSizeBb !== 'number' || !Array.isArray(value.scenarios)) {
    throw new Error('Invalid cash range payload');
  }
  for (const scenario of value.scenarios) {
    if (!isRecord(scenario) || typeof scenario.id !== 'string' ||
        typeof scenario.position !== 'string' || !POSITIONS.has(scenario.position as CashPosition) ||
        !Array.isArray(scenario.actionHistory) || !scenario.actionHistory.every(entry =>
          Array.isArray(entry) && entry.length === 2 && POSITIONS.has(entry[0] as CashPosition) && typeof entry[1] === 'string') ||
        !Array.isArray(scenario.availableActions) || !scenario.availableActions.every(action => typeof action === 'string') ||
        !isRecord(scenario.hands)) {
      throw new Error('Invalid cash range scenario');
    }
    for (const frequencies of Object.values(scenario.hands)) {
      if (!isRecord(frequencies) || !Object.values(frequencies).every(frequency =>
        typeof frequency === 'number' && Number.isFinite(frequency) && frequency >= 0 && frequency <= 100)) {
        throw new Error('Invalid cash range frequencies');
      }
    }
  }
  return value as unknown as CashRangeData;
}

export function normalizeCashHand(value: string): string | null {
  const upper = value.trim().toUpperCase();
  const hand = upper.length === 3 ? `${upper.slice(0, 2)}${upper[2].toLowerCase()}` : upper;
  return VALID_HANDS.has(hand) ? hand : null;
}

function nonFoldHistory(scenario: CashScenario) {
  return scenario.actionHistory.filter(([, action]) => action !== 'fold');
}

function situationOf(scenario: CashScenario): CashSituation | null {
  const actions = nonFoldHistory(scenario);
  if (actions.length === 0) return 'unopened';
  if (scenario.position === 'BB' && actions.length === 1 && actions[0][0] === 'SB' && actions[0][1] === 'call') return 'sb-limp';
  if (scenario.position === 'BB' && actions.length === 1 && actions[0][0] === 'SB' && actions[0][1] === 'raise_3.5') return 'sb-raise';
  if (scenario.position === 'SB' && actions.length === 2 && actions[0][0] === 'SB' && actions[0][1] === 'call' && actions[1][0] === 'BB') return 'bb-raise-after-limp';
  if (actions.length === 1 && actions[0][1] === 'raise_2.5') return 'opened';
  return null;
}

export function getAvailableCashPositions(data: CashRangeData): CashPosition[] {
  return [...new Set(data.scenarios.map(scenario => scenario.position))];
}

export function getAvailableCashSituations(data: CashRangeData, hero: CashPosition): CashSituation[] {
  return [...new Set(data.scenarios.filter(s => s.position === hero).map(situationOf).filter((value): value is CashSituation => value !== null))];
}

export function getAvailableCashOpeners(data: CashRangeData, hero: CashPosition): CashPosition[] {
  return data.scenarios
    .filter(s => s.position === hero && situationOf(s) === 'opened')
    .map(s => nonFoldHistory(s)[0][0]);
}

export function findCashScenario(data: CashRangeData, hero: CashPosition, situation: CashSituation, opener?: CashPosition): CashScenario | null {
  return data.scenarios.find(scenario => {
    if (scenario.position !== hero || situationOf(scenario) !== situation) return false;
    return situation !== 'opened' || nonFoldHistory(scenario)[0][0] === opener;
  }) ?? null;
}

export function getCashActions(frequencies: CashActionFrequencies): CashAction[] {
  return Object.entries(frequencies)
    .filter(([, frequency]) => frequency > 0)
    .map(([action, frequency]) => ({ action, frequency }))
    .sort((a, b) => b.frequency - a.frequency);
}

export function getPrimaryCashActions(actions: CashAction[]): CashAction[] {
  return actions.length === 0 ? [] : actions.filter(action => action.frequency === actions[0].frequency);
}

export function getCashActionLabel(action: string): string {
  if (action.startsWith('raise_')) return `${action.slice(6)}BB 레이즈`;
  if (action.startsWith('all_in_')) return `${action.slice(7)}BB 올인`;
  return ({ call: '콜', fold: '폴드', check: '체크' } as Record<string, string>)[action] ?? action;
}

export function getCashActionColor(action: string): string {
  if (action.startsWith('raise_')) return '#C94040';
  if (action.startsWith('all_in_')) return '#7B2FBE';
  return ({ call: '#2AA875', check: '#1C7AA8', fold: '#374151' } as Record<string, string>)[action] ?? '#6b7280';
}

export function getCashActionGradient(frequencies: CashActionFrequencies): string {
  let start = 0;
  const stops = getCashActions(frequencies).flatMap(({ action, frequency }) => {
    const end = start + frequency;
    const color = getCashActionColor(action);
    const segment = [`${color} ${start}%`, `${color} ${end}%`];
    start = end;
    return segment;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
```

Before committing, adjust only if TypeScript reveals a concrete narrowing issue; do not add schema libraries.

- [ ] **Step 4: Run focused tests and diagnostics**

Run: `npm test -- src/utils/cashRange.test.ts`

Expected: 6 tests PASS.

Run: LSP diagnostics for `src/utils/cashRange.ts` and `src/utils/cashRange.test.ts`.

Expected: no errors.

- [ ] **Step 5: Commit the domain module**

```bash
git add src/utils/cashRange.ts src/utils/cashRange.test.ts
git commit -m "feat: add cash range scenario logic"
```

---

### Task 2: Mixed-frequency cash range grid

**Files:**

- Create: `src/components/CashRangeGrid.tsx`
- Create: `src/components/CashRangeGrid.test.tsx`

**Interfaces:**

- Consumes: `CashScenario`, `getCashActions`, `getCashActionGradient`, and `getCashActionLabel` from Task 1; `RANKS`; `getHandName`.
- Produces: `CashRangeGrid({ scenario, highlightedHand }: { scenario: CashScenario; highlightedHand: string | null })`.

- [ ] **Step 1: Write a failing rendering test**

Create `src/components/CashRangeGrid.test.tsx` using the repository's existing `react-dom/client` and `act` pattern. Render a scenario where `AA` is 71% raise and 29% fold, then assert that the AA cell exposes both frequencies and a split gradient:

```tsx
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
  hands: { AA: { raise_2.5: 71, fold: 29 } },
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
    cleanup = () => { act(() => root.unmount()); container.remove(); };

    const cell = container.querySelector('[data-hand="AA"]') as HTMLElement;
    expect(cell.title).toContain('2.5BB 레이즈 71%');
    expect(cell.title).toContain('폴드 29%');
    expect(cell.style.backgroundImage).toContain('71%');
    expect(cell.getAttribute('data-highlighted')).toBe('true');
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing component failure**

Run: `npm test -- src/components/CashRangeGrid.test.tsx`

Expected: FAIL because `./CashRangeGrid` does not exist.

- [ ] **Step 3: Implement the dedicated grid**

Create `src/components/CashRangeGrid.tsx` by reusing the existing grid dimensions and hand ordering, but not modifying `RangeGrid.tsx`. For each cell:

```tsx
const frequencies = scenario.hands[hand] ?? { fold: 100 };
const actions = getCashActions(frequencies);
const title = `${hand} — ${actions.map(({ action, frequency }) => `${getCashActionLabel(action)} ${frequency}%`).join(', ')}`;
```

Render `data-hand`, `data-highlighted`, `title`, `backgroundImage: getCashActionGradient(frequencies)`, the hand name, and a compact label made from the positive actions (for example `R 71 / F 29`). Use the same `clamp(28px, 5.5vw, 52px)` cell size and 13-column CSS grid as `RangeGrid`. Highlight the selected hand with the existing yellow outline and glow values. Keep the component read-only; do not add click or hover state.

- [ ] **Step 4: Run focused tests and diagnostics**

Run: `npm test -- src/components/CashRangeGrid.test.tsx`

Expected: 1 test PASS.

Run LSP diagnostics for both new component files.

Expected: no errors.

- [ ] **Step 5: Commit the grid**

```bash
git add src/components/CashRangeGrid.tsx src/components/CashRangeGrid.test.tsx
git commit -m "feat: render mixed cash range frequencies"
```

---

### Task 3: Lazy-loaded page and menu integration

**Files:**

- Create: `src/pages/CashHandRangePage.tsx`
- Create: `src/pages/CashHandRangePage.test.tsx`
- Modify: `src/app/viewRegistry.tsx:1-73`

**Interfaces:**

- Consumes: all Task 1 selectors and formatters; `CashRangeGrid` from Task 2.
- Produces: `CashHandRangePage()` and a new `View` value, `'cash-range'`.

- [ ] **Step 1: Write failing lazy-loading and registry tests**

Create `src/pages/CashHandRangePage.test.tsx`. Use `createRoot`, `act`, `vi.stubGlobal('fetch', fetchSpy)`, and a minimal valid payload. Cover these exact outcomes:

```tsx
it('requests cash data only when the cash page mounts', async () => {
  const fetchSpy = vi.fn(async () => ({
    ok: true,
    json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchSpy);

  const openContainer = renderNode(renderView({
    view: 'open-range', stack: '100BB', data: existingData, onNavigate: vi.fn(),
  }));
  expect(fetchSpy).not.toHaveBeenCalled();
  openContainer.cleanup();

  const cashContainer = renderNode(renderView({
    view: 'cash-range', stack: '100BB', data: existingData, onNavigate: vi.fn(),
  }));
  await flushEffects();
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(fetchSpy).toHaveBeenCalledWith('/gto-cache-preflop-chart.json', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  cashContainer.cleanup();
});

it('registers the page without stack tabs', () => {
  expect(getViewMeta('cash-range')).toMatchObject({ label: '캐시 핸드레인지', showStackTabs: false });
});

it('keeps a cash data load failure inside the page', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
  const view = renderNode(<CashHandRangePage />);
  await flushEffects();
  expect(view.container.textContent).toContain('캐시 데이터 로드 실패');
  view.cleanup();
});
```

The helper `renderNode` must create/remove a DOM container and root. `flushEffects` must await two resolved promises inside async `act`, matching the style in `src/hooks/useAuth.test.tsx`. Build `existingData` with empty stacks for all four `StackSize` keys because only the open-range render needs it.

- [ ] **Step 2: Run the page tests and confirm failures**

Run: `npm test -- src/pages/CashHandRangePage.test.tsx`

Expected: FAIL because `CashHandRangePage` and `'cash-range'` do not exist.

- [ ] **Step 3: Implement page-local fetching and controls**

Create `src/pages/CashHandRangePage.tsx` with these state values:

```ts
const [data, setData] = useState<CashRangeData | null>(null);
const [error, setError] = useState<string | null>(null);
const [hero, setHero] = useState<CashPosition>('UTG');
const [situation, setSituation] = useState<CashSituation>('unopened');
const [opener, setOpener] = useState<CashPosition | undefined>();
const [handInput, setHandInput] = useState('');
const [showChart, setShowChart] = useState(true);
```

The only fetch must be inside this component's mount effect:

```ts
useEffect(() => {
  const controller = new AbortController();
  fetch(`${import.meta.env.BASE_URL}gto-cache-preflop-chart.json`, { signal: controller.signal })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(value => setData(parseCashRangeData(value)))
    .catch(fetchError => {
      if (fetchError.name !== 'AbortError') setError(fetchError.message);
    });
  return () => controller.abort();
}, []);
```

After data loads:

1. Populate hero options from `getAvailableCashPositions`.
2. Populate situation options from `getAvailableCashSituations(data, hero)` with Korean labels: `오픈 없음`, `오픈 있음`, `SB 림프`, `SB 레이즈`, `SB 림프 후 BB 레이즈`.
3. When hero changes, select the first available situation if the current one is invalid.
4. For `opened`, populate the opener select from `getAvailableCashOpeners`; otherwise hide it.
5. Resolve the scenario with `findCashScenario`.
6. Normalize the hand with `normalizeCashHand`; show `AA, AKs, AKo 형식으로 입력하세요.` only when non-empty input is invalid.
7. Keep the hand input visible in both modes.
8. When `showChart` is true, render `CashRangeGrid` and an action legend using colors and labels from Task 1.
9. When `showChart` is false and the hand is valid, render every positive action frequency and mark every action from `getPrimaryCashActions` as `주 액션`.
10. If no scenario matches, render `선택한 상황의 차트가 없습니다.` inside this page.

Use native `<select>`, `<input type="text">`, and `<input type="checkbox">`; add no form or UI dependencies.

- [ ] **Step 4: Register the view**

Modify `src/app/viewRegistry.tsx`:

```tsx
import { CashHandRangePage } from '../pages/CashHandRangePage';
```

Add `'cash-range'` to `View`, add this menu entry immediately after Facing Charts:

```ts
{ value: 'cash-range', label: '캐시 핸드레인지', maxWidth: 'normal', showStackTabs: false },
```

Add the render case without passing global chart data:

```tsx
case 'cash-range':
  return <CashHandRangePage />;
```

Do not modify `App.tsx` or `useChartData.ts`; this preserves existing app startup behavior.

- [ ] **Step 5: Run page tests and diagnostics**

Run: `npm test -- src/pages/CashHandRangePage.test.tsx`

Expected: 3 tests PASS and fetch remains uncalled for the existing page render.

Run LSP diagnostics for `src/pages/CashHandRangePage.tsx`, its test, and `src/app/viewRegistry.tsx`.

Expected: no errors.

- [ ] **Step 6: Commit the page**

```bash
git add src/pages/CashHandRangePage.tsx src/pages/CashHandRangePage.test.tsx src/app/viewRegistry.tsx
git commit -m "feat: add lazy cash hand range page"
```

---

### Task 4: Encrypt and wire the new dataset

**Files:**

- Modify: `.gitignore:15-19`
- Modify: `package.json:6-15`
- Create: `public/gto-cache-preflop-chart.json.enc`
- Keep ignored: `public/gto-cache-preflop-chart.json`

**Interfaces:**

- Consumes: existing `DATA_KEY` environment variable and plaintext JSON supplied by the user.
- Produces: repository-safe encrypted data and build scripts that decrypt both chart files before Vercel builds.

- [ ] **Step 1: Confirm the plaintext is ignored and the key is available**

Run:

```bash
git check-ignore public/gto-cache-preflop-chart.json
test -n "$DATA_KEY" && echo "DATA_KEY available"
```

Expected: the JSON path is printed and `DATA_KEY available` is printed. If the key is absent, stop and ask the user to expose the existing deployment key locally; do not invent or replace it because both datasets must use the established key.

- [ ] **Step 2: Encrypt only the new dataset**

Run:

```bash
openssl enc -aes-256-cbc -e -salt -pbkdf2 \
  -in public/gto-cache-preflop-chart.json \
  -out public/gto-cache-preflop-chart.json.enc \
  -pass pass:"$DATA_KEY"
```

Expected: `public/gto-cache-preflop-chart.json.enc` exists and is non-empty. Do not run the existing `npm run encrypt` yet because that would unnecessarily regenerate the existing encrypted chart with a new salt.

- [ ] **Step 3: Extend the existing scripts without adding helpers**

Keep `.gitignore` containing both plaintext paths:

```gitignore
public/gto-preflop-charts-all.json
public/gto-cache-preflop-chart.json
```

Change `package.json` scripts so each command handles both files using `&&`:

```json
"decrypt": "openssl enc -aes-256-cbc -d -salt -pbkdf2 -in public/gto-preflop-charts-all.json.enc -out public/gto-preflop-charts-all.json -pass pass:$DATA_KEY && openssl enc -aes-256-cbc -d -salt -pbkdf2 -in public/gto-cache-preflop-chart.json.enc -out public/gto-cache-preflop-chart.json -pass pass:$DATA_KEY",
"encrypt": "openssl enc -aes-256-cbc -e -salt -pbkdf2 -in public/gto-preflop-charts-all.json -out public/gto-preflop-charts-all.json.enc -pass pass:$DATA_KEY && openssl enc -aes-256-cbc -e -salt -pbkdf2 -in public/gto-cache-preflop-chart.json -out public/gto-cache-preflop-chart.json.enc -pass pass:$DATA_KEY"
```

Leave `build:vercel` as `npm run decrypt && npm run build`.

- [ ] **Step 4: Verify encryption round-trip without modifying plaintext**

Run:

```bash
openssl enc -aes-256-cbc -d -salt -pbkdf2 \
  -in public/gto-cache-preflop-chart.json.enc \
  -out /tmp/gto-cache-preflop-chart.json \
  -pass pass:"$DATA_KEY"
cmp public/gto-cache-preflop-chart.json /tmp/gto-cache-preflop-chart.json
rm /tmp/gto-cache-preflop-chart.json
git check-ignore public/gto-cache-preflop-chart.json
```

Expected: `cmp` exits 0 and Git reports the plaintext as ignored.

- [ ] **Step 5: Commit scripts and encrypted data**

Clean the unrelated trailing blank lines from the current `.gitignore` diff while preserving the user's new ignore rule, then run:

```bash
git add .gitignore package.json public/gto-cache-preflop-chart.json.enc
git commit -m "build: encrypt cash preflop data"
```

---

### Task 5: Full regression verification

**Files:**

- No source changes expected.

**Interfaces:**

- Consumes: completed Tasks 1-4.
- Produces: verification evidence only.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all existing and new Vitest tests PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit 0 with no ESLint errors.

- [ ] **Step 3: Run proactive diagnostics**

Run LSP diagnostics for `src`, followed by `lens_diagnostics` with `mode=all`.

Expected: no blocking errors in edited files.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully and produce `dist/`.

- [ ] **Step 5: Verify lazy asset behavior in the built output**

Run `npm run preview`, visit an existing page, and confirm the Network panel has no `gto-cache-preflop-chart.json` request. Open `캐시 핸드레인지` and confirm exactly one request occurs, then verify:

- UTG / 오픈 없음 / `AKs` shows action frequencies.
- BTN / 오픈 있음 / CO displays `btn_vs_co` data.
- BB / SB 림프 displays the limp-response chart.
- Turning the chart off leaves the hand-specific result visible.
- Mixed cells show proportional split colors.

Expected: all checks pass and existing Open Range/Facing pages remain unchanged.

- [ ] **Step 6: Confirm repository state**

Run:

```bash
git status --short
git log -5 --oneline
```

Expected: no unintended files are staged or modified; plaintext cash JSON remains absent from status because it is ignored. Do not commit `dist/`.
