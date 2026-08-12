# Bankroll Satellite Ticket Prizes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match each `is_ticket: true` CoinPoker tournament to the ticket it actually won and include that ticket value in bankroll profit.

**Architecture:** Replace the lossy name-to-number ticket-price map with a typed candidate list that preserves `tourneyId`, `tourneyName`, and the parent export's `ticketAmount`. A pure resolver handles Seats-name prizes, exact next-step matching, closest-lower-ID selection, and the guarded adjacent-ID naming fallback; the page reuses that resolver for new imports and stored-session updates.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, happy-dom, Vite 8

## Global Constraints

- Tournament history `buy_in` is already the total cost; never multiply it by `total_no_of_entries`.
- Ticket profit is `win_loss + ticketPrize - buy_in`.
- `N Seat(s) to ₮X` uses `X` from the tournament name as the prize.
- `Step [N]` uses the next-stage ticket export's `ticketAmount`, never the same-stage entry ticket.
- Exact normalized destination matching is preferred; fallback is allowed only for an adjacent lower ID with the same `₮` destination amount and expected next-stage shape.
- An unresolved Step tournament remains missing and manually editable; do not infer the final destination value.
- Preserve import locking, edit-draft synchronization, persistence, and offline optimistic updates.
- Add no dependencies and do not refactor unrelated bankroll UI or API code.

---

## File Structure

- Modify `src/utils/bankroll.ts`: define ticket candidates, extract candidates, resolve ticket prizes, and feed the resolved prize into tournament normalization.
- Modify `src/utils/bankroll.test.ts`: cover each matching rule with reduced literals from the supplied production exports.
- Modify `src/pages/BankrollPage.tsx`: pass candidate lists through multi-file import, update stored ticket sessions, and retain manual overrides.
- Modify `src/pages/BankrollPage.test.tsx`: verify later ticket imports persist the next-stage prize and keep edit/import race protections.

### Task 1: Pure ticket-prize resolver

**Files:**
- Modify: `src/utils/bankroll.ts:26-141`
- Test: `src/utils/bankroll.test.ts:89-359`

**Interfaces:**
- Produces: `TicketCandidate { tourneyId: string; tourneyName: string; ticketAmount: number }`
- Produces: `extractTicketCandidates(parsed: unknown): TicketCandidate[]`
- Produces: `findTicketPrize(id: string, name: string, candidates?: TicketCandidate[]): number | null`
- Changes: `BankrollParseOptions` gains `ticketCandidates?: TicketCandidate[]` while keeping `ticketPrices?: Record<string, number>` for manual ID overrides.

- [ ] **Step 1: Replace old map assertions with failing candidate extraction and next-stage resolver tests**

Add literal tests equivalent to:

```ts
const coinMillionTickets = [
  {
    ticketAmount: 0.3,
    eligibleTournaments: [{
      tourneyId: 85493,
      tourneyName: 'Step [3] to ₮215 CoinMillion 2DAY',
    }],
  },
  {
    ticketAmount: 3.3,
    eligibleTournaments: [{
      tourneyId: 85492,
      tourneyName: 'Step [2] to ₮215 CoinMillion 2DAY',
    }],
  },
  {
    ticketAmount: 5.5,
    eligibleTournaments: [{
      tourneyId: 85122,
      tourneyName: '4 Seats to ₮215 CoinMillion 2DAY',
    }],
  },
];

it('uses the next stage instead of the same-stage entry ticket', () => {
  const candidates = extractTicketCandidates(coinMillionTickets);
  expect(findTicketPrize('85494', 'Step [4] to ₮215 CoinMillion 2DAY', candidates)).toBe(0.3);
  expect(findTicketPrize('85493', 'Step [3] to ₮215 CoinMillion 2DAY', candidates)).toBe(3.3);
  expect(findTicketPrize('85123', 'Step [2] to ₮215 CoinMillion 2DAY', candidates)).toBe(5.5);
});

it.each([
  ['15 Seats to ₮11 Regs Round Table', 11],
  ['20 Seat to ₮8.88 ONE TIME FREEZEOUT', 8.88],
  ['15 Seats to ₮5.50 Micro Kickoff', 5.5],
])('extracts a Seats prize from %s', (name, expected) => {
  expect(findTicketPrize('90000', name, [])).toBe(expected);
});
```

Add separate tests proving that the closest lower ID wins among repeated exact names, malformed `ticketAmount` values are discarded, candidates with IDs greater than/equal to the source are ignored, and unresolved Step names return `null`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/utils/bankroll.test.ts`

Expected: FAIL because `extractTicketCandidates` and `findTicketPrize` do not exist and current matching selects the same-stage entry ticket.

- [ ] **Step 3: Implement candidate extraction and exact next-stage resolution**

Implement the typed candidate list and these resolver branches:

```ts
export interface TicketCandidate {
  tourneyId: string;
  tourneyName: string;
  ticketAmount: number;
}

export function extractTicketCandidates(parsed: unknown): TicketCandidate[];

export function findTicketPrize(
  id: string,
  name: string,
  candidates: TicketCandidate[] = [],
): number | null;
```

`extractTicketCandidates` must only emit entries with a non-empty `tourneyId`, non-empty `tourneyName`, and a strict finite nonnegative `ticketAmount`. `findTicketPrize` first parses `Seat`/`Seats`; otherwise it parses `Step [N]`, filters to `candidate.tourneyId < id`, filters to the exact expected next-stage name/destination, sorts numeric IDs descending, and returns the first amount.

- [ ] **Step 4: Add the guarded naming-change fallback tests and verify RED**

```ts
it('accepts an adjacent same-value destination when the series suffix changed', () => {
  const candidates = extractTicketCandidates([
    { ticketAmount: 1.1, eligibleTournaments: [{ tourneyId: 63886, tourneyName: 'Step [2] to ₮109 CoinMasters PEPE' }] },
    { ticketAmount: 11, eligibleTournaments: [{ tourneyId: 63885, tourneyName: '20 Seats to ₮109 CoinMasters SHIBA' }] },
  ]);
  expect(findTicketPrize('63887', 'Step [3] to ₮109 CoinMasters SHIBA', candidates)).toBe(1.1);
  expect(findTicketPrize('63886', 'Step [2] to ₮109 CoinMasters PEPE', candidates)).toBe(11);
});
```

Also assert that a candidate two IDs away or with a different `₮` amount is not accepted by fallback.

Run: `npm test -- src/utils/bankroll.test.ts`

Expected: FAIL only for the two guarded fallback assertions.

- [ ] **Step 5: Implement the guarded fallback and verify GREEN**

When exact candidates are empty, accept only a candidate satisfying all of:

```ts
Number(candidate.tourneyId) === Number(id) - 1
destinationAmount(candidate.tourneyName) === destinationAmount(name)
candidate has the expected Step[N-1] or Seats shape
```

Run: `npm test -- src/utils/bankroll.test.ts`

Expected: all bankroll utility tests PASS.

- [ ] **Step 6: Commit the pure resolver**

```bash
git add src/utils/bankroll.ts src/utils/bankroll.test.ts
git commit -m "fix: resolve satellite ticket prizes"
```

### Task 2: Tournament normalization and page import integration

**Files:**
- Modify: `src/utils/bankroll.ts:177-248`
- Modify: `src/pages/BankrollPage.tsx:1-142,517-558`
- Test: `src/utils/bankroll.test.ts:89-238,282-359,485-581`
- Test: `src/pages/BankrollPage.test.tsx:1-360`

**Interfaces:**
- Consumes: `extractTicketCandidates(parsed)` and `findTicketPrize(id, name, candidates)` from Task 1.
- Produces: `normalizeTournamentSessions(rows, { ticketCandidates, ticketPrices })` where manual `ticketPrices[id]` overrides automatic resolution.
- Produces: page imports that update both new and stored sessions with the same resolver.

- [ ] **Step 1: Write failing normalization tests with hand-calculated profits**

Add table-driven rows with literal expectations:

```ts
const ticketCandidates = extractTicketCandidates([
  { ticketAmount: 0.3, eligibleTournaments: [{ tourneyId: 85493, tourneyName: 'Step [3] to ₮215 CoinMillion 2DAY' }] },
  { ticketAmount: 3.3, eligibleTournaments: [{ tourneyId: 85492, tourneyName: 'Step [2] to ₮215 CoinMillion 2DAY' }] },
  { ticketAmount: 5.5, eligibleTournaments: [{ tourneyId: 85122, tourneyName: '4 Seats to ₮215 CoinMillion 2DAY' }] },
  { ticketAmount: 1.1, eligibleTournaments: [{ tourneyId: 63886, tourneyName: 'Step [2] to ₮109 CoinMasters PEPE' }] },
  { ticketAmount: 11, eligibleTournaments: [{ tourneyId: 63885, tourneyName: '20 Seats to ₮109 CoinMasters SHIBA' }] },
]);

it.each([
  ['85494', 'Step [4] to ₮215 CoinMillion 2DAY', '0.00', 0.3],
  ['85119', 'Step [3] to ₮215 CoinMillion 2DAY', '0.30', 3.0],
  ['85123', 'Step [2] to ₮215 CoinMillion 2DAY', '0.55', 4.95],
  ['83097', '15 Seats to ₮11 Regs Round Table', '2.20', 8.8],
  ['63887', 'Step [3] to ₮109 CoinMasters SHIBA', '0.10', 1.0],
  ['63886', 'Step [2] to ₮109 CoinMasters PEPE', '1.10', 9.9],
])('calculates the won ticket for %s', (id, name, buyIn, profit) => {
  const [session] = normalizeTournamentSessions([
    {
      tournament_id: id,
      tournament_name: name,
      minigames_type_id: 1,
      start_datetime: '2026-08-05 12:00:00',
      internal_ref: `ref-${id}`,
      buy_in: buyIn,
      win_loss: '0.00',
      total_no_of_entries: 1,
      is_ticket: true,
    },
  ], { ticketCandidates });
  expect(session.profit).toBeCloseTo(profit, 5);
});
```

Add a regression assertion that `total_no_of_entries: 3` with `buy_in: '1.65'` subtracts `$1.65` once, not three times.

- [ ] **Step 2: Run utility tests and verify RED**

Run: `npm test -- src/utils/bankroll.test.ts`

Expected: FAIL because normalization still reads the obsolete same-name price map.

- [ ] **Step 3: Route normalization through the resolver and verify GREEN**

Resolve in this order for `is_ticket: true`:

```ts
const manualPrize = strictNonNegativeNumber(options?.ticketPrices?.[id]);
const ticketPrice = manualPrize ?? findTicketPrize(id, r.tournament_name, options?.ticketCandidates);
```

Keep the persisted field name `ticketPrice`, then calculate `profit = winLoss + (ticketPrice ?? 0) - buyIn`.

Run: `npm test -- src/utils/bankroll.test.ts`

Expected: PASS.

- [ ] **Step 4: Rewrite the page-level later-import test and verify RED**

Use stored tournament `63887 Step [3] ... SHIBA` and upload the complete candidate structure:

```ts
const ticketExport = [{
  ticketAmount: 1.1,
  eligibleTournaments: [{
    tourneyId: 63886,
    tourneyName: 'Step [2] to ₮109 CoinMasters PEPE',
  }],
}];
```

Assert the page displays `Ticket +$1.10`, displays `$1.00`, and POSTs `{ id: '63887', ticketPrice: 1.1, profit: 1 }`. Keep the malformed import and both edit-draft regression tests using the complete real ticket structure.

Run: `npm test -- src/pages/BankrollPage.test.tsx`

Expected: FAIL because `BankrollPage` still builds and searches the obsolete price map.

- [ ] **Step 5: Integrate candidate lists into the page import flow**

Replace `mergeTicketPrices(parsedFiles.map(extractTicketPrices))` with one flattened candidate list. Use `findTicketPrize` for the editing session, stored ticket updates, and `collectTicketPrices` missing-price check. Pass `{ ticketCandidates, ticketPrices: manualTicketPrices }` to `parseBankrollFile`. Remove `mergeTicketPrices`; retain manual ID-keyed values and existing synchronization ordering.

- [ ] **Step 6: Run page and utility tests and verify GREEN**

Run: `npm test -- src/utils/bankroll.test.ts src/pages/BankrollPage.test.tsx`

Expected: both files PASS with no React act warnings or unhandled errors.

- [ ] **Step 7: Commit import integration**

```bash
git add src/pages/BankrollPage.tsx src/pages/BankrollPage.test.tsx src/utils/bankroll.ts src/utils/bankroll.test.ts
git commit -m "fix: apply won ticket prizes to bankroll imports"
```

### Task 3: Full-data audit, review, and release verification

**Files:**
- Verify: `src/utils/bankroll.ts`
- Verify: `src/pages/BankrollPage.tsx`
- Verify: supplied JSON files under `/Users/hongjinho/project/test/log/2026-08-13_01-11-57/`

**Interfaces:**
- Consumes: completed parser and import behavior from Tasks 1-2.
- Produces: evidence that all 71 `is_ticket: true` rows resolve and the repository remains release-ready.

- [ ] **Step 1: Audit all supplied ticket-win rows through production functions**

Create a temporary Vitest audit beside `src/utils/bankroll.test.ts` that reads the two absolute paths supplied by the user, calls `extractTicketCandidates` and `normalizeTournamentSessions`, and asserts:

```ts
expect(ticketRows).toHaveLength(71);
expect(ticketRows.filter(hasMissingTicketPrice)).toHaveLength(0);
expect(ticketRows.find((row) => row.id === '63886')?.ticketPrice).toBe(11);
expect(ticketRows.find((row) => row.id === '63887')?.ticketPrice).toBe(1.1);
expect(ticketRows.find((row) => row.id === '85119')?.profit).toBeCloseTo(3, 5);
```

Run the audit once, record the output, then delete the temporary audit file so no machine-specific absolute path is committed.

- [ ] **Step 2: Run the complete verification suite**

Run each command separately:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: 0 failures, 0 lint errors, successful production bundle, and no whitespace errors.

- [ ] **Step 3: Review the complete diff against the design**

Confirm that same-stage tickets cannot satisfy Step prizes, the adjacent-ID fallback has all three guards, manual editing still overrides automatic resolution, malformed amounts remain rejected, and only the four planned source/test files plus docs changed.

- [ ] **Step 4: Commit any review-only corrections using TDD**

If review finds a behavior gap, add a failing test, observe RED, make the minimal correction, observe GREEN, then commit only that correction. If no correction is needed, do not create an empty commit.

- [ ] **Step 5: Push and create the pull request**

Write `/tmp/bankroll-satellite-pr-body.md` with exactly:

```markdown
## Summary
- resolve ticket wins against the next satellite stage instead of the same-stage entry ticket
- derive Seat/Seats prizes from the destination amount and guard the two adjacent-ID naming changes
- recalculate and persist imported and existing bankroll sessions

## Verification
- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`
- supplied export audit: 71/71 ticket wins resolved
```

Then run:

```bash
git push -u origin feature/fix-bankroll-satellite-prizes
gh pr create --base main --head feature/fix-bankroll-satellite-prizes --title "Fix bankroll satellite ticket prizes" --body-file /tmp/bankroll-satellite-pr-body.md
```

The PR body must summarize the root cause, the matching rules, the two guarded naming exceptions, and the exact verification results.
