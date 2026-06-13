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
  return rows
    .filter((r) => typeof r?.internal_ref === 'string' && r.internal_ref.length > 0)
    .map((r) => {
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
  return rows
    .filter((r) => typeof r?.tournament_id === 'string' && r.tournament_id.length > 0)
    .map((r) => {
    const buyIn = num(r.buy_in);
    // `?? 1` would miss a literal 0 (malformed/partial export) → buyIn*0 = 0 cost.
    const entries = r.total_no_of_entries > 0 ? r.total_no_of_entries : 1;
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

export interface TrendPoint { datetime: string; value: number; }
export interface TagRow { tag: string; sessions: number; profit: number; }
export interface Summary {
  totalProfit: number;
  cashProfit: number;
  tournamentProfit: number;
  sessionCount: number;
}

/**
 * Filter sessions by an inclusive date range (YYYY-MM-DD strings).
 * Empty `from`/`to` means that bound is open. Compares on the date part of
 * `datetime` ('YYYY-MM-DD HH:mm:ss').
 */
export function filterByDateRange(
  sessions: BankrollSession[],
  from: string,
  to: string,
): BankrollSession[] {
  if (!from && !to) return sessions;
  return sessions.filter((s) => {
    const d = s.datetime.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

/** Earliest/latest date (YYYY-MM-DD) across sessions, or null if empty. */
export function dateBounds(sessions: BankrollSession[]): { min: string; max: string } | null {
  if (sessions.length === 0) return null;
  let min = sessions[0].datetime.slice(0, 10);
  let max = min;
  for (const s of sessions) {
    const d = s.datetime.slice(0, 10);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
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
