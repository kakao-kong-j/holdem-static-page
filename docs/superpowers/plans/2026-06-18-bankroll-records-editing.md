# Bankroll Records Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show uploaded bankroll sessions in a records table and allow editing or deleting saved records.

**Architecture:** Add pure session recalculation helpers in `src/utils/bankroll.ts`, use the existing merge API for edits, and add a small replace API path for deletion. `BankrollPage` owns the editing draft state and persists changes through `bankrollSync`.

**Tech Stack:** React, TypeScript, Vite, Vitest, Vercel API route.

---

### Task 1: Session Recalculation Helper

**Files:**
- Modify: `src/utils/bankroll.ts`
- Test: `src/utils/bankroll.test.ts`

- [ ] Add failing tests for cash edit recalculation and tournament ticket edit recalculation.
- [ ] Run `npm test -- src/utils/bankroll.test.ts` and verify the helper is missing.
- [ ] Implement `recalculateSessionProfit(session)`.
- [ ] Re-run `npm test -- src/utils/bankroll.test.ts`.

### Task 2: Replace Sync API

**Files:**
- Modify: `src/utils/bankrollSync.ts`
- Modify: `api/bankroll.ts`

- [ ] Add `replaceBankrollSessions(kind, sessions)` client helper.
- [ ] Add `replace` support to `api/bankroll.ts`, writing one kind's full session array and returning both stores.
- [ ] Verify with `npm run build`.

### Task 3: Records Table and Inline Editing

**Files:**
- Modify: `src/pages/BankrollPage.tsx`

- [ ] Add table sorted by newest datetime with visible cash/tournament/ticket fields.
- [ ] Add row edit state with inputs for date/time, name, win/loss, buy-in or ticket price, entries, and rank.
- [ ] Save edits locally, recalculate profit, and persist via `pushBankrollSessions([updated])`.
- [ ] Delete rows locally and persist the remaining sessions of that type via `replaceBankrollSessions`.
- [ ] Verify with targeted lint, tests, and build.
