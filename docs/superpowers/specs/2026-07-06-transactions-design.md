# Transactions Tab Design

## Goal
Add a new authenticated app tab for uploading, classifying, reviewing, and managing CoinPoker transaction JSON exports.

## Source File Findings
Sample file: `/Users/hongjinho/project/test/log/2026-07-06_01-04-51/transactions-2026-07-06-010509.json`.

- Shape: JSON array.
- Rows: 422 raw rows, 416 exact unique rows.
- Date range: `2026-06-03 13:50:56` through `2026-07-05 16:00:46`.
- `txn_id` alone is not unique; tournament buy-ins/re-entries and some duplicated exports reuse it. Dedupe must use a stable row signature, not just `txn_id`.

## Direction Rules

| txn_type | sub_type | Direction | Amount rule |
|---|---|---|---|
| `deposit` | `Deposit Successful` | income | `amount` |
| `leaderboard` | `CoinRaces` | income | `amount` |
| `reward` | `15% Daily Rakeback` | income | `amount` |
| `reward` | `Pending Bonus Release` | income | `amount` |
| `reward` | `Redeemed To Withdrawable` | transfer | `amount`, excluded from net profit by default |
| `tournament` | `Tournament Buy In` | expense | `-amount` |
| `tournament` | `Tournament Re-buy/Re-entry` | expense | `-amount` |
| `tournament` | `Tournament Winnings` | income | `amount` |
| `tournament` | `Tournament Refund` | income | `amount` |
| `tournament` | `Unused Ticket Refund` | income | `amount` |
| `game_play` | `Cash Games` | income or expense | `buy_out.amount - buy_in.amount` |
| `sportsbook` | `sportsbook` | expense | `buy_out.amount - buy_in.amount` |
| anything else | anything else | unknown | `0` |

## Architecture
Keep this separate from the existing bankroll import because transaction exports are a ledger, while bankroll imports are aggregated cash/tournament sessions. Add one small domain utility, one sync utility, one Vercel API route, and one page. Reuse the existing Blob read/merge/overwrite style from `api/bankroll.ts` to avoid a new storage abstraction.

## UI
Add a sidebar tab labeled `거래내역`. The page supports:

- JSON file upload.
- Server merge on upload, local optimistic display when offline.
- Date filter.
- Direction filter: all/income/expense/transfer/unknown.
- Type filter by `txn_type`.
- Summary cards: income, expense, transfer, net, row count.
- Records table with delete action.
- Clear all action.

## Storage
Store normalized transactions at `users/{sub}/transactions.json`. Merge by normalized `id`. `id` is built from `txn_id`, `txn_type`, `sub_type`, `date`, and signed amount. Exact duplicate rows collapse; distinct rows sharing `txn_id` remain distinct.

## Testing
Add unit tests for classification, dedupe, summaries, and sync normalization. Run `npm test` and `npm run build` before any completion claim.
