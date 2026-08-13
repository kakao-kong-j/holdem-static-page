# CoinPoker Batched Upload Design

## Goal

Allow large CoinPoker hand-history imports to persist without exceeding Vercel Function's 4.5 MB request or response body limit.

## Scope

- Split parsed CoinPoker hands into JSON request batches whose UTF-8 encoded request body is at most 3 MiB.
- Send batches sequentially so an upload's writes are deterministic and easy to retry.
- Keep the current optimistic in-memory merge while batches are persisted.
- Return compact upload acknowledgements instead of the complete accumulated store after each POST.
- Show upload progress and a clear error if one batch fails.
- Preserve the existing GET response and clear behavior; they are out of scope for this change.

## Architecture

`src/utils/coinpokerSync.ts` will own a pure batching utility and the upload loop. The batching utility measures the UTF-8 byte length of the same `{ hands }` JSON envelope used by the API, ensuring every non-empty batch is within the client safety limit. A single hand that alone exceeds that limit is rejected before a request is made because it cannot safely be transmitted through the Function.

`pushCoinPokerHands` will post batches one at a time and emit completed-hand progress after each successful acknowledgement. Its result will report the number of hands accepted by the server instead of returning all stored hands.

`api/coinpoker.ts` will retain chunked Blob persistence but change normal POST replies to `{ added }`. This prevents a successful small request from failing when the user's previously accumulated store has grown beyond the Function response limit.

`CoinPokerAnalysisPage` will use the progress callback to show a compact saving message while the optimistic store remains visible. A 413 response will be reported specifically, while other server failures retain the existing reconcile behavior.

## Error Handling

- Batches are sequential; once one fails, later batches are not sent.
- The UI reports that only the completed batches were saved and asks the user to retry. Server-side deduplication by `handId` makes retrying the whole import safe.
- A hand exceeding the 3 MiB batch ceiling produces a local error explaining that it cannot be uploaded.
- Existing network/offline behavior remains: parsed hands stay visible in the current session.

## Testing

- Unit-test byte-aware batching at the boundary, including multi-byte Korean text and a hand too large for a batch.
- Unit-test sequential upload calls, compact acknowledgement handling, and progress reporting with mocked `fetch`.
- Unit-test the API handler's compact POST response and append behavior with mocked Blob/session dependencies.
- Run the full test suite, lint, production build, and `git diff --check` before publication.
