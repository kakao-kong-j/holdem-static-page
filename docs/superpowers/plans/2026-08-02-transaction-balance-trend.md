# Transaction Balance Trend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the filtered transaction balance trend and let users include or exclude deposits from Income and Net.

**Architecture:** Extend the transaction utility with a small balance-point builder and an optional deposit flag for summaries. Reuse the existing dependency-free SVG trend chart because its `datetime`/`value` point shape already matches transaction balance data. Keep the checkbox state and page composition in `TransactionsPage`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Vite.

## Global Constraints

- Add no dependencies.
- The `입금 포함` checkbox defaults to off.
- A deposit excluded from Income must also be excluded from Net.
- The balance graph always displays the original transaction `balance`, including deposits.
- Apply the existing From/To filter to chart points; Direction and Type filters do not affect it.
- Preserve transaction parsing, classification, persistence, and table behavior.
- Verify with `npm test -- src/utils/transactions.test.ts`, `npm run build`, and `git diff --check`.

---

## File Structure

- Modify `src/utils/transactions.ts`: export balance-chart points and add an optional deposit inclusion parameter to transaction summaries.
- Modify `src/utils/transactions.test.ts`: lock down deposit summary modes and sorted balance points.
- Modify `src/pages/TransactionsPage.tsx`: hold the checkbox state and render the existing trend chart for date-filtered entries.

### Task 1: Transaction Summary and Balance Points

**Files:**

- Modify: `src/utils/transactions.ts`
- Test: `src/utils/transactions.test.ts`

**Interfaces:**

- Produces: `TransactionBalancePoint { datetime: string; value: number }`
- Produces: `buildTransactionBalanceTrend(entries: TransactionEntry[]): TransactionBalancePoint[]`
- Changes: `summarizeTransactions(entries: TransactionEntry[], includeDeposits?: boolean): TransactionSummary`

- [ ] **Step 1: Write the failing tests**

Add imports and these tests to `src/utils/transactions.test.ts`:

```ts
import { buildTransactionBalanceTrend } from './transactions';

it('excludes deposits from income and net by default', () => {
  const entries = parseTransactionsFile([
    row({ txn_type: 'deposit', sub_type: 'Deposit Successful', amount: 10 }),
    row({ txn_id: 'id-2', txn_type: 'reward', sub_type: 'Daily Rakeback', amount: 2 }),
    row({ txn_id: 'id-3', txn_type: 'tournament', sub_type: 'Tournament Buy In', amount: 3 }),
  ]);

  expect(summarizeTransactions(entries)).toMatchObject({ income: 2, net: -1 });
  expect(summarizeTransactions(entries, true)).toMatchObject({ income: 12, net: 9 });
});

it('builds date-sorted balance points and skips missing balances', () => {
  const entries = parseTransactionsFile([
    row({ txn_id: 'later', date: '2026-07-06 10:00:00', balance: 25 }),
    row({ txn_id: 'none', date: '2026-07-05 09:00:00', balance: undefined }),
    row({ txn_id: 'first', date: '2026-07-05 10:00:00', balance: 20 }),
  ]);

  expect(buildTransactionBalanceTrend(entries)).toEqual([
    { datetime: '2026-07-05 10:00:00', value: 20 },
    { datetime: '2026-07-06 10:00:00', value: 25 },
  ]);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/utils/transactions.test.ts`

Expected: FAIL because `buildTransactionBalanceTrend` is not exported and default summary still includes the $10 deposit.

- [ ] **Step 3: Implement the minimum utility changes**

In `src/utils/transactions.ts`, add the point type and pure builder:

```ts
export interface TransactionBalancePoint {
  datetime: string;
  value: number;
}

export function buildTransactionBalanceTrend(entries: TransactionEntry[]): TransactionBalancePoint[] {
  return entries
    .filter((entry): entry is TransactionEntry & { balance: number } => entry.balance !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({ datetime: entry.date, value: entry.balance }));
}
```

Replace the complete summary function with:

```ts
export function summarizeTransactions(
  entries: TransactionEntry[],
  includeDeposits = false,
): TransactionSummary {
  const summary: TransactionSummary = { count: entries.length, income: 0, expense: 0, transfer: 0, unknown: 0, net: 0 };
  for (const entry of entries) {
    if (entry.direction === 'income') {
      if (includeDeposits || entry.txnType !== 'deposit') summary.income += entry.signedAmount;
    } else if (entry.direction === 'expense') summary.expense += Math.abs(entry.signedAmount);
    else if (entry.direction === 'transfer') summary.transfer += entry.amount;
    else summary.unknown += entry.amount;
  }
  summary.net = summary.income - summary.expense;
  return {
    count: summary.count,
    income: roundCents(summary.income),
    expense: roundCents(summary.expense),
    transfer: roundCents(summary.transfer),
    unknown: roundCents(summary.unknown),
    net: roundCents(summary.net),
  };
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/utils/transactions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the tested utility change**

```bash
git add src/utils/transactions.ts src/utils/transactions.test.ts
git commit -m "feat: add transaction balance trend data"
```

### Task 2: Transactions Page Controls and Chart

**Files:**

- Modify: `src/pages/TransactionsPage.tsx`

**Interfaces:**

- Consumes: `buildTransactionBalanceTrend(filtered)`
- Consumes: `summarizeTransactions(filtered, includeDeposits)`
- Consumes: `BankrollTrendChart` with structural point compatibility (`datetime`, `value`)

- [ ] **Step 1: Add the imports and local state**

Extend the transaction utility import, add the existing chart import, then add the checkbox state next to the other filters:

```ts
import { BankrollTrendChart } from '../components/BankrollTrendChart';
import {
  buildTransactionBalanceTrend,
  dedupeTransactions,
  filterTransactions,
  formatUsd,
  parseTransactionsFile,
  summarizeTransactions,
  type TransactionDirection,
  type TransactionEntry,
} from '../utils/transactions';

const [includeDeposits, setIncludeDeposits] = useState(false);
```

- [ ] **Step 2: Derive summary and graph data from the filtered transactions**

Replace the existing summary memo and add the trend memo immediately after it:

```ts
const summary = useMemo(
  () => summarizeTransactions(filtered, includeDeposits),
  [filtered, includeDeposits],
);
const balanceTrend = useMemo(() => buildTransactionBalanceTrend(filtered), [filtered]);
```

- [ ] **Step 3: Add the checkbox and chart section**

Place this label before the summary card grid, then place the chart section after the cards:

```tsx
<label className="flex items-center gap-2 text-sm text-gray-300">
  <input
    type="checkbox"
    checked={includeDeposits}
    onChange={(event) => setIncludeDeposits(event.target.checked)}
    className="h-4 w-4 rounded border-gray-700 bg-gray-950 text-indigo-600"
  />
  입금 포함
</label>
```

```tsx
<div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
  <div className="mb-2 flex items-center justify-between">
    <h2 className="font-semibold text-white">Balance trend</h2>
    <span className="text-xs text-gray-500">{balanceTrend.length} points</span>
  </div>
  <BankrollTrendChart points={balanceTrend} />
</div>
```

Do not reset `includeDeposits` in the filter reset or clear-all handlers: it is a display preference, not a filter.

- [ ] **Step 4: Run static diagnostics and build**

Run: `npm run build`

Expected: TypeScript build and Vite production build succeed.

- [ ] **Step 5: Commit the page change**

```bash
git add src/pages/TransactionsPage.tsx
git commit -m "feat: show transaction balance trend"
```

### Task 3: Final Verification

**Files:**

- Verify: `src/utils/transactions.ts`
- Verify: `src/utils/transactions.test.ts`
- Verify: `src/pages/TransactionsPage.tsx`

- [ ] **Step 1: Run the focused behavior tests**

Run: `npm test -- src/utils/transactions.test.ts`

Expected: PASS with deposit-toggle and balance-point coverage.

- [ ] **Step 2: Run all tests and production build**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all Vitest suites pass, the build succeeds, and `git diff --check` has no output.
