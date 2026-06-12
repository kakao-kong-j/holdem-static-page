import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
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
