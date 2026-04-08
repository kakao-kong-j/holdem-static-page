import { useState, useMemo, useRef } from 'react';
import { ACTION_COLORS } from '../constants';
import { RangeGrid } from '../components/RangeGrid';
import { Legend } from '../components/Legend';
import { buildHandAction, buildActionStats } from '../utils/hand';
import {
  loadQuizRecords,
  clearQuizRecords,
  exportRecords,
  importRecords,
  actionLabel,
} from '../utils/quiz';
import type { AllData, QuizRecord } from '../types';

type Filter = { type: 'stack'; value: string } | { type: 'position'; value: string } | null;

function WrongList({ records, data }: { records: QuizRecord[]; data: AllData }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (records.length === 0) {
    return (
      <div className="mt-2 text-sm text-gray-500 text-center py-3">
        틀린 문제가 없습니다
      </div>
    );
  }

  const selected = selectedIdx !== null ? records[selectedIdx] : null;
  const chartData = selected
    ? data[selected.question.stackSize]?.[selected.question.chartName]
    : null;

  return (
    <div className="mt-2 space-y-1">
      {records.map((r, i) => (
        <div key={i}>
          <button
            onClick={() => setSelectedIdx(prev => (prev === i ? null : i))}
            className={`w-full rounded p-2.5 flex items-center gap-3 text-sm text-left transition-colors ${
              selectedIdx === i
                ? 'bg-indigo-900/40 ring-1 ring-indigo-500'
                : 'bg-gray-900/50 hover:bg-gray-800/50'
            }`}
          >
            <span className="text-white font-bold w-10">{r.question.hand}</span>
            <span className="text-gray-400 text-xs flex-1 truncate">{r.question.situation}</span>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium line-through opacity-60"
              style={{
                backgroundColor: ACTION_COLORS[r.userAnswer]?.bg || '#374151',
                color: ACTION_COLORS[r.userAnswer]?.text || '#d1d5db',
              }}
            >
              {actionLabel(r.userAnswer)}
            </span>
            <span className="text-gray-600">→</span>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: ACTION_COLORS[r.question.correctAction]?.bg || '#374151',
                color: ACTION_COLORS[r.question.correctAction]?.text || '#d1d5db',
              }}
            >
              {actionLabel(r.question.correctAction)}
            </span>
          </button>
          {selectedIdx === i && chartData && <ChartPreview chartData={chartData} chartName={r.question.chartName} />}
        </div>
      ))}
    </div>
  );
}

function ChartPreview({ chartData, chartName }: { chartData: Record<string, string[]>; chartName: string }) {
  const handAction = useMemo(() => buildHandAction(chartData), [chartData]);
  const { legendItems, totalNonFold } = useMemo(() => buildActionStats(handAction), [handAction]);

  return (
    <div className="mt-2 mb-3 flex flex-col items-center gap-2">
      <span className="text-xs text-gray-400 font-medium">{chartName}</span>
      <RangeGrid handAction={handAction} colorMap={ACTION_COLORS} />
      <Legend items={legendItems} total={totalNonFold} />
    </div>
  );
}

export function QuizStatsPage({ data }: { data: AllData }) {
  const [records, setRecords] = useState<QuizRecord[]>(() => loadQuizRecords());
  const [filter, setFilter] = useState<Filter>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    if (records.length === 0) return null;

    let totalCorrect = 0;
    const posBuckets: Record<string, { correct: number; total: number }> = {};
    const stackBuckets: Record<string, { correct: number; total: number }> = {};
    const handMisses: Record<string, { count: number; situations: string[]; correctAction: string }> = {};
    const confusion: Record<string, Record<string, number>> = {};

    for (const r of records) {
      const { heroPosition, stackSize, hand, chartName, correctAction, situation } = r.question;

      if (r.correct) totalCorrect++;

      if (!posBuckets[heroPosition]) posBuckets[heroPosition] = { correct: 0, total: 0 };
      posBuckets[heroPosition].total++;
      if (r.correct) posBuckets[heroPosition].correct++;

      if (!stackBuckets[stackSize]) stackBuckets[stackSize] = { correct: 0, total: 0 };
      stackBuckets[stackSize].total++;
      if (r.correct) stackBuckets[stackSize].correct++;

      if (!r.correct) {
        const key = `${hand}|${chartName}`;
        if (!handMisses[key]) {
          handMisses[key] = { count: 0, situations: [], correctAction };
        }
        handMisses[key].count++;
        if (!handMisses[key].situations.includes(situation)) {
          handMisses[key].situations.push(situation);
        }

        if (!confusion[correctAction]) confusion[correctAction] = {};
        confusion[correctAction][r.userAnswer] = (confusion[correctAction][r.userAnswer] || 0) + 1;
      }
    }

    const topMisses = Object.entries(handMisses)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, v]) => ({
        hand: key.split('|')[0],
        chart: key.split('|')[1],
        situation: v.situations[0],
        correctAction: v.correctAction,
        count: v.count,
      }));

    return { totalCorrect, posBuckets, stackBuckets, topMisses, confusion };
  }, [records]);

  const filteredWrong = useMemo(() => {
    if (!filter) return [];
    return records.filter(r => {
      if (r.correct) return false;
      if (filter.type === 'stack') return r.question.stackSize === filter.value;
      return r.question.heroPosition === filter.value;
    });
  }, [records, filter]);

  const toggleFilter = (type: 'stack' | 'position', value: string) => {
    setFilter(prev =>
      prev?.type === type && prev.value === value ? null : { type, value },
    );
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await importRecords(file);
      setRecords(loadQuizRecords());
      alert(`${count}개의 새 기록을 가져왔습니다`);
    } catch (err) {
      alert((err as Error).message);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClear = () => {
    if (!confirm('모든 퀴즈 기록을 삭제하시겠습니까?')) return;
    clearQuizRecords();
    setRecords([]);
  };

  const pct = (correct: number, total: number) =>
    total === 0 ? '-' : `${Math.round((correct / total) * 100)}%`;

  if (!stats) {
    return (
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-lg font-bold text-white">퀴즈 통계</h2>
        <p className="text-gray-500">아직 퀴즈 기록이 없습니다.</p>
        <div className="flex gap-2">
          <label className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-700">
            기록 가져오기
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto">
      <h2 className="text-lg font-bold text-white">퀴즈 통계</h2>

<div className="w-full bg-gray-800/50 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-white">
          {pct(stats.totalCorrect, records.length)}
        </div>
        <div className="text-sm text-gray-400 mt-1">
          전체 정답률 ({stats.totalCorrect}/{records.length})
        </div>
      </div>

<div className="w-full">
        <h3 className="text-sm font-medium text-gray-400 mb-2">스택별 정답률</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(stats.stackBuckets).map(([stack, b]) => (
            <button
              key={stack}
              onClick={() => toggleFilter('stack', stack)}
              className={`rounded p-3 flex justify-between text-left transition-colors ${
                filter?.type === 'stack' && filter.value === stack
                  ? 'bg-indigo-900/50 ring-1 ring-indigo-500'
                  : 'bg-gray-800/50 hover:bg-gray-700/50'
              }`}
            >
              <span className="text-gray-300 font-mono text-sm">{stack}</span>
              <span className="text-white font-medium text-sm">
                {pct(b.correct, b.total)}{' '}
                <span className="text-gray-500 text-xs">({b.total})</span>
              </span>
            </button>
          ))}
        </div>
        {filter?.type === 'stack' && <WrongList key={filter.value} records={filteredWrong} data={data} />}
      </div>

<div className="w-full">
        <h3 className="text-sm font-medium text-gray-400 mb-2">포지션별 정답률</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(stats.posBuckets).map(([pos, b]) => (
            <button
              key={pos}
              onClick={() => toggleFilter('position', pos)}
              className={`rounded p-3 flex justify-between text-left transition-colors ${
                filter?.type === 'position' && filter.value === pos
                  ? 'bg-indigo-900/50 ring-1 ring-indigo-500'
                  : 'bg-gray-800/50 hover:bg-gray-700/50'
              }`}
            >
              <span className="text-gray-300 text-sm">{pos}</span>
              <span className="text-white font-medium text-sm">
                {pct(b.correct, b.total)}{' '}
                <span className="text-gray-500 text-xs">({b.total})</span>
              </span>
            </button>
          ))}
        </div>
        {filter?.type === 'position' && <WrongList key={filter.value} records={filteredWrong} data={data} />}
      </div>

{stats.topMisses.length > 0 && (
        <div className="w-full">
          <h3 className="text-sm font-medium text-gray-400 mb-2">자주 틀리는 핸드 TOP 10</h3>
          <div className="space-y-1.5">
            {stats.topMisses.map((m, i) => (
              <div key={i} className="bg-gray-800/50 rounded p-3 flex items-center gap-3">
                <span className="text-gray-500 text-xs w-5">{i + 1}</span>
                <span className="text-white font-bold text-sm w-10">{m.hand}</span>
                <span className="text-gray-400 text-xs flex-1 truncate">{m.situation}</span>
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: ACTION_COLORS[m.correctAction]?.bg || '#374151',
                    color: ACTION_COLORS[m.correctAction]?.text || '#d1d5db',
                  }}
                >
                  {actionLabel(m.correctAction)}
                </span>
                <span className="text-red-400 text-xs">{m.count}회</span>
              </div>
            ))}
          </div>
        </div>
      )}

{Object.keys(stats.confusion).length > 0 && (
        <div className="w-full">
          <h3 className="text-sm font-medium text-gray-400 mb-2">액션별 혼동 분석</h3>
          <div className="space-y-1.5">
            {Object.entries(stats.confusion).map(([correct, wrongMap]) => (
              <div key={correct} className="bg-gray-800/50 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-500 text-xs">정답:</span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: ACTION_COLORS[correct]?.bg || '#374151',
                      color: ACTION_COLORS[correct]?.text || '#d1d5db',
                    }}
                  >
                    {actionLabel(correct)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 ml-4">
                  {Object.entries(wrongMap)
                    .sort((a, b) => b[1] - a[1])
                    .map(([wrong, count]) => (
                      <span key={wrong} className="text-xs text-gray-400">
                        → {actionLabel(wrong)}{' '}
                        <span className="text-red-400">{count}회</span>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

<div className="flex gap-2 flex-wrap justify-center pt-2">
        <button
          onClick={exportRecords}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700"
        >
          기록 내보내기
        </button>
        <label className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-700">
          기록 가져오기
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </label>
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-red-900/50 text-red-400 rounded-lg text-sm hover:bg-red-900/70"
        >
          기록 초기화
        </button>
      </div>
    </div>
  );
}
