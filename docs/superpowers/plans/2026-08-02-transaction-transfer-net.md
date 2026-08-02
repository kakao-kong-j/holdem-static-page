# Transaction Transfer Net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include transfers in Net and omit non-numeric transaction balances from the table and balance graph.

**Architecture:** Keep both changes in the transaction utility. `summarizeTransactions` already accumulates transfer totals, so Net adds that total. The optional-balance parser returns `undefined` unless its input parses to a finite number, which the existing table and trend builder already treat as absent.

**Tech Stack:** TypeScript, Vitest, React, Vite.

## Global Constraints

- Add no dependencies.
- Every transfer contributes its raw `amount` as a positive value to Net.
- Income, Expense, Transfer, `입금 포함`, and graph filtering behavior remain unchanged.
- Non-numeric balances, including `_`, are omitted from the graph and render as `-` in the existing table.
- Verify with focused Vitest, the full suite, and `npm run build`.

---

## File Structure

- Modify `src/utils/transactions.ts`: update Net arithmetic and reject non-finite optional balances.
- Modify `src/utils/transactions.test.ts`: add focused behavior coverage.

### Task 1: Transfer Net and Invalid Balance Handling

**Files:**

- Modify: `src/utils/transactions.ts`
- Test: `src/utils/transactions.test.ts`

**Interfaces:**

- Preserves: `summarizeTransactions(entries, includeDeposits?): TransactionSummary`
- Preserves: `buildTransactionBalanceTrend(entries): TransactionBalancePoint[]`

- [ ] **Step 1: Write failing tests**

Add these assertions to the existing summary and balance-trend tests:

```ts
expect(summarizeTransactions(entries)).toEqual({
  count: 3,
  income: 0,
  expense: 2,
  transfer: 3,
  unknown: 0,
  net: 1,
});
```

```ts
row({ txn_id: 'invalid', date: '2026-07-05 11:00:00', balance: '_' }),
```

Keep the expected trend points unchanged so the `_` row must be omitted.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/utils/transactions.test.ts`

Expected: FAIL because Net is currently `income - expense`, and `_` is normalized to zero and appears as a trend point.

- [ ] **Step 3: Implement the smallest utility change**

Replace `optionalNum` with:

```ts
function optionalNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number.parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}
```

Change the Net calculation to:

```ts
summary.net = summary.income - summary.expense + summary.transfer;
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/utils/transactions.test.ts`

Expected: PASS.

- [ ] **Step 5: Run full verification and commit**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests and the production build pass with no whitespace errors.

Commit:

```bash
git add src/utils/transactions.ts src/utils/transactions.test.ts
git commit -m "fix: include transfers in transaction net"
```
