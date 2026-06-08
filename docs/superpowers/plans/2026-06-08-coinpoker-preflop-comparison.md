# CoinPoker Preflop Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CoinPoker analysis tab that parses Hero preflop decisions from text logs and compares first-in RFI spots against the existing GTO Open Range charts.

**Architecture:** Add two focused utility modules: `coinpokerParser.ts` parses raw hand history into Hero hand records, and `coinpokerCompare.ts` classifies those records against stack-specific RFI charts. Add `CoinPokerAnalysisPage.tsx` for file/paste input, summary cards, a 13x13 comparison grid, and a hand-detail table, then wire it into `App.tsx`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, existing `RangeGrid`, existing GTO chart types.

---

## File Structure

- Create `src/utils/coinpokerParser.ts`: CoinPoker hand-history parser, position derivation, hand normalization, and RFI eligibility tagging.
- Create `src/utils/coinpokerParser.test.ts`: parser tests using compact CoinPoker fixtures.
- Create `src/utils/coinpokerCompare.ts`: comparison status aggregation against selected `StackData`.
- Create `src/utils/coinpokerCompare.test.ts`: comparison tests with minimal in-memory charts.
- Create `src/pages/CoinPokerAnalysisPage.tsx`: input controls, summaries, grid, and table.
- Modify `src/App.tsx`: add the `coinpoker` view and render the new page with current `stackData` and `stack`.

---

### Task 1: CoinPoker Parser

**Files:**
- Create: `src/utils/coinpokerParser.test.ts`
- Create: `src/utils/coinpokerParser.ts`

- [ ] **Step 1: Write the failing parser tests**

Create `src/utils/coinpokerParser.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCoinPokerHands, normalizeHoleCards } from './coinpokerParser';

const SAMPLE = `CoinPoker Hand #68315300002: NLH (50/100/13) 2026/06/03 23:02:53 KST
Tournament 'Level Up Freeroll' '63001' 7-max Seat #6 is the button
Seat 1: d34501f2 (4,887 in chips)
Seat 2: 1a7f75a1 (4,987 in chips)
Seat 3: 6be23ea1 (4,987 in chips)
Seat 4: a5bdc94b (4,987 in chips)
Seat 5: 6f090cdd (5,265 in chips)
Seat 6: Hero (4,887 in chips)
d34501f2: posts ante 13
1a7f75a1: posts ante 13
6be23ea1: posts ante 13
a5bdc94b: posts ante 13
6f090cdd: posts ante 13
Hero: posts ante 13
d34501f2: posts small blind 50
1a7f75a1: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Th Td]
6be23ea1: folds
a5bdc94b: folds
6f090cdd: folds
Hero: raises 700 to 800
d34501f2: ALLIN 4,824
1a7f75a1: folds
Hero: ALLIN 4,074
*** FLOP *** [Ad Jd 2h]
*** SUMMARY ***

CoinPoker Hand #68315300003: NLH (60/120/15) 2026/06/03 23:03:46 KST
Tournament 'Level Up Freeroll' '63001' 7-max Seat #2 is the button
Seat 2: b0b830c5 (4,874 in chips)
Seat 3: de5cf97c (4,874 in chips)
Seat 4: 6ad9fb31 (4,874 in chips)
Seat 5: 8b5e9757 (5,152 in chips)
Seat 6: Hero (10,226 in chips)
Seat 7: 57a796f8 (5,000 in chips)
de5cf97c: posts small blind 60
6ad9fb31: posts big blind 120
*** HOLE CARDS ***
Dealt to Hero [7c 3c]
8b5e9757: folds
Hero: folds
57a796f8: raises 360 to 480
*** FLOP *** [5s Td Th]
*** SUMMARY ***

CoinPoker Hand #68315300004: NLH (50/100/13) 2026/06/03 23:06:00 KST
Tournament 'Level Up Freeroll' '63001' 6-max Seat #5 is the button
Seat 1: alpha (5,000 in chips)
Seat 2: beta (5,000 in chips)
Seat 3: gamma (5,000 in chips)
Seat 4: delta (5,000 in chips)
Seat 5: epsilon (5,000 in chips)
Seat 6: Hero (5,000 in chips)
Hero: posts small blind 50
alpha: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Tc 5s]
beta: folds
gamma: folds
delta: folds
epsilon: calls 100
Hero: calls 50
alpha: checks
*** FLOP *** [8c 9c 3s]
*** SUMMARY ***`;

describe('normalizeHoleCards', () => {
  it('normalizes pairs, suited hands, and offsuit hands', () => {
    expect(normalizeHoleCards(['Th', 'Td'])).toBe('TT');
    expect(normalizeHoleCards(['7c', '3c'])).toBe('73s');
    expect(normalizeHoleCards(['Tc', '5s'])).toBe('T5o');
  });
});

describe('parseCoinPokerHands', () => {
  it('extracts Hero cards, preflop actions, blinds, stack, and first Hero action', () => {
    const hands = parseCoinPokerHands(SAMPLE);
    expect(hands).toHaveLength(3);

    expect(hands[0]).toMatchObject({
      handId: '68315300002',
      smallBlind: 50,
      bigBlind: 100,
      ante: 13,
      heroSeat: 6,
      buttonSeat: 6,
      heroPosition: 'BTN',
      heroHand: 'TT',
      heroStackBb: 48.87,
      heroFirstAction: 'raises',
      rfiEligible: true,
    });
    expect(hands[0].preflopActions.map(a => a.action)).toEqual([
      'folds',
      'folds',
      'folds',
      'raises',
      'ALLIN',
      'folds',
      'ALLIN',
    ]);
  });

  it('derives a 6-max SB hand and excludes it from first-version comparison', () => {
    const hands = parseCoinPokerHands(SAMPLE);
    expect(hands[2]).toMatchObject({
      heroPosition: 'SB',
      heroHand: 'T5o',
      heroFirstAction: 'calls',
      rfiEligible: false,
      exclusionReason: 'position-not-supported',
    });
  });

  it('marks unopened non-SB hands eligible and stops actions before the flop', () => {
    const hands = parseCoinPokerHands(SAMPLE);
    expect(hands[1]).toMatchObject({
      heroPosition: 'HJ',
      heroHand: '73s',
      heroFirstAction: 'folds',
      rfiEligible: true,
    });
    expect(hands[1].preflopActions.some(a => a.action === 'bets')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the parser tests to verify they fail**

Run:

```bash
npm test -- src/utils/coinpokerParser.test.ts
```

Expected: FAIL because `./coinpokerParser` does not exist.

- [ ] **Step 3: Implement the parser**

Create `src/utils/coinpokerParser.ts`:

```ts
export type CoinPokerPosition = 'UTG' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB' | 'UNKNOWN';

export interface CoinPokerAction {
  player: string;
  action: string;
  line: string;
}

export interface CoinPokerHand {
  handId: string;
  startedAt: string;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  tableSize: number;
  buttonSeat: number | null;
  heroSeat: number | null;
  heroStack: number | null;
  heroStackBb: number | null;
  heroPosition: CoinPokerPosition;
  heroCards: string[];
  heroHand: string | null;
  preflopActions: CoinPokerAction[];
  heroFirstAction: string | null;
  rfiEligible: boolean;
  exclusionReason: string | null;
}

const RANK_ORDER = 'AKQJT98765432';
const SUPPORTED_RFI_POSITIONS = new Set(['UTG', 'HJ', 'CO', 'BTN']);
const VOLUNTARY_ACTIONS = new Set(['calls', 'raises', 'bets', 'ALLIN']);

function parseAmount(value: string): number {
  return Number(value.replace(/,/g, ''));
}

export function normalizeHoleCards(cards: string[]): string | null {
  if (cards.length !== 2) return null;
  const [a, b] = cards;
  const ar = a[0]?.toUpperCase();
  const br = b[0]?.toUpperCase();
  const as = a[1];
  const bs = b[1];
  if (!ar || !br || !RANK_ORDER.includes(ar) || !RANK_ORDER.includes(br)) return null;
  if (ar === br) return `${ar}${br}`;
  const sorted = [ar, br].sort((x, y) => RANK_ORDER.indexOf(x) - RANK_ORDER.indexOf(y));
  return `${sorted[0]}${sorted[1]}${as === bs ? 's' : 'o'}`;
}

function splitHandBlocks(raw: string): string[] {
  return raw
    .split(/\n(?=CoinPoker Hand #)/)
    .map(block => block.trim())
    .filter(block => block.startsWith('CoinPoker Hand #'));
}

function derivePosition(
  seats: number[],
  buttonSeat: number | null,
  heroSeat: number | null,
  smallBlindSeat: number | null,
  bigBlindSeat: number | null,
): CoinPokerPosition {
  if (!heroSeat || seats.length === 0) return 'UNKNOWN';
  if (heroSeat === smallBlindSeat) return 'SB';
  if (heroSeat === bigBlindSeat) return 'BB';
  if (!buttonSeat) return 'UNKNOWN';

  const sortedSeats = [...seats].sort((a, b) => a - b);
  const nextSeat = (seat: number) => {
    const larger = sortedSeats.find(s => s > seat);
    return larger ?? sortedSeats[0];
  };

  const order: number[] = [];
  let current = buttonSeat;
  for (let i = 0; i < sortedSeats.length; i++) {
    current = nextSeat(current);
    order.push(current);
  }

  const tablePositions = seats.length >= 7
    ? ['SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO', 'BTN']
    : ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];
  const idx = order.indexOf(heroSeat);
  return (tablePositions[idx] as CoinPokerPosition | undefined) ?? 'UNKNOWN';
}

function extractPreflopActions(lines: string[]): CoinPokerAction[] {
  const holeIndex = lines.findIndex(line => line === '*** HOLE CARDS ***');
  if (holeIndex < 0) return [];
  const actions: CoinPokerAction[] = [];
  for (const line of lines.slice(holeIndex + 1)) {
    if (/^\*\*\* (FLOP|TURN|RIVER|SHOWDOWN|SUMMARY)/.test(line)) break;
    if (line.startsWith('Dealt to ')) continue;
    const match = line.match(/^(.+?): (folds|calls|checks|raises|bets|ALLIN)\b/);
    if (!match) continue;
    actions.push({ player: match[1], action: match[2], line });
  }
  return actions;
}

function classifyEligibility(
  heroPosition: CoinPokerPosition,
  preflopActions: CoinPokerAction[],
): Pick<CoinPokerHand, 'rfiEligible' | 'exclusionReason' | 'heroFirstAction'> {
  const heroIndex = preflopActions.findIndex(action => action.player === 'Hero');
  if (heroIndex < 0) {
    return { rfiEligible: false, exclusionReason: 'hero-no-action', heroFirstAction: null };
  }

  if (!SUPPORTED_RFI_POSITIONS.has(heroPosition)) {
    return {
      rfiEligible: false,
      exclusionReason: 'position-not-supported',
      heroFirstAction: preflopActions[heroIndex].action,
    };
  }

  const priorVoluntaryAction = preflopActions
    .slice(0, heroIndex)
    .some(action => VOLUNTARY_ACTIONS.has(action.action));
  if (priorVoluntaryAction) {
    return {
      rfiEligible: false,
      exclusionReason: 'prior-voluntary-action',
      heroFirstAction: preflopActions[heroIndex].action,
    };
  }

  return {
    rfiEligible: true,
    exclusionReason: null,
    heroFirstAction: preflopActions[heroIndex].action,
  };
}

export function parseCoinPokerHands(raw: string): CoinPokerHand[] {
  return splitHandBlocks(raw).flatMap(block => {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const header = lines[0] ?? '';
    const handMatch = header.match(/^CoinPoker Hand #(\d+): NLH \(([\d,]+)\/([\d,]+)(?:\/([\d,]+))?\) (.+)$/);
    const tableMatch = lines.find(line => /-max Seat #\d+ is the button/.test(line))?.match(/(\d+)-max Seat #(\d+) is the button/);
    const seatMatches = lines
      .map(line => line.match(/^Seat (\d+): (.+?) \(([\d,]+) in chips\)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match));

    const heroSeatMatch = seatMatches.find(match => match[2] === 'Hero');
    const heroSeat = heroSeatMatch ? Number(heroSeatMatch[1]) : null;
    const heroStack = heroSeatMatch ? parseAmount(heroSeatMatch[3]) : null;
    const smallBlindMatch = lines.find(line => line.includes(': posts small blind '))?.match(/^(.+?): posts small blind ([\d,]+)/);
    const bigBlindMatch = lines.find(line => line.includes(': posts big blind '))?.match(/^(.+?): posts big blind ([\d,]+)/);
    const seatByName = new Map(seatMatches.map(match => [match[2], Number(match[1])]));
    const smallBlindSeat = smallBlindMatch ? seatByName.get(smallBlindMatch[1]) ?? null : null;
    const bigBlindSeat = bigBlindMatch ? seatByName.get(bigBlindMatch[1]) ?? null : null;
    const heroCardsMatch = lines.find(line => line.startsWith('Dealt to Hero '))?.match(/\[([2-9TJQKA][cdhs]) ([2-9TJQKA][cdhs])\]/i);
    const heroCards = heroCardsMatch ? [heroCardsMatch[1], heroCardsMatch[2]] : [];
    const smallBlind = handMatch ? parseAmount(handMatch[2]) : 0;
    const bigBlind = handMatch ? parseAmount(handMatch[3]) : 0;
    const buttonSeat = tableMatch ? Number(tableMatch[2]) : null;
    const seats = seatMatches.map(match => Number(match[1]));
    const heroPosition = derivePosition(seats, buttonSeat, heroSeat, smallBlindSeat, bigBlindSeat);
    const preflopActions = extractPreflopActions(lines);
    const eligibility = classifyEligibility(heroPosition, preflopActions);

    if (!heroCards.length) return [];

    return [{
      handId: handMatch?.[1] ?? 'unknown',
      startedAt: handMatch?.[5] ?? '',
      smallBlind,
      bigBlind,
      ante: handMatch?.[4] ? parseAmount(handMatch[4]) : 0,
      tableSize: tableMatch ? Number(tableMatch[1]) : seats.length,
      buttonSeat,
      heroSeat,
      heroStack,
      heroStackBb: heroStack !== null && bigBlind > 0 ? heroStack / bigBlind : null,
      heroPosition,
      heroCards,
      heroHand: normalizeHoleCards(heroCards),
      preflopActions,
      ...eligibility,
    }];
  });
}
```

- [ ] **Step 4: Run the parser tests to verify they pass**

Run:

```bash
npm test -- src/utils/coinpokerParser.test.ts
```

Expected: PASS.

---

### Task 2: CoinPoker vs GTO Comparison Utility

**Files:**
- Create: `src/utils/coinpokerCompare.test.ts`
- Create: `src/utils/coinpokerCompare.ts`

- [ ] **Step 1: Write the failing comparison tests**

Create `src/utils/coinpokerCompare.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { compareCoinPokerRfi, summarizeCoinPokerComparison } from './coinpokerCompare';
import type { CoinPokerHand } from './coinpokerParser';
import type { StackData } from '../types';

function hand(overrides: Partial<CoinPokerHand>): CoinPokerHand {
  return {
    handId: '1',
    startedAt: '',
    smallBlind: 50,
    bigBlind: 100,
    ante: 13,
    tableSize: 6,
    buttonSeat: 6,
    heroSeat: 6,
    heroStack: 5000,
    heroStackBb: 50,
    heroPosition: 'BTN',
    heroCards: ['Ah', 'Ad'],
    heroHand: 'AA',
    preflopActions: [],
    heroFirstAction: 'raises',
    rfiEligible: true,
    exclusionReason: null,
    ...overrides,
  };
}

const stackData: StackData = {
  'BTN RFI': { raise: ['AA', 'AKs'] },
  'HJ RFI': { raise: ['TT'] },
  'CO RFI': { raise: ['KQo'] },
  'UTG RFI': { raise: ['QQ'] },
};

describe('compareCoinPokerRfi', () => {
  it('classifies matching opens, missed opens, extra opens, and fold matches', () => {
    const result = compareCoinPokerRfi([
      hand({ handId: 'open-match', heroHand: 'AA', heroFirstAction: 'raises' }),
      hand({ handId: 'missed', heroHand: 'AKs', heroFirstAction: 'folds' }),
      hand({ handId: 'extra', heroHand: '72o', heroFirstAction: 'raises' }),
      hand({ handId: 'fold-match', heroHand: '83o', heroFirstAction: 'folds' }),
    ], stackData);

    expect(result.map(item => item.status)).toEqual([
      'match-open',
      'missed-open',
      'extra-open',
      'match-fold',
    ]);
  });

  it('preserves parser exclusions and unsupported chart exclusions', () => {
    const result = compareCoinPokerRfi([
      hand({ handId: 'prior', rfiEligible: false, exclusionReason: 'prior-voluntary-action' }),
      hand({ handId: 'lj', heroPosition: 'LJ', heroHand: 'AA' }),
    ], stackData);

    expect(result[0]).toMatchObject({ status: 'excluded', exclusionReason: 'prior-voluntary-action' });
    expect(result[1]).toMatchObject({ status: 'excluded', exclusionReason: 'chart-not-found' });
  });
});

describe('summarizeCoinPokerComparison', () => {
  it('counts parsed, comparable, status buckets, and exclusions', () => {
    const items = compareCoinPokerRfi([
      hand({ handId: 'open-match', heroHand: 'AA', heroFirstAction: 'raises' }),
      hand({ handId: 'missed', heroHand: 'AKs', heroFirstAction: 'folds' }),
      hand({ handId: 'extra', heroHand: '72o', heroFirstAction: 'ALLIN' }),
      hand({ handId: 'excluded', rfiEligible: false, exclusionReason: 'prior-voluntary-action' }),
    ], stackData);

    expect(summarizeCoinPokerComparison(items)).toEqual({
      parsedHands: 4,
      comparableHands: 3,
      matches: 1,
      missedOpens: 1,
      extraOpens: 1,
      excluded: 1,
    });
  });
});
```

- [ ] **Step 2: Run the comparison tests to verify they fail**

Run:

```bash
npm test -- src/utils/coinpokerCompare.test.ts
```

Expected: FAIL because `./coinpokerCompare` does not exist.

- [ ] **Step 3: Implement the comparison utility**

Create `src/utils/coinpokerCompare.ts`:

```ts
import { buildHandAction, forEachHand } from './hand';
import type { CoinPokerHand } from './coinpokerParser';
import type { ColorDef, StackData } from '../types';

export type CoinPokerCompareStatus =
  | 'match-open'
  | 'match-fold'
  | 'missed-open'
  | 'extra-open'
  | 'excluded';

export interface CoinPokerComparisonItem {
  hand: CoinPokerHand;
  chartName: string | null;
  gtoAction: 'open' | 'fold' | 'unknown';
  heroDecision: 'open' | 'fold' | 'passive' | 'unknown';
  status: CoinPokerCompareStatus;
  exclusionReason: string | null;
}

export interface CoinPokerSummary {
  parsedHands: number;
  comparableHands: number;
  matches: number;
  missedOpens: number;
  extraOpens: number;
  excluded: number;
}

export const COINPOKER_COMPARE_COLORS: Record<string, ColorDef> = {
  'match-open': { bg: '#16a34a', text: '#ffffff', label: 'OK' },
  'match-fold': { bg: '#374151', text: '#cbd5e1', label: 'F' },
  'missed-open': { bg: '#eab308', text: '#111827', label: 'MISS' },
  'extra-open': { bg: '#ef4444', text: '#ffffff', label: 'OVER' },
  excluded: { bg: '#1f2937', text: '#64748b', label: 'EX' },
};

const AGGRESSIVE_ACTIONS = new Set(['raises', 'ALLIN']);

function heroDecision(action: string | null): CoinPokerComparisonItem['heroDecision'] {
  if (!action) return 'unknown';
  if (AGGRESSIVE_ACTIONS.has(action)) return 'open';
  if (action === 'folds') return 'fold';
  return 'passive';
}

function hasOpenAction(chartData: StackData[string], hand: string): boolean {
  const actionMap = buildHandAction(chartData);
  const action = actionMap[hand];
  return Boolean(action && action !== 'fold');
}

export function compareCoinPokerRfi(
  hands: CoinPokerHand[],
  stackData: StackData,
): CoinPokerComparisonItem[] {
  return hands.map(hand => {
    const chartName = hand.heroPosition ? `${hand.heroPosition} RFI` : null;
    if (!hand.rfiEligible) {
      return {
        hand,
        chartName,
        gtoAction: 'unknown',
        heroDecision: heroDecision(hand.heroFirstAction),
        status: 'excluded',
        exclusionReason: hand.exclusionReason ?? 'not-rfi-eligible',
      };
    }
    if (!hand.heroHand || !chartName || !stackData[chartName]) {
      return {
        hand,
        chartName,
        gtoAction: 'unknown',
        heroDecision: heroDecision(hand.heroFirstAction),
        status: 'excluded',
        exclusionReason: 'chart-not-found',
      };
    }

    const gtoAction = hasOpenAction(stackData[chartName], hand.heroHand) ? 'open' : 'fold';
    const decision = heroDecision(hand.heroFirstAction);
    let status: CoinPokerCompareStatus;
    if (gtoAction === 'open' && decision === 'open') status = 'match-open';
    else if (gtoAction === 'open') status = 'missed-open';
    else if (decision === 'open') status = 'extra-open';
    else status = 'match-fold';

    return {
      hand,
      chartName,
      gtoAction,
      heroDecision: decision,
      status,
      exclusionReason: null,
    };
  });
}

export function summarizeCoinPokerComparison(items: CoinPokerComparisonItem[]): CoinPokerSummary {
  return items.reduce<CoinPokerSummary>((summary, item) => {
    summary.parsedHands += 1;
    if (item.status === 'excluded') {
      summary.excluded += 1;
      return summary;
    }
    summary.comparableHands += 1;
    if (item.status === 'match-open') summary.matches += 1;
    if (item.status === 'missed-open') summary.missedOpens += 1;
    if (item.status === 'extra-open') summary.extraOpens += 1;
    return summary;
  }, {
    parsedHands: 0,
    comparableHands: 0,
    matches: 0,
    missedOpens: 0,
    extraOpens: 0,
    excluded: 0,
  });
}

export function buildCoinPokerGrid(items: CoinPokerComparisonItem[]): Record<string, string> {
  const priority: Record<CoinPokerCompareStatus, number> = {
    'extra-open': 5,
    'missed-open': 4,
    'match-open': 3,
    'match-fold': 2,
    excluded: 1,
  };
  const result: Record<string, string> = {};
  const seenPriority: Record<string, number> = {};

  forEachHand(hand => {
    result[hand] = 'excluded';
    seenPriority[hand] = 0;
  });

  for (const item of items) {
    const hand = item.hand.heroHand;
    if (!hand) continue;
    const weight = priority[item.status];
    if (weight > (seenPriority[hand] ?? 0)) {
      result[hand] = item.status;
      seenPriority[hand] = weight;
    }
  }

  return result;
}
```

- [ ] **Step 4: Run the comparison tests to verify they pass**

Run:

```bash
npm test -- src/utils/coinpokerCompare.test.ts
```

Expected: PASS.

---

### Task 3: CoinPoker Analysis Page

**Files:**
- Create: `src/pages/CoinPokerAnalysisPage.tsx`

- [ ] **Step 1: Create the page component**

Create `src/pages/CoinPokerAnalysisPage.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { RangeGrid } from '../components/RangeGrid';
import {
  COINPOKER_COMPARE_COLORS,
  buildCoinPokerGrid,
  compareCoinPokerRfi,
  summarizeCoinPokerComparison,
  type CoinPokerComparisonItem,
} from '../utils/coinpokerCompare';
import { parseCoinPokerHands } from '../utils/coinpokerParser';
import type { StackData, StackSize } from '../types';

interface Props {
  stack: StackSize;
  stackData: StackData;
}

function statusLabel(item: CoinPokerComparisonItem): string {
  if (item.status === 'match-open') return '일치: 오픈';
  if (item.status === 'match-fold') return '일치: 폴드';
  if (item.status === 'missed-open') return '누락 오픈';
  if (item.status === 'extra-open') return '과잉 오픈';
  return item.exclusionReason ?? '제외';
}

export function CoinPokerAnalysisPage({ stack, stackData }: Props) {
  const [rawText, setRawText] = useState('');

  const parsedHands = useMemo(() => parseCoinPokerHands(rawText), [rawText]);
  const comparison = useMemo(
    () => compareCoinPokerRfi(parsedHands, stackData),
    [parsedHands, stackData],
  );
  const summary = useMemo(() => summarizeCoinPokerComparison(comparison), [comparison]);
  const grid = useMemo(() => buildCoinPokerGrid(comparison), [comparison]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setRawText(await file.text());
  };

  const summaryCards = [
    ['Hero 핸드', summary.parsedHands],
    ['비교 가능', summary.comparableHands],
    ['일치 오픈', summary.matches],
    ['누락 오픈', summary.missedOpens],
    ['과잉 오픈', summary.extraOpens],
    ['제외', summary.excluded],
  ] as const;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-4xl grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-300 font-medium">
            CoinPoker txt
          </label>
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={event => handleFile(event.target.files?.[0] ?? null)}
            className="text-sm text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-2 file:text-gray-100 hover:file:bg-gray-600"
          />
          <button
            type="button"
            onClick={() => setRawText('')}
            className="px-3 py-2 rounded bg-gray-800 text-sm text-gray-300 hover:bg-gray-700"
          >
            Clear
          </button>
          <span className="ml-auto text-xs text-gray-500">{stack} RFI 기준</span>
        </div>

        <textarea
          value={rawText}
          onChange={event => setRawText(event.target.value)}
          placeholder="CoinPoker hand history txt 내용을 붙여넣으세요."
          className="min-h-36 w-full resize-y rounded border border-gray-700 bg-gray-900 p-3 text-sm text-gray-200 outline-none focus:border-indigo-500"
        />
      </div>

      {rawText.trim() && parsedHands.length === 0 && (
        <div className="text-sm text-amber-300">
          `Dealt to Hero [...]`가 있는 CoinPoker 핸드를 찾지 못했습니다.
        </div>
      )}

      {!rawText.trim() ? (
        <div className="py-12 text-sm text-gray-500">
          txt 파일을 선택하거나 로그를 붙여넣으면 분석이 시작됩니다.
        </div>
      ) : (
        <>
          <div className="grid w-full max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {summaryCards.map(([label, value]) => (
              <div key={label} className="rounded bg-gray-800 px-3 py-2 text-center">
                <div className="text-xs text-gray-400">{label}</div>
                <div className="text-lg font-bold text-white">{value}</div>
              </div>
            ))}
          </div>

          <RangeGrid handAction={grid} colorMap={COINPOKER_COMPARE_COLORS} />

          <div className="w-full max-w-4xl overflow-x-auto rounded border border-gray-800">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-900 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Hand</th>
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Cards</th>
                  <th className="px-3 py-2">Hero</th>
                  <th className="px-3 py-2">GTO</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Stack</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {comparison.slice(0, 250).map(item => (
                  <tr key={item.hand.handId} className="text-gray-300">
                    <td className="px-3 py-2 font-mono text-xs">{item.hand.handId}</td>
                    <td className="px-3 py-2">{item.hand.heroPosition}</td>
                    <td className="px-3 py-2 font-semibold text-white">{item.hand.heroHand ?? '-'}</td>
                    <td className="px-3 py-2">{item.hand.heroFirstAction ?? '-'}</td>
                    <td className="px-3 py-2">{item.gtoAction}</td>
                    <td className="px-3 py-2">{statusLabel(item)}</td>
                    <td className="px-3 py-2">
                      {item.hand.heroStackBb === null ? '-' : `${item.hand.heroStackBb.toFixed(1)}BB`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript through the build after page creation**

Run:

```bash
npm run build
```

Expected: PASS because the TypeScript project checks the new `src/pages/CoinPokerAnalysisPage.tsx` file even before it is imported by `App.tsx`.

---

### Task 4: Wire the New Tab into the App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update `App.tsx` view type, tab list, import, stack tab guard, and render branch**

Modify `src/App.tsx`:

```tsx
import { CoinPokerAnalysisPage } from './pages/CoinPokerAnalysisPage';
```

Change the view type:

```ts
type View = 'open-range' | 'sb-open' | 'facing' | 'quiz' | 'quiz-stats' | 'coinpoker';
```

Add the tab:

```ts
{ value: 'coinpoker', label: 'CoinPoker 분석' },
```

Keep stack tabs visible for the new page by changing the guard:

```tsx
{view !== 'quiz' && view !== 'quiz-stats' && (
```

Render the page:

```tsx
{view === 'coinpoker' && <CoinPokerAnalysisPage stack={stack} stackData={stackData} />}
```

- [ ] **Step 2: Run a production build**

Run:

```bash
npm run build
```

Expected: PASS, with the existing Vite chunk-size warning acceptable if it appears.

---

### Task 5: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS. If lint reports pre-existing warnings in unrelated files, record them and only fix issues introduced by this feature.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS, with the existing Vite chunk-size warning acceptable if it appears.

- [ ] **Step 4: Review git diff**

Run:

```bash
git diff -- src/utils/coinpokerParser.ts src/utils/coinpokerParser.test.ts src/utils/coinpokerCompare.ts src/utils/coinpokerCompare.test.ts src/pages/CoinPokerAnalysisPage.tsx src/App.tsx
```

Expected: diff contains only parser, comparison, page, and app wiring changes.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add src/utils/coinpokerParser.ts src/utils/coinpokerParser.test.ts src/utils/coinpokerCompare.ts src/utils/coinpokerCompare.test.ts src/pages/CoinPokerAnalysisPage.tsx src/App.tsx
git commit -m "feat: add coinpoker preflop comparison"
```

Expected: commit succeeds.
