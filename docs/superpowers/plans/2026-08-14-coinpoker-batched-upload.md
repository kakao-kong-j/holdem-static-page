# CoinPoker Batched Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist arbitrarily large CoinPoker imports through bounded, sequential Function requests.

**Architecture:** A pure sync utility creates UTF-8-size-bounded request batches and posts them sequentially, reporting progress after each acknowledgement. The API returns only an added-count acknowledgement after normal uploads, so it cannot echo a large accumulated store.

**Tech Stack:** React 19, TypeScript, Vitest, Vercel Functions, Vercel Blob.

## Global Constraints

- Every `{ hands }` request body must be no larger than 3 MiB when UTF-8 encoded.
- Preserve optimistic display and deduplicated retry behavior.
- Do not modify GET or clear response contracts in this change.

---

### Task 1: Size-bounded client upload utility

**Files:**
- Modify: `src/utils/coinpokerSync.ts`
- Create: `src/utils/coinpokerSync.test.ts`

**Interfaces:**
- Produces `splitCoinPokerUploadBatches(hands: CoinPokerHand[]): CoinPokerHand[][]`.
- Changes `pushCoinPokerHands(hands, onProgress?)` to return `Promise<{ added: number }>`.

- [ ] **Step 1: Write failing tests**

```ts
expect(splitCoinPokerUploadBatches([small, small])).toHaveLength(1);
expect(splitCoinPokerUploadBatches([large, large])).toHaveLength(2);
await expect(pushCoinPokerHands([tooLarge])).rejects.toThrow('too large');
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/utils/coinpokerSync.test.ts`

- [ ] **Step 3: Implement the smallest byte-aware splitter and sequential uploader**

```ts
const bodyBytes = (hands: CoinPokerHand[]) => new TextEncoder().encode(JSON.stringify({ hands })).byteLength;
// Add hands until adding one would exceed 3 MiB; post each completed batch in order.
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npm test -- src/utils/coinpokerSync.test.ts`

### Task 2: Compact API acknowledgement and upload status

**Files:**
- Modify: `api/coinpoker.ts`
- Modify: `src/pages/CoinPokerAnalysisPage.tsx`
- Test: `src/utils/coinpokerSync.test.ts`

**Interfaces:**
- API normal POST returns `{ added: number }`.
- `pushCoinPokerHands` progress receives `{ completed: number; total: number }` after each batch.

- [ ] **Step 1: Write a failing acknowledgement/progress test**

```ts
await pushCoinPokerHands([first, second], progress.push);
expect(progress).toEqual([{ completed: 1, total: 2 }, { completed: 2, total: 2 }]);
```

- [ ] **Step 2: Run it and confirm the current contract fails**

Run: `npm test -- src/utils/coinpokerSync.test.ts`

- [ ] **Step 3: Return compact acknowledgements and surface status in the page**

```ts
res.status(200).json({ added: incoming.length });
// Display `서버에 저장 중: ${completed}/${total} 핸드` while busy.
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/utils/coinpokerSync.test.ts`

### Task 3: Broad verification and publish

**Files:**
- Verify: changed source, tests, design, plan

- [ ] **Step 1: Run checks**

Run: `npm test && npm run lint && npm run build && git diff --check`

- [ ] **Step 2: Review the final diff and commit**

```bash
git add api/coinpoker.ts src/utils/coinpokerSync.ts src/utils/coinpokerSync.test.ts src/pages/CoinPokerAnalysisPage.tsx docs/superpowers/plans/2026-08-14-coinpoker-batched-upload.md
git commit -m "fix: batch CoinPoker hand uploads"
```

- [ ] **Step 3: Push branch and open a draft pull request**

```bash
git push -u origin feature/coinpoker-batched-upload
gh pr create --draft --base main --title "Fix large CoinPoker hand uploads" --body "## Summary\n- batch uploads below Vercel Function payload limits\n- return compact upload acknowledgements\n- show persistence progress\n\n## Validation\n- npm test\n- npm run lint\n- npm run build"
```
