import { describe, it, expect } from 'vitest';
import {
  normalizeCashSessions,
  normalizeTournamentSessions,
  dedupeSessions,
  parseBankrollFile,
  computeTrend,
  filterByDateRange,
  dateBounds,
  computeTagPerformance,
  summarize,
  formatUsd,
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

describe('filterByDateRange', () => {
  it('returns all when both bounds empty', () => {
    expect(filterByDateRange(all, '', '')).toHaveLength(all.length);
  });
  it('filters inclusively by date part', () => {
    // cash c1 (06-06), c2 (06-09), c3 (06-06); tour t1 (06-07), t2 (06-11)
    expect(filterByDateRange(all, '2026-06-07', '2026-06-09').map(s => s.id).sort())
      .toEqual(['c2', 't1']);
    expect(filterByDateRange(all, '2026-06-09', '').map(s => s.id).sort())
      .toEqual(['c2', 't2']);
    expect(filterByDateRange(all, '', '2026-06-06').map(s => s.id).sort())
      .toEqual(['c1', 'c3']);
  });
});

describe('dateBounds', () => {
  it('returns min/max date or null', () => {
    expect(dateBounds(all)).toEqual({ min: '2026-06-06', max: '2026-06-11' });
    expect(dateBounds([])).toBeNull();
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

describe('reference dataset invariants', () => {
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
