# 뱅크롤 관리 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CoinPoker 세션 요약 JSON(캐시/토너먼트)을 import 해 뱅크롤 추이·태그별 손익을 보여주는 새 `뱅크롤` 탭을 추가한다.

**Architecture:** 순수 함수 유틸(`bankroll.ts`)이 두 JSON 구조를 통합 `BankrollSession[]`로 정규화하고 추이·태그 성과를 계산한다. 커스텀 SVG 컴포넌트 2개가 라인/막대 차트를 그리고, `BankrollPage`가 메모리 state로 import·환율·요약을 묶는다. App.tsx에 탭 1개 추가.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind v4, Vitest(happy-dom), 차트 라이브러리 없음(커스텀 SVG).

---

## File Structure

- Create `src/utils/bankroll.ts` — 타입 + 정규화/계산 순수 함수 (파싱, profit, 태깅, dedupe, trend, tag 성과, 요약, 포맷).
- Create `src/utils/bankroll.test.ts` — 위 함수 단위 테스트 (Vitest).
- Create `src/utils/fxRate.ts` — Naver USD/KRW 환율 fetch.
- Create `src/components/BankrollTrendChart.tsx` — 커스텀 SVG 누적 추이 라인 차트.
- Create `src/components/TagPerformanceChart.tsx` — 커스텀 SVG 태그별 손익 막대 차트.
- Create `src/pages/BankrollPage.tsx` — 페이지(import 입력, 칩, 카드, 차트, 테이블).
- Modify `src/App.tsx` — View `'bankroll'` 추가, 네비 항목, StackTabs 제외, 렌더.

---

## Task 1: 데이터 모델 + 파싱/profit/태깅 (bankroll.ts core)

**Files:**
- Create: `src/utils/bankroll.ts`
- Test: `src/utils/bankroll.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `src/utils/bankroll.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  normalizeCashSessions,
  normalizeTournamentSessions,
  type RawCash,
  type RawTournament,
} from './bankroll';

const cash: RawCash[] = [
  { game_type: "Texas Hold'em", minigames_type_id: 1, internal_ref: 'c1', start_datetime: '2026-06-06 11:07:33', buy_in: '0.8', win_loss: '0.670000', total_no_hands: 27 },
  { game_type: 'Omaha', minigames_type_id: 2, internal_ref: 'c2', start_datetime: '2026-06-09 05:35:48', buy_in: '0.8', win_loss: '-0.020000', total_no_hands: 1 },
  { game_type: 'Six cards omaha', minigames_type_id: 20, internal_ref: 'c3', start_datetime: '2026-06-06 08:58:14', buy_in: '1.6', win_loss: '2.160000', total_no_hands: 8 },
];

const tourneys: RawTournament[] = [
  { tournament_id: 't1', tournament_name: '₮1.10 Early Hours Classic', minigames_type_id: 1, start_datetime: '2026-06-07 06:05:00', internal_ref: 'r1', buy_in: '1.10', win_loss: '42.64', rank: 1, total_no_of_entries: 1 },
  { tournament_id: 't2', tournament_name: 'Step', minigames_type_id: 1, start_datetime: '2026-06-11 16:05:00', internal_ref: 'r2', buy_in: '1.20', win_loss: '0.00', rank: 18, total_no_of_entries: 3 },
];

describe('normalizeCashSessions', () => {
  it('uses win_loss as net profit and maps game-type tags', () => {
    const out = normalizeCashSessions(cash);
    expect(out).toHaveLength(3);
    const nl = out.find(s => s.id === 'c1')!;
    expect(nl.profit).toBeCloseTo(0.67, 5);
    expect(nl.tags).toEqual(['CoinPoker', 'Cash History', 'NL']);
    expect(out.find(s => s.id === 'c2')!.tags).toContain('PLO4');
    expect(out.find(s => s.id === 'c3')!.tags).toContain('PLO6');
  });
});

describe('normalizeTournamentSessions', () => {
  it('computes net = win_loss - buy_in * entries and tags', () => {
    const out = normalizeTournamentSessions(tourneys);
    expect(out.find(s => s.id === 't1')!.profit).toBeCloseTo(41.54, 5);
    expect(out.find(s => s.id === 't2')!.profit).toBeCloseTo(-3.6, 5);
    expect(out.find(s => s.id === 't1')!.tags).toEqual(['CoinPoker', 'Tournament History']);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- bankroll`
Expected: FAIL ("does not provide an export named 'normalizeCashSessions'").

- [ ] **Step 3: 최소 구현** — `src/utils/bankroll.ts`

```ts
export type BankrollKind = 'cash' | 'tournament';

export interface RawCash {
  game_type: string;
  minigames_type_id: number;
  internal_ref: string;
  start_datetime: string;
  buy_in: string;
  win_loss: string;
  total_no_hands?: number;
}

export interface RawTournament {
  tournament_id: string;
  tournament_name: string;
  minigames_type_id: number;
  start_datetime: string;
  internal_ref: string;
  buy_in: string;
  win_loss: string;
  rank?: number;
  total_no_of_entries: number;
}

export interface BankrollSession {
  id: string;
  kind: BankrollKind;
  datetime: string;
  profit: number;
  winLoss: number;
  buyIn?: number;
  entries?: number;
  name?: string;
  rank?: number;
  tags: string[];
}

/** parseFloat that returns 0 for blank/NaN inputs. */
function num(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Cash game-type → tag. id first, game_type string fallback. */
export function cashGameTag(gameType: string, typeId: number): string | null {
  if (typeId === 1) return 'NL';
  if (typeId === 2) return 'PLO4';
  if (typeId === 20) return 'PLO6';
  const g = (gameType || '').toLowerCase();
  if (g.includes('hold')) return 'NL';
  if (g.includes('six')) return 'PLO6';
  if (g.includes('five')) return 'PLO5';
  if (g.includes('omaha')) return 'PLO4';
  return null;
}

export function normalizeCashSessions(rows: RawCash[]): BankrollSession[] {
  return rows.map((r) => {
    const tags = ['CoinPoker', 'Cash History'];
    const t = cashGameTag(r.game_type, r.minigames_type_id);
    if (t) tags.push(t);
    return {
      id: r.internal_ref,
      kind: 'cash' as const,
      datetime: r.start_datetime,
      profit: num(r.win_loss),
      winLoss: num(r.win_loss),
      name: r.game_type,
      tags,
    };
  });
}

export function normalizeTournamentSessions(rows: RawTournament[]): BankrollSession[] {
  return rows.map((r) => {
    const buyIn = num(r.buy_in);
    const entries = r.total_no_of_entries ?? 1;
    const winLoss = num(r.win_loss);
    return {
      id: r.tournament_id,
      kind: 'tournament' as const,
      datetime: r.start_datetime,
      profit: winLoss - buyIn * entries,
      winLoss,
      buyIn,
      entries,
      name: r.tournament_name,
      rank: r.rank,
      tags: ['CoinPoker', 'Tournament History'],
    };
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- bankroll`
Expected: PASS (2 passing).

- [ ] **Step 5: 커밋**

```bash
git add src/utils/bankroll.ts src/utils/bankroll.test.ts
git commit -m "feat: 뱅크롤 세션 정규화/태깅 유틸"
```

---

## Task 2: dedupe + 파일 타입 자동 판별 + import 통합

**Files:**
- Modify: `src/utils/bankroll.ts`
- Test: `src/utils/bankroll.test.ts`

- [ ] **Step 1: 실패 테스트 추가** — `bankroll.test.ts` 하단에 append

```ts
import { dedupeSessions, parseBankrollFile } from './bankroll';

describe('dedupeSessions', () => {
  it('keeps one per id, last wins', () => {
    const a = normalizeCashSessions(cash);
    const dup = normalizeCashSessions([{ ...cash[0], win_loss: '9.99' }]);
    const merged = dedupeSessions([...a, ...dup]);
    expect(merged).toHaveLength(3);
    expect(merged.find(s => s.id === 'c1')!.profit).toBeCloseTo(9.99, 5);
  });
});

describe('parseBankrollFile', () => {
  it('detects tournament by tournament_id key', () => {
    const out = parseBankrollFile(tourneys);
    expect(out[0].kind).toBe('tournament');
  });
  it('detects cash otherwise', () => {
    const out = parseBankrollFile(cash);
    expect(out[0].kind).toBe('cash');
  });
  it('returns [] for empty/non-array', () => {
    expect(parseBankrollFile([])).toEqual([]);
    expect(parseBankrollFile({} as unknown)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- bankroll`
Expected: FAIL ("does not provide an export named 'dedupeSessions'").

- [ ] **Step 3: 구현 추가** — `bankroll.ts` 끝에 append

```ts
/** Merge by id; later entries overwrite earlier ones. */
export function dedupeSessions(sessions: BankrollSession[]): BankrollSession[] {
  const byId = new Map<string, BankrollSession>();
  for (const s of sessions) byId.set(s.id, s);
  return [...byId.values()];
}

/** Auto-detect cash vs tournament from a parsed JSON array. */
export function parseBankrollFile(parsed: unknown): BankrollSession[] {
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  const first = parsed[0] as Record<string, unknown>;
  if (first && 'tournament_id' in first) {
    return normalizeTournamentSessions(parsed as RawTournament[]);
  }
  return normalizeCashSessions(parsed as RawCash[]);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- bankroll`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/utils/bankroll.ts src/utils/bankroll.test.ts
git commit -m "feat: 뱅크롤 dedupe + 파일 타입 자동 판별"
```

---

## Task 3: trend / tag 성과 / 요약 / 포맷 계산

**Files:**
- Modify: `src/utils/bankroll.ts`
- Test: `src/utils/bankroll.test.ts`

- [ ] **Step 1: 실패 테스트 추가** — append

```ts
import { computeTrend, computeTagPerformance, summarize, formatUsd } from './bankroll';

const all = [...normalizeCashSessions(cash), ...normalizeTournamentSessions(tourneys)];

describe('computeTrend', () => {
  it('sorts by datetime and accumulates profit from 0', () => {
    const pts = computeTrend(all);
    expect(pts).toHaveLength(5);
    expect(pts[0].datetime <= pts[pts.length - 1].datetime).toBe(true);
    const last = pts[pts.length - 1].value;
    const sum = all.reduce((a, s) => a + s.profit, 0);
    expect(last).toBeCloseTo(sum, 5);
  });
});

describe('computeTagPerformance', () => {
  it('aggregates profit/sessions per tag with CoinPoker first', () => {
    const rows = computeTagPerformance(all);
    expect(rows[0].tag).toBe('CoinPoker');
    const nl = rows.find(r => r.tag === 'NL')!;
    expect(nl.sessions).toBe(1);
    expect(nl.profit).toBeCloseTo(0.67, 5);
    const coin = rows.find(r => r.tag === 'CoinPoker')!;
    expect(coin.sessions).toBe(5);
  });
});

describe('summarize', () => {
  it('splits cash and tournament profit', () => {
    const s = summarize(all);
    expect(s.sessionCount).toBe(5);
    expect(s.cashProfit).toBeCloseTo(0.67 - 0.02 + 2.16, 5);
    expect(s.tournamentProfit).toBeCloseTo(41.54 - 3.6, 5);
    expect(s.totalProfit).toBeCloseTo(s.cashProfit + s.tournamentProfit, 5);
  });
});

describe('formatUsd', () => {
  it('formats with sign', () => {
    expect(formatUsd(12.85)).toBe('$12.85');
    expect(formatUsd(-0.72)).toBe('-$0.72');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- bankroll`
Expected: FAIL ("does not provide an export named 'computeTrend'").

- [ ] **Step 3: 구현 추가** — `bankroll.ts` 끝에 append

```ts
export interface TrendPoint { datetime: string; value: number; }
export interface TagRow { tag: string; sessions: number; profit: number; }
export interface Summary {
  totalProfit: number;
  cashProfit: number;
  tournamentProfit: number;
  sessionCount: number;
}

export function computeTrend(sessions: BankrollSession[]): TrendPoint[] {
  const sorted = [...sessions].sort((a, b) => a.datetime.localeCompare(b.datetime));
  let acc = 0;
  return sorted.map((s) => {
    acc += s.profit;
    return { datetime: s.datetime, value: acc };
  });
}

const TAG_PRIORITY = ['CoinPoker', 'Tournament History', 'Cash History'];

export function computeTagPerformance(sessions: BankrollSession[]): TagRow[] {
  const map = new Map<string, TagRow>();
  for (const s of sessions) {
    for (const tag of s.tags) {
      const row = map.get(tag) ?? { tag, sessions: 0, profit: 0 };
      row.sessions += 1;
      row.profit += s.profit;
      map.set(tag, row);
    }
  }
  return [...map.values()].sort((a, b) => {
    const pa = TAG_PRIORITY.indexOf(a.tag);
    const pb = TAG_PRIORITY.indexOf(b.tag);
    if (pa !== -1 || pb !== -1) {
      return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    }
    return b.profit - a.profit;
  });
}

export function summarize(sessions: BankrollSession[]): Summary {
  let cashProfit = 0;
  let tournamentProfit = 0;
  for (const s of sessions) {
    if (s.kind === 'cash') cashProfit += s.profit;
    else tournamentProfit += s.profit;
  }
  return {
    cashProfit,
    tournamentProfit,
    totalProfit: cashProfit + tournamentProfit,
    sessionCount: sessions.length,
  };
}

export function formatUsd(v: number): string {
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- bankroll`
Expected: PASS (all suites).

- [ ] **Step 5: 커밋**

```bash
git add src/utils/bankroll.ts src/utils/bankroll.test.ts
git commit -m "feat: 뱅크롤 추이/태그 성과/요약/포맷 계산"
```

---

## Task 4: 환율 유틸 (fxRate.ts)

**Files:**
- Create: `src/utils/fxRate.ts`
- Test: `src/utils/fxRate.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `src/utils/fxRate.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchUsdKrwRate } from './fxRate';

afterEach(() => vi.restoreAllMocks());

const body = {
  country: [
    { value: '1', currencyUnit: '달러' },
    { value: '1,521.20', currencyUnit: '원' },
  ],
};

describe('fetchUsdKrwRate', () => {
  it('parses country[1].value', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })));
    expect(await fetchUsdKrwRate()).toBeCloseTo(1521.2, 2);
  });
  it('returns null on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await fetchUsdKrwRate()).toBeNull();
  });
  it('returns null on bad shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    expect(await fetchUsdKrwRate()).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- fxRate`
Expected: FAIL ("does not provide an export named 'fetchUsdKrwRate'").

- [ ] **Step 3: 구현** — `src/utils/fxRate.ts`

```ts
const FX_URL =
  'https://m.search.naver.com/p/csearch/content/qapirender.nhn' +
  '?key=calculator&pkid=141&q=%ED%99%98%EC%9C%A8&where=m' +
  '&u1=keb&u6=standardUnit&u7=0&u3=USD&u4=KRW&u8=down&u2=1';

interface FxResponse {
  country?: { value?: string; currencyUnit?: string }[];
}

/** USD→KRW rate from Naver calculator API. null on any failure. */
export async function fetchUsdKrwRate(): Promise<number | null> {
  try {
    const res = await fetch(FX_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as FxResponse;
    const raw = data.country?.[1]?.value;
    if (!raw) return null;
    const n = parseFloat(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- fxRate`
Expected: PASS (3 passing).

- [ ] **Step 5: 커밋**

```bash
git add src/utils/fxRate.ts src/utils/fxRate.test.ts
git commit -m "feat: Naver USD/KRW 환율 fetch 유틸"
```

---

## Task 5: 추이 라인 차트 (BankrollTrendChart.tsx)

**Files:**
- Create: `src/components/BankrollTrendChart.tsx`

참고: 기존 컴포넌트는 Tailwind 클래스 + 인라인 SVG를 쓴다(`HexagonRadar.tsx` 패턴). 외부 라이브러리 금지.

- [ ] **Step 1: 구현** — `src/components/BankrollTrendChart.tsx`

```tsx
import { useState } from 'react';
import type { TrendPoint } from '../utils/bankroll';
import { formatUsd } from '../utils/bankroll';

interface Props { points: TrendPoint[]; }

const W = 720;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

export function BankrollTrendChart({ points }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) {
    return <div className="text-gray-500 text-sm py-8 text-center">데이터 없음</div>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const values = points.map(p => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - min) / span) * innerH;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const zeroY = y(0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* zero baseline */}
        <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
          stroke="#374151" strokeDasharray="4 4" />
        <text x={PAD.left - 6} y={zeroY + 4} textAnchor="end" className="fill-gray-500 text-[10px]">0</text>
        {/* line */}
        <path d={path} fill="none" stroke="#6366f1" strokeWidth={2} />
        {/* markers */}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 4 : 2.5}
            fill="#fff" stroke="#6366f1" strokeWidth={1.5}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
        {/* x labels: first / mid / last */}
        {[0, Math.floor(points.length / 2), points.length - 1]
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-gray-500 text-[10px]">
              {points[i].datetime.slice(0, 10)}
            </text>
          ))}
      </svg>
      {hover !== null && (
        <div className="absolute top-2 left-12 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs pointer-events-none">
          <div className="text-gray-300">{points[hover].datetime.slice(0, 10)}</div>
          <div className="text-indigo-300">bankroll : {formatUsd(points[hover].value)}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 확인**

Run: `npx tsc -b`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/components/BankrollTrendChart.tsx
git commit -m "feat: 뱅크롤 추이 SVG 라인 차트"
```

---

## Task 6: 태그 손익 막대 차트 (TagPerformanceChart.tsx)

**Files:**
- Create: `src/components/TagPerformanceChart.tsx`

- [ ] **Step 1: 구현** — `src/components/TagPerformanceChart.tsx`

```tsx
import type { TagRow } from '../utils/bankroll';
import { formatUsd } from '../utils/bankroll';

interface Props { rows: TagRow[]; }

const W = 720;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 48, left: 44 };

export function TagPerformanceChart({ rows }: Props) {
  if (rows.length === 0) {
    return <div className="text-gray-500 text-sm py-8 text-center">데이터 없음</div>;
  }
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const profits = rows.map(r => r.profit);
  const min = Math.min(0, ...profits);
  const max = Math.max(0, ...profits);
  const span = max - min || 1;
  const zeroY = PAD.top + innerH - ((0 - min) / span) * innerH;
  const slot = innerW / rows.length;
  const barW = Math.min(48, slot * 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="#374151" />
      {rows.map((r, i) => {
        const cx = PAD.left + slot * i + slot / 2;
        const v = PAD.top + innerH - ((r.profit - min) / span) * innerH;
        const top = Math.min(v, zeroY);
        const h = Math.abs(v - zeroY) || 1;
        return (
          <g key={r.tag}>
            <rect x={cx - barW / 2} y={top} width={barW} height={h}
              fill={r.profit >= 0 ? '#16a34a' : '#dc2626'} rx={2} />
            <text x={cx} y={H - 28} textAnchor="middle" className="fill-gray-400 text-[10px]">
              {r.tag}
            </text>
            <text x={cx} y={H - 14} textAnchor="middle" className="fill-gray-500 text-[9px]">
              {formatUsd(r.profit)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: 타입체크 확인**

Run: `npx tsc -b`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/components/TagPerformanceChart.tsx
git commit -m "feat: 태그별 손익 SVG 막대 차트"
```

---

## Task 7: 뱅크롤 페이지 (BankrollPage.tsx)

**Files:**
- Create: `src/pages/BankrollPage.tsx`

- [ ] **Step 1: 구현** — `src/pages/BankrollPage.tsx`

```tsx
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  parseBankrollFile,
  dedupeSessions,
  computeTrend,
  computeTagPerformance,
  summarize,
  formatUsd,
  type BankrollSession,
} from '../utils/bankroll';
import { fetchUsdKrwRate } from '../utils/fxRate';
import { BankrollTrendChart } from '../components/BankrollTrendChart';
import { TagPerformanceChart } from '../components/TagPerformanceChart';

export function BankrollPage() {
  const [sessions, setSessions] = useState<BankrollSession[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchUsdKrwRate().then(setRate).catch(() => {});
  }, []);

  const trend = useMemo(() => computeTrend(sessions), [sessions]);
  const tags = useMemo(() => computeTagPerformance(sessions), [sessions]);
  const sum = useMemo(() => summarize(sessions), [sessions]);

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setFileError(null);
    const added: BankrollSession[] = [];
    const errors: string[] = [];
    for (const f of files) {
      try {
        const parsed = JSON.parse(await f.text());
        const got = parseBankrollFile(parsed);
        if (got.length === 0) errors.push(`${f.name}: 인식 가능한 항목 없음`);
        added.push(...got);
      } catch {
        errors.push(`${f.name}: JSON 파싱 실패`);
      }
    }
    setSessions((prev) => dedupeSessions([...prev, ...added]));
    if (errors.length) setFileError(errors.join(' / '));
    if (inputRef.current) inputRef.current.value = '';
  }

  const hasData = sessions.length > 0;

  return (
    <div className="space-y-4">
      {/* import + chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
        >
          JSON 추가
        </button>
        <input ref={inputRef} type="file" accept=".json,application/json" multiple
          onChange={onFiles} className="hidden" />
        {hasData && (
          <>
            <span className="px-3 py-1.5 text-xs bg-gray-800 text-gray-200 rounded-lg border border-gray-700">
              Bankroll: {formatUsd(sum.totalProfit)}
            </span>
            {rate !== null && (
              <span className="px-3 py-1.5 text-xs bg-gray-800 text-gray-200 rounded-lg border border-gray-700">
                USD/KRW: {rate.toLocaleString('en-US', { maximumFractionDigits: 1 })}
              </span>
            )}
            <span className="px-3 py-1.5 text-xs bg-gray-800 text-gray-200 rounded-lg border border-gray-700">
              Sessions: {sum.sessionCount}
            </span>
          </>
        )}
      </div>

      {fileError && <p className="text-sm text-red-400">{fileError}</p>}

      {!hasData && (
        <div className="text-center text-gray-500 text-sm py-16 border border-dashed border-gray-700 rounded-xl">
          캐시/토너먼트 history JSON 파일을 추가하세요. (여러 파일 선택 가능)
        </div>
      )}

      {hasData && (
        <>
          <h2 className="text-lg font-bold text-white">Analytics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card label="TOTAL PROFIT" value={formatUsd(sum.totalProfit)} />
            <Card label="CASH" value={formatUsd(sum.cashProfit)} />
            <Card label="TOURNAMENTS" value={formatUsd(sum.tournamentProfit)} />
          </div>

          <Section title="Trend line" right={`${trend.length} points`}>
            <BankrollTrendChart points={trend} />
          </Section>

          <Section title="Tag performance" right={`${tags.length} tags`}>
            <TagPerformanceChart rows={tags} />
            <div className="mt-3 divide-y divide-gray-800">
              {tags.map((t) => (
                <div key={t.tag} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-semibold text-white">{t.tag}</span>
                  <span className="text-gray-400">{t.sessions} sessions</span>
                  <span className={t.profit >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {formatUsd(t.profit)}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-[11px] font-semibold text-gray-500 tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {right && <span className="text-xs text-gray-500">{right}</span>}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 확인**

Run: `npx tsc -b`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/pages/BankrollPage.tsx
git commit -m "feat: 뱅크롤 페이지 (import/칩/카드/차트/테이블)"
```

---

## Task 8: App.tsx 통합 (탭 추가)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: import 추가** — 다른 page import 옆 (`CoinPokerAnalysisPage` import 아래)

```tsx
import { BankrollPage } from './pages/BankrollPage';
```

- [ ] **Step 2: View 타입에 'bankroll' 추가** — 기존 줄 교체

```tsx
type View = 'open-range' | 'sb-open' | 'facing' | 'quiz' | 'quiz-stats' | 'coinpoker' | 'bankroll';
```

- [ ] **Step 3: VIEWS 배열에 항목 추가** — `coinpoker` 항목 아래

```tsx
  { value: 'coinpoker', label: 'CoinPoker 분석' },
  { value: 'bankroll', label: '뱅크롤' },
```

- [ ] **Step 4: StackTabs 제외 조건 + 컨테이너 폭에 bankroll 포함** — 두 줄 교체

컨테이너 폭 (coinpoker처럼 넓게):
```tsx
    <div className={`min-h-screen ${view === 'coinpoker' || view === 'bankroll' ? 'max-w-7xl' : 'max-w-4xl'} mx-auto`}>
```

StackTabs 숨김 조건:
```tsx
        {view !== 'quiz' && view !== 'quiz-stats' && view !== 'coinpoker' && view !== 'bankroll' && (
```

- [ ] **Step 5: 렌더 추가** — coinpoker 렌더 줄 아래

```tsx
        {view === 'coinpoker' && <CoinPokerAnalysisPage fallbackStack={stack} data={data} />}
        {view === 'bankroll' && <BankrollPage />}
```

- [ ] **Step 6: 타입체크 + 빌드 확인**

Run: `npx tsc -b && npm run build`
Expected: 빌드 성공.

- [ ] **Step 7: 커밋**

```bash
git add src/App.tsx
git commit -m "feat: 뱅크롤 탭을 네비게이션에 추가"
```

---

## Task 9: 전체 검증 (실데이터 수치 확인)

**Files:**
- Test: `src/utils/bankroll.test.ts`

- [ ] **Step 1: 실데이터 회귀 테스트 추가** — `bankroll.test.ts` 끝에 append. 제공된 샘플의 핵심 수치를 못박는다.

```ts
describe('reference dataset invariants', () => {
  // 캐시 10세션 (제공된 cash_history 샘플의 win_loss/타입)
  const refCash: RawCash[] = [
    { game_type: 'Omaha', minigames_type_id: 2, internal_ref: 'rc1', start_datetime: '2026-06-09 05:35:48', buy_in: '0.8', win_loss: '-0.02' },
    { game_type: "Texas Hold'em", minigames_type_id: 1, internal_ref: 'rc2', start_datetime: '2026-06-09 05:25:19', buy_in: '1.2', win_loss: '0.00' },
    { game_type: 'Omaha', minigames_type_id: 2, internal_ref: 'rc3', start_datetime: '2026-06-07 11:41:15', buy_in: '1.2', win_loss: '0.00' },
    { game_type: "Texas Hold'em", minigames_type_id: 1, internal_ref: 'rc4', start_datetime: '2026-06-06 11:07:33', buy_in: '0.8', win_loss: '0.67' },
    { game_type: 'Six cards omaha', minigames_type_id: 20, internal_ref: 'rc5', start_datetime: '2026-06-06 08:58:14', buy_in: '1.6', win_loss: '2.16' },
    { game_type: 'Omaha', minigames_type_id: 2, internal_ref: 'rc6', start_datetime: '2026-06-06 08:56:00', buy_in: '0.8', win_loss: '-0.80' },
    { game_type: "Texas Hold'em", minigames_type_id: 1, internal_ref: 'rc7', start_datetime: '2026-06-06 02:29:41', buy_in: '0.8', win_loss: '-0.10' },
    { game_type: "Texas Hold'em", minigames_type_id: 1, internal_ref: 'rc8', start_datetime: '2026-06-05 06:17:11', buy_in: '0.8', win_loss: '-0.10' },
    { game_type: "Texas Hold'em", minigames_type_id: 1, internal_ref: 'rc9', start_datetime: '2026-06-05 03:13:35', buy_in: '0.8', win_loss: '-0.80' },
    { game_type: "Texas Hold'em", minigames_type_id: 1, internal_ref: 'rc10', start_datetime: '2026-06-05 00:00:19', buy_in: '1.6', win_loss: '-0.39' },
  ];

  it('cash totals + game-type tag breakdown match the screenshot', () => {
    const s = normalizeCashSessions(refCash);
    expect(summarize(s).cashProfit).toBeCloseTo(0.62, 2);
    const rows = computeTagPerformance(s);
    const byTag = (t: string) => rows.find(r => r.tag === t)!;
    expect(byTag('NL').sessions).toBe(6);
    expect(byTag('NL').profit).toBeCloseTo(-0.72, 2);
    expect(byTag('PLO4').sessions).toBe(3);
    expect(byTag('PLO4').profit).toBeCloseTo(-0.82, 2);
    expect(byTag('PLO6').sessions).toBe(1);
    expect(byTag('PLO6').profit).toBeCloseTo(2.16, 2);
    expect(byTag('Cash History').sessions).toBe(10);
  });

  it('tournament net = win_loss - buy_in * entries', () => {
    const t = normalizeTournamentSessions([
      { tournament_id: 'big', tournament_name: 'x', minigames_type_id: 1, start_datetime: '2026-06-07 06:05:00', internal_ref: 'i', buy_in: '1.10', win_loss: '42.64', total_no_of_entries: 1 },
      { tournament_id: 'reb', tournament_name: 'y', minigames_type_id: 1, start_datetime: '2026-06-08 06:05:00', internal_ref: 'j', buy_in: '2.20', win_loss: '5.79', total_no_of_entries: 2 },
    ]);
    expect(t.find(s => s.id === 'big')!.profit).toBeCloseTo(41.54, 2);
    expect(t.find(s => s.id === 'reb')!.profit).toBeCloseTo(1.39, 2);
  });
});
```

- [ ] **Step 2: 전체 테스트 + 빌드**

Run: `npm test && npx tsc -b && npm run build`
Expected: 모든 테스트 PASS, 빌드 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/utils/bankroll.test.ts
git commit -m "test: 레퍼런스 데이터셋 수치 회귀 테스트"
```

---

## Self-Review 결과

- **Spec 커버리지:** 두 JSON import(T2,T7) / 추이(T3,T5) / 태그별 손익(T3,T6) / 캐시 게임타입 태깅 NL·PLO4·PLO5·PLO6(T1) / 토너먼트 tournament_id 유니크·buy_in·entries·win_loss(T1,T2) / 환율(T4) / 새 탭(T8) — 모두 태스크 존재.
- **Placeholder:** 없음. 모든 코드/명령 구체화.
- **타입 일관성:** `BankrollSession`, `TrendPoint`, `TagRow`, `Summary`, `formatUsd` 시그니처가 T1·T3 정의와 T5·T6·T7 사용처 일치. `parseBankrollFile`/`dedupeSessions`(T2) 사용처(T7) 일치.
- **엣지 케이스:** `num()` NaN→0, `total_no_of_entries` 누락→1, 빈/비배열→[], 환율 실패→null/칩 숨김, 빈 차트 방어 — 코드에 반영.
