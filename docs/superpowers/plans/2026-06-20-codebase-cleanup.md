# Codebase Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove stale GitHub Pages support, restore lint health, document Blob privacy risk, split high-level responsibilities, and validate chart JSON at runtime.

**Architecture:** Keep the no-router SPA architecture. Move view/layout metadata out of `src/App.tsx`, extract store orchestration from the two largest pages into hooks, and add a small chart-data validator consumed by `useChartData`.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest 4, ESLint 9, Vercel Functions, Vercel Blob.

## Global Constraints

- Preserve current user-facing behavior except removing GitHub Pages deployment support.
- Vercel remains the active deployment target.
- Do not migrate Vercel Blob data to a private database or new storage provider.
- Do not redesign the visual UI.
- Do not introduce React Router.
- Do not refactor all large page markup in one pass.
- Do not change GTO chart semantics, combo totals, quiz sampling behavior, or bankroll/CoinPoker business logic except where needed to preserve behavior during extraction.
- Do not disable `react-hooks/set-state-in-effect` or `react-hooks/purity` globally.
- Run `npm run lint`, `npm test`, and `npm run build` before claiming completion.

---

## File Structure

Create or modify these files:

- Delete: `.github/workflows/deploy.yml` — removes stale GitHub Pages deployment.
- Modify: `CLAUDE.md` — remove GitHub Pages as primary deployment and describe Vercel as active deployment.
- Modify: `vite.config.ts` — simplify base path only if current GitHub Pages-only logic remains; keep Vercel/local behavior correct.
- Create: `docs/security/blob-privacy-review.md` — documents public Blob privacy posture.
- Create: `src/utils/chartDataValidation.ts` — exports `validateChartDataPayload(value: unknown): AllData`.
- Create: `src/utils/chartDataValidation.test.ts` — unit tests validator success and failure cases.
- Modify: `src/hooks/useChartData.ts` — consume validator instead of unchecked cast.
- Create: `src/app/viewRegistry.tsx` — exports `View`, `VIEWS`, `SB_OPEN_DISABLED_STACKS`, `getViewMeta`, and `renderView`.
- Create: `src/components/AppShell.tsx` — owns sidebar drawer, top bar, stack tabs, and frame layout.
- Modify: `src/App.tsx` — keeps auth/data/navigation orchestration only.
- Modify: `src/components/QuizCompareSection.tsx` — replace effect-driven selected-value correction with effective derived values.
- Modify: `src/pages/FacingPage.tsx` — replace effect-driven selected-value correction with effective derived values.
- Modify: `src/pages/QuizPage.tsx` — move timestamp creation into a callback body acceptable to lint.
- Create: `src/pages/bankroll/useBankrollStore.ts` — moves remote/local bankroll store orchestration from page.
- Modify: `src/pages/BankrollPage.tsx` — consume `useBankrollStore` while keeping UI markup recognizable.
- Create: `src/pages/coinpoker/useCoinPokerStore.ts` — moves remote/local CoinPoker store orchestration from page.
- Modify: `src/pages/CoinPokerAnalysisPage.tsx` — consume `useCoinPokerStore` while keeping derived analysis and UI markup recognizable.

---

### Task 1: Remove GitHub Pages Deployment and Update Deployment Docs

**Files:**
- Delete: `.github/workflows/deploy.yml`
- Modify: `CLAUDE.md`
- Inspect/possibly modify: `vite.config.ts`

**Interfaces:**
- Consumes: existing deployment docs in `CLAUDE.md` and existing Vite config.
- Produces: repository no longer deploys to GitHub Pages; docs identify Vercel as active deployment.

- [ ] **Step 1: Confirm current deployment references**

Run:

```bash
rg -n "GitHub Pages|gh-pages|holdem-static-page|build:vercel|VERCEL|base" CLAUDE.md README.md docs vite.config.ts package.json .github || true
```

Expected: output includes `.github/workflows/deploy.yml`, `CLAUDE.md`, and `vite.config.ts` references.

- [ ] **Step 2: Delete GitHub Pages workflow**

Run:

```bash
rm -f .github/workflows/deploy.yml
```

Expected: `git status --short` shows `D .github/workflows/deploy.yml`.

- [ ] **Step 3: Update `CLAUDE.md` deployment section**

Replace the deployment section with this exact content, preserving the rest of the file:

```markdown
## Deployment

**Vercel** (active):
- Config: `vercel.json` (framework=vite, buildCommand=`npm run build:vercel`)
- Root-domain serve → Vite `base` falls back to `/` when `VERCEL=1` is set
- Required env vars in Vercel dashboard: `DATA_KEY` (for `openssl` decrypt), `VITE_PASSWORD_HASH`
- Same source data (`public/gto-preflop-charts-all.json.enc`) decrypted at build

**GitHub Pages**:
- Removed. The app now depends on Vercel API routes for Google auth and server-side persistence, so GitHub Pages is no longer a supported deployment target.
```

- [ ] **Step 4: Simplify `vite.config.ts` only if it hardcodes GitHub Pages base**

Open `vite.config.ts`. If it contains a GitHub Pages fallback like `'/holdem-static-page/'`, change the `base` expression to Vercel/local root:

```ts
base: '/',
```

If `vite.config.ts` already uses `/` for Vercel/local and the old fallback is harmless but documented as GitHub Pages-only, simplify it to `/` to match the removed deployment path.

- [ ] **Step 5: Verify no active GitHub Pages workflow remains**

Run:

```bash
find .github -type f -maxdepth 3 -print 2>/dev/null || true
rg -n "GitHub Pages|gh-pages" CLAUDE.md README.md docs .github vite.config.ts || true
```

Expected: no `.github/workflows/deploy.yml`; remaining `GitHub Pages` references only explain removal or historical context.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add -A .github CLAUDE.md vite.config.ts
git commit -m "chore: remove github pages deployment"
```

Expected: commit succeeds.

---

### Task 2: Add Chart Data Runtime Validation

**Files:**
- Create: `src/utils/chartDataValidation.ts`
- Create: `src/utils/chartDataValidation.test.ts`
- Modify: `src/hooks/useChartData.ts`

**Interfaces:**
- Produces: `validateChartDataPayload(value: unknown): AllData`
- Consumes: `AllData` and `StackSize` from `src/types.ts`

- [ ] **Step 1: Write failing validator tests**

Create `src/utils/chartDataValidation.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { validateChartDataPayload } from './chartDataValidation';

const stack = {
  'UTG RFI': {
    raise: ['AA', 'AKs'],
    fold: ['72o'],
  },
};

function validPayload() {
  return {
    data: {
      '15BB': stack,
      '25BB': stack,
      '40BB': stack,
      '100BB': stack,
    },
  };
}

describe('validateChartDataPayload', () => {
  it('returns typed chart data for a valid payload', () => {
    const data = validateChartDataPayload(validPayload());
    expect(data['100BB']['UTG RFI'].raise).toEqual(['AA', 'AKs']);
  });

  it('throws when root data object is missing', () => {
    expect(() => validateChartDataPayload({})).toThrow('Chart data payload must contain a data object');
  });

  it('throws when a required stack is missing', () => {
    const payload = validPayload();
    delete (payload.data as Record<string, unknown>)['40BB'];
    expect(() => validateChartDataPayload(payload)).toThrow('Chart data missing stack: 40BB');
  });

  it('throws when an action value is not a string array', () => {
    const payload = validPayload();
    (payload.data['15BB']['UTG RFI'] as Record<string, unknown>).raise = ['AA', 123];
    expect(() => validateChartDataPayload(payload)).toThrow('Chart data action must be a string array: 15BB > UTG RFI > raise');
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/utils/chartDataValidation.test.ts
```

Expected: FAIL because `src/utils/chartDataValidation.ts` does not exist.

- [ ] **Step 3: Implement validator**

Create `src/utils/chartDataValidation.ts` with:

```ts
import type { AllData, StackSize } from '../types';

const REQUIRED_STACKS: StackSize[] = ['15BB', '25BB', '40BB', '100BB'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateChartDataPayload(value: unknown): AllData {
  if (!isPlainObject(value) || !isPlainObject(value.data)) {
    throw new Error('Chart data payload must contain a data object');
  }

  const data = value.data;
  for (const stack of REQUIRED_STACKS) {
    const stackValue = data[stack];
    if (!isPlainObject(stackValue)) {
      throw new Error(`Chart data missing stack: ${stack}`);
    }

    for (const [chartName, chartValue] of Object.entries(stackValue)) {
      if (!isPlainObject(chartValue)) {
        throw new Error(`Chart data chart must be an object: ${stack} > ${chartName}`);
      }

      for (const [action, hands] of Object.entries(chartValue)) {
        if (!Array.isArray(hands) || hands.some(hand => typeof hand !== 'string')) {
          throw new Error(`Chart data action must be a string array: ${stack} > ${chartName} > ${action}`);
        }
      }
    }
  }

  return data as unknown as AllData;
}
```

- [ ] **Step 4: Update `useChartData` to use validator**

Modify `src/hooks/useChartData.ts` to import and call the validator:

```ts
import { validateChartDataPayload } from '../utils/chartDataValidation';
```

Replace:

```ts
setData(json.data as AllData);
```

with:

```ts
setData(validateChartDataPayload(json));
```

Remove the now-unused `AllData` import only if TypeScript reports it unused. The hook still uses `AllData` for state, so it should remain.

- [ ] **Step 5: Run validator tests**

Run:

```bash
npm test -- src/utils/chartDataValidation.test.ts
```

Expected: PASS with 4 tests.

- [ ] **Step 6: Run full tests**

Run:

```bash
npm test
```

Expected: all existing tests plus validator tests pass.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add src/hooks/useChartData.ts src/utils/chartDataValidation.ts src/utils/chartDataValidation.test.ts
git commit -m "feat: validate chart data payload"
```

Expected: commit succeeds.

---

### Task 3: Fix Existing Lint Failures

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/QuizCompareSection.tsx`
- Modify: `src/pages/FacingPage.tsx`
- Modify: `src/pages/QuizPage.tsx`

**Interfaces:**
- Consumes: existing page/component props and state names.
- Produces: lint-clean components with the same UI behavior.

- [ ] **Step 1: Confirm current lint failures**

Run:

```bash
npm run lint
```

Expected before fixes: errors for `react-hooks/set-state-in-effect` and `react-hooks/purity`.

- [ ] **Step 2: Remove unnecessary stack-correction effect in `src/App.tsx`**

Delete this effect from `src/App.tsx`:

```ts
useEffect(() => {
  if (view === 'sb-open' && SB_OPEN_DISABLED_STACKS.includes(stack)) {
    setStack('100BB');
  }
}, [view, stack]);
```

Then update the React import from:

```ts
import { useState, useEffect } from 'react';
```

to:

```ts
import { useState, useEffect } from 'react';
```

Keep `useEffect` because the quiz sync effect still uses it.

- [ ] **Step 3: Refactor `FacingPage` invalid selections to effective values**

Open `src/pages/FacingPage.tsx`. Replace the state-correction effects with derived constants. Use this pattern after the arrays are computed:

```ts
const effectiveCategory = scenarioMap.categories.includes(category)
  ? category
  : scenarioMap.categories[0];

const heroPositions = effectiveCategory
  ? getHeroPositions(scenarioMap, effectiveCategory)
  : [];
const effectiveHero = heroPositions.includes(hero) ? hero : (heroPositions[0] ?? '');

const villainOptions = effectiveHero
  ? getVillainOptions(scenarioMap, effectiveHero, effectiveCategory)
  : [];
const effectiveVillain = villainOptions.includes(villain) ? villain : (villainOptions[0] ?? '');

const scenarios = effectiveHero && effectiveVillain
  ? getScenarios(scenarioMap, effectiveHero, effectiveVillain, effectiveCategory)
  : [];
const effectiveSelectedChart = scenarios.some(s => s.chartName === selectedChart)
  ? selectedChart
  : (scenarios[0]?.chartName ?? '');
```

Then update rendering and selected chart lookup to use effective values:

```ts
const selectedScenario = scenarios.find(s => s.chartName === effectiveSelectedChart);
```

For `<select>` controls, keep `value={effectiveCategory}`, `value={effectiveHero}`, `value={effectiveVillain}`, and `value={effectiveSelectedChart}`. Keep `onChange={e => setCategory(e.target.value)}` and equivalent setters so user selections still update state.

- [ ] **Step 4: Refactor `QuizCompareSection` invalid selections to effective values**

Open `src/components/QuizCompareSection.tsx`. Apply the same derived-value pattern:

```ts
const effectiveHero = heroPositions.includes(hero) ? hero : (heroPositions[0] ?? '');
const villainOptions = effectiveHero ? getVillainOptions(data, stack, effectiveHero) : [];
const effectiveVillain = villainOptions.includes(villain) ? villain : (villainOptions[0] ?? '');
const scenarios = effectiveHero && effectiveVillain
  ? getScenarios(data, stack, effectiveHero, effectiveVillain)
  : [];
const effectiveSelectedChart = scenarios.some(s => s.chartName === selectedChart)
  ? selectedChart
  : (scenarios[0]?.chartName ?? '');
```

Update selects and selected chart lookup to use the effective values. Remove the three effects that synchronously call `setHero`, `setVillain`, and `setSelectedChart`.

- [ ] **Step 5: Fix `Date.now()` lint in `QuizPage`**

Open `src/pages/QuizPage.tsx`. Ensure the timestamp is created inside the answer click handler, not in a nested render-time expression. The record creation should look like:

```ts
const now = Date.now();
const record: QuizRecord = {
  stackSize: current.question.stackSize,
  chartName: current.question.chartName,
  hand: current.question.hand,
  correctAction: current.question.correctAction,
  userAnswer: action,
  correct: isCorrect,
  timestamp: now,
};
```

If lint still reports purity because the handler is not memoized, wrap the answer handler in `useCallback` and keep `Date.now()` inside that callback body.

- [ ] **Step 6: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git add src/App.tsx src/components/QuizCompareSection.tsx src/pages/FacingPage.tsx src/pages/QuizPage.tsx
git commit -m "fix: resolve react lint violations"
```

Expected: commit succeeds.

---

### Task 4: Document Vercel Blob Privacy Review

**Files:**
- Create: `docs/security/blob-privacy-review.md`

**Interfaces:**
- Consumes: current API storage implementation in `api/records.ts`, `api/bankroll.ts`, `api/coinpoker.ts`.
- Produces: security review document only; no storage code changes.

- [ ] **Step 1: Create security docs directory**

Run:

```bash
mkdir -p docs/security
```

Expected: directory exists.

- [ ] **Step 2: Write privacy review document**

Create `docs/security/blob-privacy-review.md` with:

```markdown
# Vercel Blob Privacy Review

## Scope

This review documents the current privacy posture of user-derived data stored through Vercel Blob. It does not change the storage implementation.

## Current Storage

The app writes authenticated user data in these API routes:

| API route | File | Stored data | Blob path pattern |
|---|---|---|---|
| `/api/records` | `api/records.ts` | Quiz records including stack, chart, hand, answer, correctness, timestamp | `users/<safe-sub>/records.json` |
| `/api/bankroll` | `api/bankroll.ts` | Bankroll cash and tournament sessions | `users/<safe-sub>/bankroll-cash.json`, `users/<safe-sub>/bankroll-tournament.json` |
| `/api/coinpoker` | `api/coinpoker.ts` | Parsed CoinPoker hand-history records | `users/<safe-sub>/coinpoker-<type>/chunk*.json` |

All three routes require an authenticated session before reading or writing data.

## Public Blob Access

The current implementation writes Blob objects with `access: 'public'`. This means the app controls access to the API routes, but the Blob object URL itself can be read without the app session if the URL is exposed.

This is a privacy risk because quiz history, bankroll sessions, and parsed hand histories are user-derived data. CoinPoker hand-history data can be especially sensitive because it may contain detailed gameplay history.

## Existing Mitigations

- API routes call `getSessionUser(req)` and return `401` for unauthenticated requests.
- Blob paths are derived from the authenticated Google subject, not from raw client input.
- User subject values are sanitized before becoming path segments.
- The app does not intentionally display Blob URLs in the client UI.

## Remaining Risks

- A leaked Blob URL can be read directly while the object remains public.
- Browser extensions, logs, debugging output, or accidental sharing could expose URLs.
- Public object access does not enforce per-user authorization at read time.
- Raw or detailed parsed hand-history fields may reveal more data than the app needs long term.
- Fixed-path overwrite stores quiz and bankroll histories as complete JSON documents, so a leaked URL can expose the full stored set for that category.

## Future Options

1. Store sensitive data in a private database such as Vercel Postgres, Supabase, or another managed database with row-level authorization.
2. Use encrypted payloads before writing to Blob, with keys unavailable to public readers.
3. Proxy all reads through authenticated API routes and use a storage backend that supports private objects.
4. Minimize stored fields, especially for CoinPoker hand histories, so only analysis-required fields are persisted.
5. Add retention or export/delete controls for user-owned data.

## Current Decision

For the current cleanup, storage behavior remains unchanged. The risk is documented so a future storage migration can be prioritized separately from lint and refactoring work.
```

- [ ] **Step 3: Verify no code changed for storage behavior**

Run:

```bash
git diff -- api/records.ts api/bankroll.ts api/coinpoker.ts
```

Expected: no output.

- [ ] **Step 4: Commit Task 4**

Run:

```bash
git add docs/security/blob-privacy-review.md
git commit -m "docs: document blob privacy posture"
```

Expected: commit succeeds.

---

### Task 5: Split App View Metadata and Shell Layout

**Files:**
- Create: `src/app/viewRegistry.tsx`
- Create: `src/components/AppShell.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `type View`, `VIEWS`, `SB_OPEN_DISABLED_STACKS`, `getViewMeta(view: View)`, `renderView(args)`.
- Produces: `AppShell` component that renders layout around children.
- Consumes: existing page components and `StackSize`, `AllData`, `QuizQuestion` types.

- [ ] **Step 1: Create `src/app` directory**

Run:

```bash
mkdir -p src/app
```

Expected: directory exists.

- [ ] **Step 2: Create view registry**

Create `src/app/viewRegistry.tsx` with:

```tsx
import { OpenRangePage } from '../pages/OpenRangePage';
import { SbOpenPage } from '../pages/SbOpenPage';
import { FacingPage } from '../pages/FacingPage';
import { QuizPage } from '../pages/QuizPage';
import { QuizStatsPage } from '../pages/QuizStatsPage';
import { CoinPokerAnalysisPage } from '../pages/CoinPokerAnalysisPage';
import { BankrollPage } from '../pages/BankrollPage';
import { EquityCalculatorPage } from '../pages/EquityCalculatorPage';
import type { AllData, QuizQuestion, StackSize } from '../types';

export type View = 'open-range' | 'sb-open' | 'facing' | 'quiz' | 'quiz-stats' | 'coinpoker' | 'bankroll' | 'equity';

export type NavigateIntent =
  | { kind: 'chart'; stack: StackSize; chartName: string; viewType: 'open-range' | 'sb-open' | 'facing' }
  | { kind: 'review'; question: QuizQuestion }
  | { kind: 'quiz' };

export interface ViewMeta {
  value: View;
  label: string;
  maxWidth: 'normal' | 'wide';
  showStackTabs: boolean;
}

export const SB_OPEN_DISABLED_STACKS: StackSize[] = [];

export const VIEWS: ViewMeta[] = [
  { value: 'open-range', label: 'Open Range', maxWidth: 'normal', showStackTabs: true },
  { value: 'sb-open', label: 'SB Open', maxWidth: 'normal', showStackTabs: true },
  { value: 'facing', label: 'Facing Charts', maxWidth: 'normal', showStackTabs: true },
  { value: 'quiz', label: '퀴즈', maxWidth: 'normal', showStackTabs: false },
  { value: 'quiz-stats', label: '통계', maxWidth: 'normal', showStackTabs: false },
  { value: 'coinpoker', label: 'CoinPoker 분석', maxWidth: 'wide', showStackTabs: false },
  { value: 'bankroll', label: '뱅크롤', maxWidth: 'wide', showStackTabs: false },
  { value: 'equity', label: '에쿼티 계산기', maxWidth: 'normal', showStackTabs: false },
];

export function getViewMeta(view: View): ViewMeta {
  return VIEWS.find(v => v.value === view) ?? VIEWS[0];
}

export function renderView(args: {
  view: View;
  stack: StackSize;
  data: AllData;
  onNavigate: (intent: NavigateIntent) => void;
}) {
  const stackData = args.data[args.stack];

  switch (args.view) {
    case 'open-range':
      return <OpenRangePage stackData={stackData} />;
    case 'sb-open':
      return <SbOpenPage stackData={stackData} />;
    case 'facing':
      return <FacingPage stackData={stackData} />;
    case 'quiz':
      return <QuizPage data={args.data} />;
    case 'quiz-stats':
      return <QuizStatsPage data={args.data} onNavigate={args.onNavigate} />;
    case 'coinpoker':
      return <CoinPokerAnalysisPage fallbackStack={args.stack} data={args.data} />;
    case 'bankroll':
      return <BankrollPage />;
    case 'equity':
      return <EquityCalculatorPage />;
  }
}
```

- [ ] **Step 3: Create `AppShell` component**

Create `src/components/AppShell.tsx` with:

```tsx
import { useState, type ReactNode } from 'react';
import { StackTabs } from './StackTabs';
import type { SessionUser } from '../hooks/useAuth';
import type { StackSize } from '../types';
import { SB_OPEN_DISABLED_STACKS, VIEWS, type View, type ViewMeta } from '../app/viewRegistry';

interface AppShellProps {
  user: SessionUser | null;
  view: View;
  viewMeta: ViewMeta;
  stack: StackSize;
  onStackChange: (stack: StackSize) => void;
  onViewChange: (view: View) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({
  user,
  view,
  viewMeta,
  stack,
  onStackChange,
  onViewChange,
  onLogout,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const maxWidthClass = viewMeta.maxWidth === 'wide' ? 'max-w-7xl' : 'max-w-4xl';

  return (
    <div className={`min-h-screen ${maxWidthClass} mx-auto`}>
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 z-50 flex flex-col shadow-2xl transform transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <span className="text-white font-bold text-base">GTO Preflop</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {VIEWS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { onViewChange(value); setDrawerOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm mb-1 transition-colors ${
                view === value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-gray-700">
          {user?.name && (
            <p className="text-xs text-gray-400 mb-2 truncate">{user.name}</p>
          )}
          <button
            onClick={onLogout}
            className="w-full px-3 py-2 text-xs bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-gray-800">
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-gray-400 hover:text-white transition-colors p-1 shrink-0"
          aria-label="메뉴 열기"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-sm font-bold text-white truncate">
          GTO Preflop Charts
        </h1>
        <span className="text-xs text-indigo-400 font-medium truncate">
          {viewMeta.label}
        </span>
      </div>

      <div className="p-4">
        {viewMeta.showStackTabs && (
          <div className="flex justify-center mb-4">
            <StackTabs
              selected={stack}
              onChange={onStackChange}
              disabledStacks={view === 'sb-open' ? SB_OPEN_DISABLED_STACKS : undefined}
            />
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Simplify `src/App.tsx`**

Replace page/layout imports and inline layout rendering. The final `App.tsx` should have this shape:

```tsx
import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useChartData } from './hooks/useChartData';
import { syncQuizRecords } from './utils/recordsSync';
import { LoginGate } from './components/LoginGate';
import { AppShell } from './components/AppShell';
import {
  SB_OPEN_DISABLED_STACKS,
  getViewMeta,
  renderView,
  type NavigateIntent,
  type View,
} from './app/viewRegistry';
import type { StackSize } from './types';

function App() {
  const { user, isAuthenticated, checking, logout } = useAuth();
  const { data, loading, error } = useChartData(isAuthenticated);
  const [stack, setStack] = useState<StackSize>('100BB');
  const [view, setView] = useState<View>('open-range');

  useEffect(() => {
    if (!isAuthenticated) return;
    syncQuizRecords().catch(() => {
      /* offline or /api unavailable (e.g. plain vite dev) — keep working locally */
    });
  }, [isAuthenticated]);

  const navigate = (intent: NavigateIntent) => {
    if (intent.kind === 'chart') {
      sessionStorage.setItem('pendingChart', JSON.stringify({
        stack: intent.stack,
        chartName: intent.chartName,
        viewType: intent.viewType,
      }));
      const targetView: View =
        intent.viewType === 'sb-open' && SB_OPEN_DISABLED_STACKS.includes(intent.stack)
          ? 'open-range'
          : intent.viewType;
      setStack(intent.stack);
      setView(targetView);
    } else if (intent.kind === 'review') {
      sessionStorage.setItem('pendingReview', JSON.stringify(intent.question));
      setView('quiz');
    } else if (intent.kind === 'quiz') {
      setView('quiz');
    }
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">로그인 확인 중...</div>;
  }

  if (!isAuthenticated) return <LoginGate />;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">데이터 로딩 중...</div>;
  }

  if (error || !data) {
    return <div className="min-h-screen flex items-center justify-center text-red-400">데이터 로드 실패: {error}</div>;
  }

  const viewMeta = getViewMeta(view);

  return (
    <AppShell
      user={user}
      view={view}
      viewMeta={viewMeta}
      stack={stack}
      onStackChange={setStack}
      onViewChange={setView}
      onLogout={logout}
    >
      {renderView({ view, stack, data, onNavigate: navigate })}
    </AppShell>
  );
}

export default App;
```

- [ ] **Step 5: Run lint/build smoke check**

Run:

```bash
npm run lint
npm run build
```

Expected: both PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add src/App.tsx src/app/viewRegistry.tsx src/components/AppShell.tsx
git commit -m "refactor: split app shell and view registry"
```

Expected: commit succeeds.

---

### Task 6: Extract Bankroll Store Orchestration Hook

**Files:**
- Create: `src/pages/bankroll/useBankrollStore.ts`
- Modify: `src/pages/BankrollPage.tsx`

**Interfaces:**
- Produces: `useBankrollStore()` hook returning the state and handlers formerly declared near the top of `BankrollPage`.
- Consumes: existing functions from `src/utils/bankroll.ts`, `src/utils/bankrollSync.ts`, and `src/utils/fxRate.ts`.

- [ ] **Step 1: Identify page-level orchestration state**

Open `src/pages/BankrollPage.tsx`. Locate state and handlers for:

```ts
sessions
loading
syncError
importMessage
editing
onFiles
onClearAll
startEdit
cancelEdit
saveEdit
deleteSession
```

Expected: these are declared in the component before rendering.

- [ ] **Step 2: Create hook file by moving orchestration code**

Create `src/pages/bankroll/useBankrollStore.ts` and move the imports/state/handlers needed for bankroll storage into it. The hook interface should be:

```ts
import { useEffect, useMemo, useState } from 'react';
import {
  parseBankrollFile,
  summarizeBankroll,
  type BankrollSession,
} from '../../utils/bankroll';
import {
  clearBankroll,
  fetchBankrollSessions,
  pushBankrollSessions,
  replaceBankrollSessions,
} from '../../utils/bankrollSync';

export interface BankrollEditState {
  id: string;
  values: Record<string, string>;
}

export function useBankrollStore() {
  const [sessions, setSessions] = useState<BankrollSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<BankrollEditState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBankrollSessions()
      .then(remote => {
        if (!cancelled) setSessions(remote);
      })
      .catch(() => {
        if (!cancelled) setSyncError('서버 동기화에 실패했습니다. 로컬 작업은 계속할 수 있습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => summarizeBankroll(sessions), [sessions]);

  return {
    sessions,
    setSessions,
    loading,
    syncError,
    setSyncError,
    importMessage,
    setImportMessage,
    editing,
    setEditing,
    summary,
    parseBankrollFile,
    clearBankroll,
    pushBankrollSessions,
    replaceBankrollSessions,
  };
}
```

Then move the existing page-specific handler bodies into the hook if they do not depend on JSX-only local variables. If a handler uses only hook state and utility functions, expose it directly from the hook. If it depends on page-only formatting helpers, keep it in the page and use the hook state setters.

- [ ] **Step 3: Update page imports and state usage**

In `src/pages/BankrollPage.tsx`, replace the moved `useState`, `useEffect`, and utility imports with:

```ts
import { useBankrollStore } from './bankroll/useBankrollStore';
```

Inside the component, destructure the hook:

```ts
const {
  sessions,
  setSessions,
  loading,
  syncError,
  setSyncError,
  importMessage,
  setImportMessage,
  editing,
  setEditing,
  summary,
  parseBankrollFile,
  clearBankroll,
  pushBankrollSessions,
  replaceBankrollSessions,
} = useBankrollStore();
```

Remove duplicated state declarations from the page. Keep rendering markup unchanged.

- [ ] **Step 4: Run bankroll tests**

Run:

```bash
npm test -- src/utils/bankroll.test.ts src/utils/fxRate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run lint/build**

Run:

```bash
npm run lint
npm run build
```

Expected: both PASS. If TypeScript reports unused imports in `BankrollPage.tsx`, remove only those imports.

- [ ] **Step 6: Commit Task 6**

Run:

```bash
git add src/pages/BankrollPage.tsx src/pages/bankroll/useBankrollStore.ts
git commit -m "refactor: extract bankroll store hook"
```

Expected: commit succeeds.

---

### Task 7: Extract CoinPoker Store Orchestration Hook

**Files:**
- Create: `src/pages/coinpoker/useCoinPokerStore.ts`
- Modify: `src/pages/CoinPokerAnalysisPage.tsx`

**Interfaces:**
- Produces: `useCoinPokerStore()` hook returning store, loading/sync status, selected game type state, and ingestion/clear handlers where safe.
- Consumes: existing functions from `src/utils/coinpokerParser.ts`, `src/utils/coinpokerSync.ts`, and comparison utilities already used by the page.

- [ ] **Step 1: Identify page-level store state**

Open `src/pages/CoinPokerAnalysisPage.tsx`. Locate state and handlers for:

```ts
store
gameType
chartLimit
loading
syncError
importMessage
fetchCoinPokerHands
pushCoinPokerHands
clearCoinPokerHands
parseCoinPokerHands
mergeCoinPokerStore
ingest
clear
```

Expected: these are declared near the top of the page component.

- [ ] **Step 2: Create hook file**

Create `src/pages/coinpoker/useCoinPokerStore.ts` with this interface and move the existing store orchestration into it:

```ts
import { useEffect, useState } from 'react';
import {
  EMPTY_COINPOKER_STORE,
  mergeCoinPokerStore,
  parseCoinPokerHands,
  type CoinPokerGameType,
  type CoinPokerStore,
} from '../../utils/coinpokerParser';
import {
  clearCoinPokerHands,
  fetchCoinPokerHands,
  pushCoinPokerHands,
} from '../../utils/coinpokerSync';

export function useCoinPokerStore() {
  const [store, setStore] = useState<CoinPokerStore>(EMPTY_COINPOKER_STORE);
  const [gameType, setGameType] = useState<CoinPokerGameType>('cash');
  const [chartLimit, setChartLimit] = useState(Number.MAX_SAFE_INTEGER);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoinPokerHands()
      .then(remote => {
        if (!cancelled) setStore(remote);
      })
      .catch(() => {
        if (!cancelled) setSyncError('서버 동기화에 실패했습니다. 로컬 작업은 계속할 수 있습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    store,
    setStore,
    gameType,
    setGameType,
    chartLimit,
    setChartLimit,
    loading,
    syncError,
    setSyncError,
    importMessage,
    setImportMessage,
    mergeCoinPokerStore,
    parseCoinPokerHands,
    clearCoinPokerHands,
    pushCoinPokerHands,
  };
}
```

Move the `ingest` and `clear` handler bodies into the hook only if their code depends only on values listed above. If they depend on page-only derived values, keep handlers in the page and call hook setters/utilities.

- [ ] **Step 3: Update page imports and state usage**

In `src/pages/CoinPokerAnalysisPage.tsx`, replace moved imports/state with:

```ts
import { useCoinPokerStore } from './coinpoker/useCoinPokerStore';
```

Inside the component, destructure:

```ts
const {
  store,
  setStore,
  gameType,
  setGameType,
  chartLimit,
  setChartLimit,
  loading,
  syncError,
  setSyncError,
  importMessage,
  setImportMessage,
  mergeCoinPokerStore,
  parseCoinPokerHands,
  clearCoinPokerHands,
  pushCoinPokerHands,
} = useCoinPokerStore();
```

Remove duplicated state declarations and imports from the page. Keep derived analysis `useMemo` blocks and JSX in the page.

- [ ] **Step 4: Run CoinPoker tests**

Run:

```bash
npm test -- src/utils/coinpokerParser.test.ts src/utils/coinpokerCompare.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run lint/build**

Run:

```bash
npm run lint
npm run build
```

Expected: both PASS. If TypeScript reports unused imports in `CoinPokerAnalysisPage.tsx`, remove only those imports.

- [ ] **Step 6: Commit Task 7**

Run:

```bash
git add src/pages/CoinPokerAnalysisPage.tsx src/pages/coinpoker/useCoinPokerStore.ts
git commit -m "refactor: extract coinpoker store hook"
```

Expected: commit succeeds.

---

### Task 8: Final Verification and Cleanup

**Files:**
- Inspect: all changed files
- Modify: only files needed to fix verification failures

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: clean final branch with passing lint/tests/build.

- [ ] **Step 1: Check worktree status**

Run:

```bash
git status --short
```

Expected: only intentional uncommitted changes, or clean if all task commits succeeded. The pre-existing untracked `context.md` may remain untracked; do not add it unless the user explicitly requests it.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with zero errors.

- [ ] **Step 3: Run tests**

Run:

```bash
npm test
```

Expected: all test files pass, including `src/utils/chartDataValidation.test.ts`.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript build and Vite build both succeed.

- [ ] **Step 5: Review final diff summary**

Run:

```bash
git log --oneline -8
git diff --stat HEAD~7..HEAD || true
```

Expected: recent commits correspond to the spec and tasks. If fewer than seven task commits exist because tasks were combined during execution, use `git diff --stat origin/main..HEAD`.

- [ ] **Step 6: Commit any final verification fixes**

If Step 2, 3, or 4 required fixes, commit them:

```bash
git add -A
git commit -m "fix: complete cleanup verification"
```

If no fixes were needed, do not create an empty commit.

- [ ] **Step 7: Report completion evidence**

Final response must include:

```text
Changed areas:
- GitHub Pages deployment removed
- Lint violations fixed
- Blob privacy review documented
- App shell/view registry split
- Bankroll store hook extracted
- CoinPoker store hook extracted
- Chart data runtime validation added

Verification:
- npm run lint: PASS
- npm test: PASS
- npm run build: PASS

Notes:
- Blob storage remains public by design for this task; risk is documented in docs/security/blob-privacy-review.md
- context.md was left untracked if still present
```
