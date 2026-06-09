# CoinPoker Preflop Comparison Design

## Goal

Add a CoinPoker hand-history analysis page that parses pasted or uploaded `.txt` logs, extracts Hero's preflop decisions, and compares first-in RFI opportunities against the existing GTO Open Range charts.

## Scope

This first version focuses on RFI/Open Range comparison only. It should parse all Hero hands from the CoinPoker log, but only hands where Hero is first to voluntarily act in an unopened pot are compared against GTO. Hands with prior calls, raises, all-ins, or blind-defense/facing contexts are retained in the parsed output and counted as excluded so future facing/3bet analysis can reuse the parser.

## Existing Context

The app is a React, TypeScript, and Vite GTO preflop chart viewer. It loads `public/gto-preflop-charts-all.json` at runtime into `AllData`, with stack-specific chart maps shaped as `data[stackSize][chartName][action] = hand[]`.

The current Open Range page uses `buildOpenRangeData(stackData)` and `RangeGrid` to render the earliest non-SB opener for each 13x13 hand. For this feature, comparison should use the direct Hero-position chart, such as `UTG RFI`, `HJ RFI`, `CO RFI`, or `BTN RFI`, rather than the aggregated earliest-position grid.

## Parser Requirements

Create a focused CoinPoker parser that accepts raw text and returns structured hand records.

Each parsed Hero hand should include:

- `handId`
- start time text, if present
- blind and ante numbers from the header
- seat count and button seat
- Hero seat and Hero starting stack
- Hero position, derived from button/blind seats and active seats
- Hero hole cards
- normalized hand name, such as `TT`, `T5o`, or `73s`
- all preflop actions between `*** HOLE CARDS ***` and the next street marker
- Hero's first preflop action, if any
- exclusion or comparison eligibility reason

The parser should be resilient to:

- chip amounts with commas
- `ALLIN` action lines
- missing postflop sections
- tournament seat labels and anonymous player names
- 6-max and 7-max seating

## Position Model

Use active seats in button-relative order to derive positions. For 6-handed tables, positions are `SB`, `BB`, `UTG`, `HJ`, `CO`, `BTN`. For 7-handed tables, positions are `SB`, `BB`, `UTG`, `LJ`, `HJ`, `CO`, `BTN`.

The first implementation should compare only `UTG`, `HJ`, `CO`, and `BTN` where matching existing RFI charts are expected. If the table-derived position is `LJ`, `SB`, or `BB`, keep the parsed hand but mark it excluded with an explicit reason.

## Comparison Requirements

Create a comparison utility that receives parsed hands, selected stack data, and a target stack size. It should classify each parsed Hero hand into one of these statuses:

- `match-open`: GTO opens and Hero made an aggressive first-in action.
- `match-fold`: GTO folds and Hero folded.
- `missed-open`: GTO opens but Hero folded or checked instead.
- `extra-open`: GTO folds but Hero raised or shoved.
- `excluded`: the hand is not comparable in this first version.

Aggressive Hero actions are `raises` and `ALLIN`. Passive actions such as `calls`, `checks`, and `folds` are not treated as RFI opens.

Only compare hands where:

- Hero has a normalized hand name.
- Hero position maps to an existing `${position} RFI` chart.
- No player before Hero voluntarily called, raised, bet, or shoved preflop.
- Hero has a first preflop action.

For target stack selection, the first version can use the user-selected app stack tab instead of auto-mapping by effective stack. The parsed Hero stack in BB should still be stored for future filtering.

## Page Design

Add a new top-level tab named `CoinPoker 분석`.

The page should include:

- A file input for `.txt` logs.
- A textarea for direct paste.
- A clear button.
- Summary metrics: parsed Hero hands, comparable hands, matches, missed opens, extra opens, and excluded hands.
- A 13x13 comparison grid using the existing `RangeGrid` style conventions with a local color map.
- A detail table listing comparable and excluded hands with hand ID, position, hand, Hero action, GTO decision, status, and exclusion reason.

The UI should remain compact and analysis-oriented, matching the existing dark dashboard style. It should not introduce a marketing-style landing page or large decorative sections.

## Error Handling

If the input is empty, show an empty state instead of an error.

If no Hero hands are found, show a concise message that the log could not find `Dealt to Hero [...]` entries.

If parsing finds hands but none are comparable, show summary counts and the exclusion reasons in the table so the user can understand why.

## Testing

Use TDD.

First write parser tests from a small CoinPoker fixture covering:

- Hero cards normalization.
- preflop action slicing before flop.
- Hero position derivation.
- unopened RFI eligibility.
- exclusion when there is a prior limp/raise.

Then write comparison tests covering:

- GTO open plus Hero raise becomes `match-open`.
- GTO open plus Hero fold becomes `missed-open`.
- GTO fold plus Hero raise becomes `extra-open`.
- non-comparable hands remain excluded with reasons.

Finally verify the app with the existing test suite and production build.
