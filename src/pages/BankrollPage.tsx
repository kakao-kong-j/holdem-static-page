import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  parseBankrollFile,
  dedupeSessions,
  computeTrend,
  computeTagPerformance,
  filterByDateRange,
  dateBounds,
  summarize,
  formatUsd,
  type BankrollSession,
} from '../utils/bankroll';
import { fetchUsdKrwRate } from '../utils/fxRate';
import {
  fetchBankrollSessions,
  pushBankrollSessions,
  clearBankroll,
  flattenStore,
} from '../utils/bankrollSync';
import { BankrollTrendChart } from '../components/BankrollTrendChart';
import { TagPerformanceChart } from '../components/TagPerformanceChart';

export function BankrollPage() {
  const [sessions, setSessions] = useState<BankrollSession[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [syncing, setSyncing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchUsdKrwRate().then(setRate).catch(() => {});
  }, []);

  // Seed from the server-side store on mount (no-op offline / no /api).
  useEffect(() => {
    fetchBankrollSessions()
      .then((store) => setSessions(dedupeSessions(flattenStore(store))))
      .catch(() => {});
  }, []);

  const bounds = useMemo(() => dateBounds(sessions), [sessions]);
  const filtered = useMemo(
    () => filterByDateRange(sessions, from, to),
    [sessions, from, to],
  );
  const trend = useMemo(() => computeTrend(filtered), [filtered]);
  const tags = useMemo(() => computeTagPerformance(filtered), [filtered]);
  const sum = useMemo(() => summarize(filtered), [filtered]);

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
    if (inputRef.current) inputRef.current.value = '';
    if (errors.length) setFileError(errors.join(' / '));
    if (added.length === 0) return;

    // Optimistic local merge for instant feedback.
    setSessions((prev) => dedupeSessions([...prev, ...added]));
    // Persist to Vercel Blob; adopt the server-merged union (dedupe by id).
    setSyncing(true);
    try {
      const store = await pushBankrollSessions(added);
      setSessions(dedupeSessions(flattenStore(store)));
    } catch {
      /* offline / no /api — keep the optimistic local state */
    } finally {
      setSyncing(false);
    }
  }

  async function onClearAll() {
    if (!confirm('저장된 모든 뱅크롤 데이터를 삭제할까요?')) return;
    setSessions([]);
    setFrom('');
    setTo('');
    setSyncing(true);
    try {
      await clearBankroll('all');
    } catch {
      /* offline / no /api — local state already cleared */
    } finally {
      setSyncing(false);
    }
  }

  const hasData = sessions.length > 0;

  return (
    <div className="space-y-4">
      {/* import + chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={syncing}
          className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          JSON 추가
        </button>
        <input ref={inputRef} type="file" accept=".json,application/json" multiple
          onChange={onFiles} className="hidden" />
        {hasData && (
          <button
            onClick={onClearAll}
            disabled={syncing}
            className="px-3 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            전체 삭제
          </button>
        )}
        {syncing && <span className="text-xs text-indigo-300">동기화 중…</span>}
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

      {/* date range filter */}
      {hasData && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
          <span className="text-gray-500">기간</span>
          <input
            type="date"
            value={from}
            min={bounds?.min}
            max={to || bounds?.max}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-200 [color-scheme:dark]"
          />
          <span className="text-gray-500">~</span>
          <input
            type="date"
            value={to}
            min={from || bounds?.min}
            max={bounds?.max}
            onChange={(e) => setTo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-200 [color-scheme:dark]"
          />
          {(from || to) && (
            <button
              onClick={() => { setFrom(''); setTo(''); }}
              className="px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
            >
              초기화
            </button>
          )}
          {(from || to) && (
            <span className="text-gray-500">
              {filtered.length} / {sessions.length} 세션
            </span>
          )}
        </div>
      )}

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

function Section({ title, right, children }: { title: string; right?: string; children: ReactNode }) {
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
