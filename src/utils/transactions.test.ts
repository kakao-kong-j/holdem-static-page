import { describe, expect, it } from 'vitest';
import {
  buildTransactionBalanceTrend,
  classifyTransaction,
  dedupeTransactions,
  parseTransactionsFile,
  summarizeTransactions,
  type RawTransaction,
  type TransactionEntry,
} from './transactions';

const base = {
  txn_id: 'id-1',
  date: '2026-07-05 10:00:00',
  amount: 1,
} satisfies Partial<RawTransaction>;

function row(overrides: Partial<RawTransaction>): RawTransaction {
  return { ...base, txn_type: 'reward', sub_type: 'Pending Bonus Release', ...overrides } as RawTransaction;
}

describe('classifyTransaction', () => {
  it('classifies deposits and rewards without double-counting redeemed transfers', () => {
    expect(classifyTransaction(row({ txn_type: 'deposit', sub_type: 'Deposit Successful', amount: 12.93 }))).toMatchObject({ direction: 'income', signedAmount: 12.93 });
    expect(classifyTransaction(row({ txn_type: 'reward', sub_type: '15% Daily Rakeback', amount: 0.03 }))).toMatchObject({ direction: 'income', signedAmount: 0.03 });
    expect(classifyTransaction(row({ txn_type: 'reward', sub_type: 'Redeemed To Withdrawable', amount: 0.39 }))).toMatchObject({ direction: 'transfer', signedAmount: 0 });
  });

  it('classifies tournament costs, winnings, and refunds', () => {
    expect(classifyTransaction(row({ txn_type: 'tournament', sub_type: 'Tournament Buy In', amount: 5.5 }))).toMatchObject({ direction: 'expense', signedAmount: -5.5 });
    expect(classifyTransaction(row({ txn_type: 'tournament', sub_type: 'Tournament Re-buy/Re-entry', amount: 1.1 }))).toMatchObject({ direction: 'expense', signedAmount: -1.1 });
    expect(classifyTransaction(row({ txn_type: 'tournament', sub_type: 'Tournament Winnings', amount: 42.64 }))).toMatchObject({ direction: 'income', signedAmount: 42.64 });
    expect(classifyTransaction(row({ txn_type: 'tournament', sub_type: 'Unused Ticket Refund', amount: 25 }))).toMatchObject({ direction: 'income', signedAmount: 25 });
  });

  it('uses buy out minus buy in for cash games and sportsbook', () => {
    expect(classifyTransaction(row({ txn_type: 'game_play', sub_type: 'Cash Games', buy_in: { amount: 2 }, buy_out: { amount: 4.49 }, amount: 2 }))).toMatchObject({ direction: 'income', signedAmount: 2.49 });
    expect(classifyTransaction(row({ txn_type: 'game_play', sub_type: 'Cash Games', buy_in: { amount: 4 }, buy_out: { amount: 2.44 }, amount: 4 }))).toMatchObject({ direction: 'expense', signedAmount: -1.56 });
    expect(classifyTransaction(row({ txn_type: 'sportsbook', sub_type: 'sportsbook', buy_in: { amount: 1 }, buy_out: { amount: 0 }, amount: 1 }))).toMatchObject({ direction: 'expense', signedAmount: -1 });
  });
});

describe('parseTransactionsFile', () => {
  it('normalizes rows with stable ids and removes exact duplicates only', () => {
    const buyIn = row({ txn_id: 'shared', txn_type: 'tournament', sub_type: 'Tournament Buy In', amount: 1.1 });
    const win = row({ txn_id: 'shared', txn_type: 'tournament', sub_type: 'Tournament Winnings', amount: 3 });
    const entries = parseTransactionsFile([buyIn, buyIn, win]);

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.signedAmount).sort((a, b) => a - b)).toEqual([-1.1, 3]);
  });
});

describe('summarizeTransactions', () => {
  it('sums income, expense, transfer, net, and count', () => {
    const entries: TransactionEntry[] = parseTransactionsFile([
      row({ txn_type: 'deposit', sub_type: 'Deposit Successful', amount: 10 }),
      row({ txn_id: 'id-2', txn_type: 'tournament', sub_type: 'Tournament Buy In', amount: 2 }),
      row({ txn_id: 'id-3', txn_type: 'reward', sub_type: 'Redeemed To Withdrawable', amount: 3 }),
    ]);

    expect(summarizeTransactions(entries)).toEqual({
      count: 3,
      income: 0,
      expense: 2,
      transfer: 3,
      unknown: 0,
      net: -2,
    });
  });

  it('excludes deposits from income and net by default', () => {
    const entries = parseTransactionsFile([
      row({ txn_type: 'deposit', sub_type: 'Deposit Successful', amount: 10 }),
      row({ txn_id: 'id-2', txn_type: 'reward', sub_type: 'Daily Rakeback', amount: 2 }),
      row({ txn_id: 'id-3', txn_type: 'tournament', sub_type: 'Tournament Buy In', amount: 3 }),
    ]);

    expect(summarizeTransactions(entries)).toMatchObject({ income: 2, net: -1 });
    expect(summarizeTransactions(entries, true)).toMatchObject({ income: 12, net: 9 });
  });

  it('builds date-sorted balance points and skips missing balances', () => {
    const entries = parseTransactionsFile([
      row({ txn_id: 'later', date: '2026-07-06 10:00:00', balance: 25 }),
      row({ txn_id: 'none', date: '2026-07-05 09:00:00', balance: undefined }),
      row({ txn_id: 'first', date: '2026-07-05 10:00:00', balance: 20 }),
    ]);

    expect(buildTransactionBalanceTrend(entries)).toEqual([
      { datetime: '2026-07-05 10:00:00', value: 20 },
      { datetime: '2026-07-06 10:00:00', value: 25 },
    ]);
  });
});

describe('dedupeTransactions', () => {
  it('keeps the last entry for the same id', () => {
    const [entry] = parseTransactionsFile([row({ amount: 1 })]);
    const changed = { ...entry, note: 'updated' };

    expect(dedupeTransactions([entry, changed])).toEqual([changed]);
  });
});
