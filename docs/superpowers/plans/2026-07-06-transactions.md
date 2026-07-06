# Transactions Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 거래내역 tab that imports CoinPoker transaction JSON, classifies each row as income/expense/transfer/unknown, summarizes it, and persists it per user.

**Architecture:** Keep transaction ledger code separate from bankroll session code. Use `src/utils/transactions.ts` for parsing/classification, `src/utils/transactionsSync.ts` plus `api/transactions.ts` for persistence, and `src/pages/TransactionsPage.tsx` for the page UI. Wire the page into the existing manual tab registry in `src/App.tsx`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Vercel Functions, Vercel Blob.

## Global Constraints

- No new dependencies.
- `Redeemed To Withdrawable` is a `transfer`, excluded from net profit.
- Dedupe must not use `txn_id` alone.
- Offline/plain Vite mode must keep optimistic local state and swallow sync failures like bankroll.
- Verify with `npm test` and `npm run build`.

---

## File Structure

- Create `src/utils/transactions.ts`: raw types, normalized transaction type, parser, classifier, dedupe, filter, summarize, formatting helpers.
- Create `src/utils/transactions.test.ts`: unit tests for all direction rules and dedupe behavior.
- Create `src/utils/transactionsSync.ts`: fetch/push/replace/clear helpers for `/api/transactions`.
- Create `src/utils/transactionsSync.test.ts`: normalization/unit tests with mocked `fetch`.
- Create `api/transactions.ts`: authenticated Blob persistence at `users/{sub}/transactions.json`.
- Create `src/pages/TransactionsPage.tsx`: upload, filters, summary cards, table, delete, clear.
- Modify `src/App.tsx`: add `transactions` view and menu item.

---

### Task 1: Transaction Domain Utility

**Files:**
- Create: `src/utils/transactions.ts`
- Test: `src/utils/transactions.test.ts`

**Interfaces:**
- Produces: `parseTransactionsFile(parsed: unknown): TransactionEntry[]`
- Produces: `classifyTransaction(row: RawTransaction): Pick<TransactionEntry, 'direction' | 'signedAmount' | 'category'>`
- Produces: `dedupeTransactions(entries: TransactionEntry[]): TransactionEntry[]`
- Produces: `summarizeTransactions(entries: TransactionEntry[]): TransactionSummary`

- [ ] Write tests covering deposit, reward, transfer, tournament expense/income, cash game income/expense, sportsbook expense, duplicate removal, and same `txn_id` with different rows kept.
- [ ] Run `npm test -- src/utils/transactions.test.ts` and confirm failures because the file does not exist.
- [ ] Implement `src/utils/transactions.ts` with the direction table from the design.
- [ ] Run `npm test -- src/utils/transactions.test.ts` and confirm pass.

### Task 2: Transaction Sync and API

**Files:**
- Create: `src/utils/transactionsSync.ts`
- Create: `src/utils/transactionsSync.test.ts`
- Create: `api/transactions.ts`

**Interfaces:**
- Consumes: `TransactionEntry` from `src/utils/transactions.ts`
- Produces: `fetchTransactions(): Promise<TransactionEntry[]>`
- Produces: `pushTransactions(entries: TransactionEntry[]): Promise<TransactionEntry[]>`
- Produces: `replaceTransactions(entries: TransactionEntry[]): Promise<TransactionEntry[]>`
- Produces: `clearTransactions(): Promise<TransactionEntry[]>`

- [ ] Write sync tests with mocked `fetch` for normal array response, malformed response normalization to `[]`, POST body for push, replace, and clear.
- [ ] Run `npm test -- src/utils/transactionsSync.test.ts` and confirm failures.
- [ ] Implement sync helper with `/api/transactions` and credentials included.
- [ ] Add `api/transactions.ts` by copying the minimal fixed-path read/merge/overwrite shape from `api/bankroll.ts`, adapted to one file and `id` merge.
- [ ] Run `npm test -- src/utils/transactionsSync.test.ts` and confirm pass.

### Task 3: Transactions Page and App Wiring

**Files:**
- Create: `src/pages/TransactionsPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: domain helpers from `src/utils/transactions.ts`
- Consumes: sync helpers from `src/utils/transactionsSync.ts`

- [ ] Create `TransactionsPage` with file upload, clear all, date/type/direction filters, summary cards, and records table.
- [ ] Add delete action using `replaceTransactions(remaining)`.
- [ ] Add `transactions` to `View`, `VIEWS`, max-width condition, stack-tab exclusion, and render branch in `src/App.tsx`.
- [ ] Run `npm run build` and fix type errors.

### Task 4: Final Verification

**Files:**
- All files touched above.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Commit all source changes with `git commit -m "Add transaction ledger tab"`.
