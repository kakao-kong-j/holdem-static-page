# CoinPoker Cash-Range Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the Cash Hand Range source for CoinPoker cash analysis while preserving the existing tournament GTO comparison.

**Architecture:** Add a cash-range comparison function that maps parsed cash-hand action histories to validated `CashScenario` entries. The CoinPoker page loads the same cache JSON used by the Cash Hand Range tab and selects the cash comparator only for `gameType: 'cash'`; tournament hands retain automatic stack-based comparison.

**Tech Stack:** React 19, TypeScript, Vitest, Vite.

## Global Constraints

- Cash hands must never fall back to tournament GTO charts.
- Tournament stack selection and comparison results must remain unchanged.
- Cash range data comes from `gto-cache-preflop-chart.json` and uses `parseCashRangeData` validation.

---

### Task 1: Cash-range comparator

**Files:**
- Modify: `src/utils/coinpokerCompare.ts`
- Modify: `src/utils/coinpokerCompare.test.ts`

**Interfaces:**
- Produces `compareCoinPokerCashHands(hands: CoinPokerHand[], data: CashRangeData): CoinPokerComparisonItem[]`.
- Uses `findCashScenario(data, hero, situation, opener?)` and positive non-fold frequencies to determine the expected action.

- [ ] **Step 1: Write failing cash-source tests**

```ts
expect(compareCoinPokerCashHands([cashHand({ heroHand: 'AA' })], cashData)[0]).toMatchObject({
  chartName: 'utg_rfi', gtoAction: 'open', status: 'match-open',
});
expect(compareCoinPokerCashHands([cashHand({ heroHand: '72o' })], cashData)[0]).toMatchObject({
  status: 'extra-open', gtoAction: 'fold',
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run: `npm test -- src/utils/coinpokerCompare.test.ts`

- [ ] **Step 3: Implement scenario mapping and cash classification**

```ts
const scenario = findCashScenario(data, hand.heroPosition as CashPosition, 'unopened');
const gtoAction = hasPositiveAggressiveAction(scenario?.hands[hand.heroHand ?? '']) ? 'open' : 'fold';
```

- [ ] **Step 4: Add a missing-cache-scenario regression test and implement exclusion**

```ts
expect(compareCoinPokerCashHands([cashHand({ heroPosition: 'LJ' })], cashData)[0].exclusionReason)
  .toBe('cash-chart-not-found');
```

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/utils/coinpokerCompare.test.ts`

### Task 2: Per-game-type analysis source selection

**Files:**
- Modify: `src/pages/CoinPokerAnalysisPage.tsx`
- Modify: `src/pages/CoinPokerAnalysisPage.test.tsx` or create it if absent

**Interfaces:**
- Cash hands use `compareCoinPokerCashHands` only after cache data validates.
- Tournament hands keep `compareCoinPokerAutoStack(chartedHands, data, fallbackStack)`.

- [ ] **Step 1: Write failing page/source-selection test**

```ts
expect(view.container.textContent).toContain('캐시 핸드레인지 기준');
expect(view.container.textContent).toContain('토너먼트 GTO 기준');
```

- [ ] **Step 2: Run it and confirm the current page lacks the source labels**

Run: `npm test -- src/pages/CoinPokerAnalysisPage.test.tsx`

- [ ] **Step 3: Load and validate cache JSON, then select the matching comparator**

```ts
fetch(`${import.meta.env.BASE_URL}gto-cache-preflop-chart.json`)
  .then(response => response.json()).then(parseCashRangeData);
const comparison = gameType === 'cash' && cashData
  ? compareCoinPokerCashHands(chartedHands, cashData)
  : compareCoinPokerAutoStack(chartedHands, data, fallbackStack);
```

- [ ] **Step 4: Display source/loading/error state and run focused tests**

Run: `npm test -- src/pages/CoinPokerAnalysisPage.test.tsx`

### Task 3: Verification and publish

**Files:**
- Modify: implementation, tests, plan

- [ ] **Step 1: Run all checks**

Run: `npm test && npm run lint && npm run build && git diff --check`

- [ ] **Step 2: Commit reviewed changes and push the existing feature branch**

```bash
git add src/utils/coinpokerCompare.ts src/utils/coinpokerCompare.test.ts src/pages/CoinPokerAnalysisPage.tsx src/pages/CoinPokerAnalysisPage.test.tsx docs/superpowers/plans/2026-08-14-coinpoker-cash-range-analysis.md
git commit -m "feat: use cash ranges for CoinPoker cash analysis"
git push
```
