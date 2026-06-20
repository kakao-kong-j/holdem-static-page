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
