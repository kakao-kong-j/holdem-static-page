# Codebase Cleanup Design

## Summary

This cleanup targets the current React/TypeScript/Vite app after the repository switched to `main`. The goal is to remove the stale GitHub Pages deployment path, restore lint health, document the privacy implications of Vercel Blob public objects, reduce responsibilities in the top-level app and two large pages, and add runtime validation for fetched chart data.

The work is intentionally incremental. It should preserve current user-facing behavior except for removing GitHub Pages deployment support. Vercel remains the active deployment target.

## Goals

1. Remove GitHub Pages configuration and stale documentation references.
2. Make `npm run lint` pass without disabling the relevant React rules globally.
3. Document the current public Vercel Blob privacy posture without changing storage infrastructure.
4. Split `App.tsx` responsibilities into smaller layout/view modules.
5. Split safe orchestration responsibilities out of `BankrollPage` and `CoinPokerAnalysisPage` without changing their UI behavior.
6. Replace unchecked chart JSON casting with runtime validation and clear load errors.
7. Preserve existing behavior verified by tests and build.

## Non-Goals

- Do not migrate Vercel Blob data to a private database or new storage provider.
- Do not redesign the visual UI.
- Do not introduce React Router.
- Do not refactor all large page markup in one pass.
- Do not change GTO chart semantics, combo totals, quiz sampling behavior, or bankroll/CoinPoker business logic except where needed to preserve behavior during extraction.

## Current Problems

### GitHub Pages deployment is stale

`.github/workflows/deploy.yml` deploys the same SPA to GitHub Pages. The app now requires `/api/auth/me` and Google auth APIs, which GitHub Pages cannot provide. This deployment path is misleading and likely broken.

### Lint fails

`npm run lint` currently fails on React rules:

- Synchronous `setState` in effects in `src/App.tsx`, `src/components/QuizCompareSection.tsx`, and `src/pages/FacingPage.tsx`.
- `Date.now()` purity warning in `src/pages/QuizPage.tsx`.

These should be fixed structurally rather than by disabling lint globally.

### Public Blob privacy risk needs documentation

`api/records.ts`, `api/bankroll.ts`, and `api/coinpoker.ts` write user-derived data with `access: 'public'`. API routes are authenticated, but public Blob URLs are readable if exposed. For this task, the requested scope is review/documentation only.

### App shell has too many responsibilities

`src/App.tsx` owns auth gate, chart data loading, quiz record sync, drawer/sidebar, top bar, view metadata, stack-tab visibility, and page rendering. Adding or changing pages requires editing several conditionals in one file.

### Large pages mix IO, state, domain work, and presentation

`src/pages/CoinPokerAnalysisPage.tsx` and `src/pages/BankrollPage.tsx` are large components. They combine remote sync, file parsing/import, derived state, mutation handlers, and UI rendering.

### Chart data fetch trusts JSON shape

`src/hooks/useChartData.ts` casts `json.data as AllData` without checking that required stack keys or chart/action arrays exist.

## Proposed Approach

Use the incremental cleanup approach.

### 1. Remove GitHub Pages setup

Delete `.github/workflows/deploy.yml`.

Update project documentation that still describes GitHub Pages as primary deployment. Vercel should be described as the active deployment path. If `vite.config.ts` still supports a GitHub Pages base path, either keep it temporarily if harmless or simplify it only if doing so does not break Vercel/local behavior.

### 2. Fix lint failures

Fix the specific rule violations while preserving behavior.

- For invalid selected values in `FacingPage` and `QuizCompareSection`, prefer derived effective values or controlled fallback values over effect-driven synchronous correction.
- For `App.tsx`, remove or replace the `SB_OPEN_DISABLED_STACKS` correction effect. Because the disabled list is currently empty, the effect is unnecessary today. If future disabled stacks are still desired, enforce the fallback in navigation/stack change handlers rather than an effect.
- For `QuizPage`, ensure timestamp generation happens in an event handler path acceptable to React lint, not during render-time computation.

Do not disable `react-hooks/set-state-in-effect` or `react-hooks/purity` globally.

### 3. Document Blob privacy review

Add `docs/security/blob-privacy-review.md`.

The document should include:

- Current storage locations and API files.
- What data is stored.
- Why public Blob URLs are a privacy risk.
- Current mitigating factors: authenticated API routes, sanitized user path segment, non-user-supplied path prefix.
- Remaining risks: leaked URLs, raw hand-history sensitivity, future data growth.
- Recommended future options: private storage, encrypted payloads, authenticated proxy reads, DB migration, data minimization.

No storage implementation change is required for this item.

### 4. Split App responsibilities

Introduce small modules/components with clear boundaries.

Candidate structure:

- `src/app/views.tsx` or `src/app/viewRegistry.tsx`
  - Defines `View`, labels, width metadata, stack-tab visibility, and render helpers or component references.
- `src/components/AppShell.tsx`
  - Owns drawer layout, sidebar, top bar, and content frame.
- Optional `src/components/AppSidebar.tsx` and `src/components/AppTopBar.tsx` if `AppShell` would still be large.

`src/App.tsx` should remain the orchestrator for auth/data loading and app-level navigation, but it should not contain all layout markup and repeated view conditionals.

### 5. Split large page responsibilities safely

Do not attempt a full rewrite. Extract stable orchestration into hooks while keeping page markup recognizable.

For `BankrollPage`:

- Extract remote/local store and mutation handlers into a hook such as `src/hooks/useBankrollStore.ts` or `src/pages/bankroll/useBankrollStore.ts`.
- The hook should expose sessions, loading/error/import status, and handlers used by the page.
- Keep chart/card rendering in the page or small components unless extraction is straightforward.

For `CoinPokerAnalysisPage`:

- Extract fetch/ingest/push/clear store logic into a hook such as `src/hooks/useCoinPokerStore.ts` or `src/pages/coinpoker/useCoinPokerStore.ts`.
- Keep derived comparison calculations in the page initially unless they are easy to isolate without broad churn.

The extraction must preserve current optimistic/offline behavior: failed sync should not make the whole app unusable.

### 6. Add chart data runtime validation

Create a small validator, for example `src/utils/chartDataValidation.ts`.

Validation requirements:

- Root value must contain a `data` object.
- Required stack keys must exist: `15BB`, `25BB`, `40BB`, `100BB`.
- Each stack value must be an object.
- Each chart value must be an object.
- Each action value must be an array of strings.

`useChartData` should call the validator and show a clear error if validation fails. The validator should be unit-tested with valid minimal data and representative invalid inputs.

## Testing and Verification

After implementation, run:

```bash
npm run lint
npm test
npm run build
```

Expected result:

- Lint passes.
- Existing tests pass.
- New chart data validation tests pass.
- Build succeeds.

Manual checks:

- App still loads authenticated Vercel flow in local/Vercel-compatible mode.
- Main views still render after chart data loads.
- Bankroll and CoinPoker pages keep their import/sync UI behavior.
- Documentation no longer describes GitHub Pages as the primary deployment.

## Risks and Mitigations

- **Refactor regression risk:** Keep App/page extraction mechanical and incremental. Verify with tests/build/lint after each major group when practical.
- **Large page extraction risk:** Avoid changing business logic. Move existing code into hooks first, then clean names/types.
- **Chart data validation false negatives:** Validate the actual bundled JSON during tests or at least run the app build after adding validation. Keep validator strict on shape but not on exact chart names/actions.
- **Privacy expectations:** The new document must clearly state that this task does not make Blob data private; it only records risks and future options.

## Acceptance Criteria

- `.github/workflows/deploy.yml` is removed.
- Any stale GitHub Pages primary-deployment documentation is updated or removed.
- `npm run lint` passes.
- `docs/security/blob-privacy-review.md` exists and accurately documents the public Blob risk.
- `src/App.tsx` is smaller and delegates layout/view metadata to focused modules.
- At least one safe responsibility is extracted from each of `BankrollPage` and `CoinPokerAnalysisPage`.
- `useChartData` no longer directly casts unchecked JSON to `AllData`.
- Runtime chart data validation has tests.
- `npm test` and `npm run build` pass.
