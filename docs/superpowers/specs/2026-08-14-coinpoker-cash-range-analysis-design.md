# CoinPoker Cash-Range Analysis Design

## Goal

Analyze CoinPoker cash hands using the exact range source and action frequencies shown by the `캐시 핸드레인지` tab, while keeping tournament analysis on the existing stack-specific GTO charts.

## Scope

- Load and validate `gto-cache-preflop-chart.json` for the CoinPoker analysis view.
- Route `cash` hands through the cache-range scenario model.
- Keep the existing `tournament` comparison path, including automatic 15/25/40/100BB selection, unchanged.
- Mark cash hands that cannot be mapped to a cache scenario as excluded; never fall back to tournament GTO data for cash hands.
- Display the active comparison source in the analysis UI.

## Architecture

Extract cache-range data loading into a reusable hook so the Cash Hand Range page and CoinPoker analysis load, parse, and report the same source consistently. The CoinPoker comparison utility will receive optional validated cash-range data. For cash hands, it will map the hand's position and preflop action history to the matching `CashScenario`, then classify an aggressive action as an open/raise decision when its cache frequency is positive. Tournament hands will retain the existing `compareCoinPokerAutoStack` path unchanged.

## Cash Scenario Mapping

- No voluntary action before Hero maps to the Hero position's `unopened` cache scenario.
- One prior raise maps to the Hero position's `opened` cache scenario with that raiser's position as opener.
- SB limp, SB raise, and BB raise-after-limp map to their explicit cache scenarios when the action history matches.
- Unmappable limped pots, unsupported action histories, missing positions, and absent cache scenarios receive `cash-chart-not-found`.

## UI and Error Handling

The Cash tab identifies its reference as `캐시 핸드레인지 기준`; Tournament identifies its reference as `토너먼트 GTO 기준`. If cache data is loading, cash comparison shows a loading state rather than silently using the tournament chart. If loading fails, cash hands show a concise cache-data error and remain excluded; tournament analysis continues normally.

## Testing

- Test cash scenario lookup against literal cache-range fixtures for unopened and facing-raise hands.
- Test that a cash hand's classification follows cache action frequencies rather than the stack-specific GTO input.
- Test that cash data absence excludes only cash hands and tournament comparison is unaffected.
- Run the full suite, lint, production build, and `git diff --check`.
