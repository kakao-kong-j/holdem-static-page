export type TransactionDirection = 'income' | 'expense' | 'transfer' | 'unknown';

export interface TransactionAmountPart {
  amount?: unknown;
  closing_balance?: unknown;
  date_time?: unknown;
  action?: unknown;
}

export interface RawTransaction {
  txn_id?: unknown;
  txn_type?: unknown;
  sub_type?: unknown;
  sub_type_key?: unknown;
  date?: unknown;
  amount?: unknown;
  amount_type?: unknown;
  balance?: unknown;
  prize_type?: unknown;
  buy_in?: TransactionAmountPart | null;
  buy_out?: TransactionAmountPart | null;
  net_winnings?: unknown;
  tournament?: unknown;
  status?: unknown;
  record_id?: unknown;
  mini_game_type?: unknown;
  mini_game_type_id?: unknown;
  stakes?: unknown;
  stakes_group?: unknown;
  blinds?: unknown;
  leaderboard_type?: unknown;
  mini_game_type_ids?: unknown;
  [key: string]: unknown;
}

export interface TransactionEntry {
  id: string;
  txnId: string;
  txnType: string;
  subType: string;
  date: string;
  amount: number;
  signedAmount: number;
  direction: TransactionDirection;
  category: string;
  description: string;
  balance?: number;
  prizeType?: string;
  game?: string;
  stakes?: string;
  raw: RawTransaction;
  note?: string;
}

export interface TransactionSummary {
  count: number;
  income: number;
  expense: number;
  transfer: number;
  unknown: number;
  net: number;
}

export interface TransactionBalancePoint {
  datetime: string;
  value: number;
}

function num(value: unknown): number {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

function optionalNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number.parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function partAmount(part: unknown): number {
  return part && typeof part === 'object' ? num((part as TransactionAmountPart).amount) : 0;
}

function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000;
}

export function classifyTransaction(
  row: RawTransaction,
): Pick<TransactionEntry, 'direction' | 'signedAmount' | 'category'> {
  const txnType = text(row.txn_type);
  const subType = text(row.sub_type);
  const amount = num(row.amount);

  if (txnType === 'deposit') {
    return { direction: 'income', signedAmount: amount, category: 'Deposit' };
  }
  if (txnType === 'leaderboard') {
    return { direction: 'income', signedAmount: amount, category: 'Leaderboard' };
  }
  if (txnType === 'reward') {
    if (subType === 'Redeemed To Withdrawable') {
      return { direction: 'transfer', signedAmount: 0, category: 'Reward Transfer' };
    }
    return { direction: 'income', signedAmount: amount, category: 'Reward' };
  }
  if (txnType === 'tournament') {
    if (subType === 'Tournament Buy In' || subType === 'Tournament Re-buy/Re-entry') {
      return { direction: 'expense', signedAmount: -amount, category: 'Tournament Cost' };
    }
    if (subType === 'Tournament Winnings' || subType === 'Tournament Refund' || subType === 'Unused Ticket Refund') {
      return { direction: 'income', signedAmount: amount, category: 'Tournament Return' };
    }
  }
  if (txnType === 'game_play' || txnType === 'sportsbook') {
    const signedAmount = roundCents(partAmount(row.buy_out) - partAmount(row.buy_in));
    return {
      direction: signedAmount >= 0 ? 'income' : 'expense',
      signedAmount,
      category: txnType === 'sportsbook' ? 'Sportsbook' : 'Cash Game',
    };
  }
  return { direction: 'unknown', signedAmount: 0, category: 'Unknown' };
}

function transactionId(row: RawTransaction, signedAmount: number): string {
  return [row.txn_id, row.txn_type, row.sub_type, row.date, signedAmount]
    .map((v) => text(v))
    .join('|');
}

export function normalizeTransaction(row: RawTransaction): TransactionEntry {
  const classified = classifyTransaction(row);
  const txnType = text(row.txn_type) || 'unknown';
  const subType = text(row.sub_type) || 'unknown';
  const amount = num(row.amount);
  const game = text(row.mini_game_type);
  const stakes = text(row.stakes || row.stakes_group);
  const tournament = text(row.tournament);
  const description = tournament || [subType, game, stakes].filter(Boolean).join(' / ') || txnType;

  return {
    id: transactionId(row, classified.signedAmount),
    txnId: text(row.txn_id),
    txnType,
    subType,
    date: text(row.date),
    amount,
    ...classified,
    description,
    balance: optionalNum(row.balance),
    prizeType: text(row.prize_type) || undefined,
    game: game || undefined,
    stakes: stakes || undefined,
    raw: row,
  };
}

export function dedupeTransactions(entries: TransactionEntry[]): TransactionEntry[] {
  const byId = new Map<string, TransactionEntry>();
  for (const entry of entries) byId.set(entry.id, entry);
  return [...byId.values()];
}

export function parseTransactionsFile(parsed: unknown): TransactionEntry[] {
  if (!Array.isArray(parsed)) return [];
  return dedupeTransactions(
    parsed
      .filter((row): row is RawTransaction => row !== null && typeof row === 'object')
      .map((row) => normalizeTransaction(row)),
  );
}

export function buildTransactionBalanceTrend(entries: TransactionEntry[]): TransactionBalancePoint[] {
  return entries
    .filter((entry): entry is TransactionEntry & { balance: number } => entry.balance !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({ datetime: entry.date, value: entry.balance }));
}

export function summarizeTransactions(
  entries: TransactionEntry[],
  includeDeposits = false,
): TransactionSummary {
  const summary: TransactionSummary = { count: entries.length, income: 0, expense: 0, transfer: 0, unknown: 0, net: 0 };
  for (const entry of entries) {
    if (entry.direction === 'income') {
      if (includeDeposits || entry.txnType !== 'deposit') summary.income += entry.signedAmount;
    } else if (entry.direction === 'expense') summary.expense += Math.abs(entry.signedAmount);
    else if (entry.direction === 'transfer') summary.transfer += entry.amount;
    else summary.unknown += entry.amount;
  }
  summary.net = summary.income - summary.expense + summary.transfer;
  return {
    count: summary.count,
    income: roundCents(summary.income),
    expense: roundCents(summary.expense),
    transfer: roundCents(summary.transfer),
    unknown: roundCents(summary.unknown),
    net: roundCents(summary.net),
  };
}

export function filterTransactions(
  entries: TransactionEntry[],
  from: string,
  to: string,
  direction: TransactionDirection | 'all',
  txnType: string,
): TransactionEntry[] {
  return entries.filter((entry) => {
    const day = entry.date.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (direction !== 'all' && entry.direction !== direction) return false;
    if (txnType && entry.txnType !== txnType) return false;
    return true;
  });
}

export function formatUsd(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}
