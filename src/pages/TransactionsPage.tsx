import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  dedupeTransactions,
  filterTransactions,
  formatUsd,
  parseTransactionsFile,
  summarizeTransactions,
  type TransactionDirection,
  type TransactionEntry,
} from '../utils/transactions';
import {
  clearTransactions,
  fetchTransactions,
  pushTransactions,
  replaceTransactions,
} from '../utils/transactionsSync';

const DIRECTIONS: Array<TransactionDirection | 'all'> = ['all', 'income', 'expense', 'transfer', 'unknown'];

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [direction, setDirection] = useState<TransactionDirection | 'all'>('all');
  const [txnType, setTxnType] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTransactions()
      .then((stored) => {
        if (!cancelled) setTransactions(dedupeTransactions(stored));
      })
      .catch(() => {
        /* offline / no /api — start empty */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bounds = useMemo(() => dateBounds(transactions), [transactions]);
  const txnTypes = useMemo(
    () => [...new Set(transactions.map((tx) => tx.txnType))].sort(),
    [transactions],
  );
  const filtered = useMemo(
    () => filterTransactions(transactions, from, to, direction, txnType),
    [transactions, from, to, direction, txnType],
  );
  const summary = useMemo(() => summarizeTransactions(filtered), [filtered]);
  const listed = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);

    const added: TransactionEntry[] = [];
    const errors: string[] = [];
    for (const file of files) {
      try {
        const parsed = JSON.parse(await file.text()) as unknown;
        const got = parseTransactionsFile(parsed);
        if (got.length === 0) errors.push(`${file.name}: 인식 가능한 거래 없음`);
        added.push(...got);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'JSON 파싱 실패';
        errors.push(`${file.name}: ${message}`);
      }
    }

    if (inputRef.current) inputRef.current.value = '';
    if (errors.length) setError(errors.join(' / '));
    if (added.length === 0) return;

    setTransactions((prev) => dedupeTransactions([...prev, ...added]));
    setSyncing(true);
    try {
      const stored = await pushTransactions(added);
      setTransactions(dedupeTransactions(stored));
    } catch {
      /* offline / no /api — keep optimistic state */
    } finally {
      setSyncing(false);
    }
  }

  async function onClearAll() {
    if (!confirm('저장된 모든 거래내역을 삭제할까요?')) return;
    setTransactions([]);
    setFrom('');
    setTo('');
    setDirection('all');
    setTxnType('');
    setSyncing(true);
    try {
      await clearTransactions();
    } catch {
      /* offline / no /api — local state already cleared */
    } finally {
      setSyncing(false);
    }
  }

  async function deleteTransaction(tx: TransactionEntry) {
    if (!confirm(`이 거래를 삭제할까요?\n${tx.description}`)) return;
    const remaining = transactions.filter((entry) => entry.id !== tx.id);
    setTransactions(remaining);
    setSyncing(true);
    try {
      const stored = await replaceTransactions(remaining);
      setTransactions(dedupeTransactions(stored));
    } catch {
      /* offline / no /api — keep optimistic state */
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-4 rounded-xl border border-gray-800 bg-gray-950/30 p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
        <div className="text-sm font-medium text-gray-200">저장된 거래내역 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={syncing}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          JSON 추가
        </button>
        <input ref={inputRef} type="file" accept=".json,application/json" multiple onChange={onFiles} className="hidden" />
        {transactions.length > 0 && (
          <button
            onClick={onClearAll}
            disabled={syncing}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            전체 삭제
          </button>
        )}
        {syncing && <span className="text-xs text-indigo-300">동기화 중…</span>}
        <span className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200">
          {transactions.length} transactions
        </span>
        {bounds && (
          <span className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-400">
            {bounds.min} ~ {bounds.max}
          </span>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-200 [color-scheme:dark]" />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-200 [color-scheme:dark]" />
        </Field>
        <Field label="Direction">
          <select value={direction} onChange={(e) => setDirection(e.target.value as TransactionDirection | 'all')} className="rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-200">
            {DIRECTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select value={txnType} onChange={(e) => setTxnType(e.target.value)} className="rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-200">
            <option value="">all</option>
            {txnTypes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </Field>
        {(from || to || direction !== 'all' || txnType) && (
          <button onClick={() => { setFrom(''); setTo(''); setDirection('all'); setTxnType(''); }} className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:text-white">
            초기화
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card label="Income" value={formatUsd(summary.income)} tone="text-green-400" />
        <Card label="Expense" value={formatUsd(summary.expense)} tone="text-red-400" />
        <Card label="Transfer" value={formatUsd(summary.transfer)} tone="text-indigo-300" />
        <Card label="Net" value={formatUsd(summary.net)} tone={summary.net >= 0 ? 'text-green-400' : 'text-red-400'} />
        <Card label="Rows" value={`${summary.count}`} tone="text-white" />
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-white">Records</h2>
          <span className="text-xs text-gray-500">{listed.length} / {transactions.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr className="border-b border-gray-800">
                <th className="whitespace-nowrap px-2 py-2 font-semibold">Date</th>
                <th className="whitespace-nowrap px-2 py-2 font-semibold">Type</th>
                <th className="min-w-56 px-2 py-2 font-semibold">Description</th>
                <th className="whitespace-nowrap px-2 py-2 font-semibold">Direction</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Amount</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Balance</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {listed.map((tx) => (
                <tr key={tx.id} className="text-gray-300">
                  <td className="whitespace-nowrap px-2 py-2">{tx.date}</td>
                  <td className="whitespace-nowrap px-2 py-2">{tx.txnType}</td>
                  <td className="px-2 py-2">
                    <div className="font-medium text-gray-200">{tx.description}</div>
                    <div className="text-[11px] text-gray-500">{tx.subType}</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    <span className={`rounded px-2 py-1 uppercase ${directionClass(tx.direction)}`}>{tx.direction}</span>
                  </td>
                  <td className={`whitespace-nowrap px-2 py-2 text-right font-semibold ${tx.signedAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.direction === 'transfer' ? formatUsd(tx.amount) : formatUsd(tx.signedAmount)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right text-gray-400">{tx.balance === undefined ? '-' : formatUsd(tx.balance)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <button onClick={() => deleteTransaction(tx)} disabled={syncing} className="rounded border border-red-900/70 bg-red-950/40 px-2 py-1 text-red-300 hover:text-red-200 disabled:opacity-50">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {listed.length === 0 && <div className="py-10 text-center text-sm text-gray-500">표시할 거래내역이 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}

function dateBounds(entries: TransactionEntry[]): { min: string; max: string } | null {
  if (entries.length === 0) return null;
  let min = entries[0].date.slice(0, 10);
  let max = min;
  for (const entry of entries) {
    const day = entry.date.slice(0, 10);
    if (day < min) min = day;
    if (day > max) max = day;
  }
  return { min, max };
}

function directionClass(direction: TransactionDirection): string {
  if (direction === 'income') return 'bg-green-950 text-green-300';
  if (direction === 'expense') return 'bg-red-950 text-red-300';
  if (direction === 'transfer') return 'bg-indigo-950 text-indigo-300';
  return 'bg-gray-800 text-gray-300';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-500">
      {label}
      {children}
    </label>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="text-[11px] font-semibold tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}
