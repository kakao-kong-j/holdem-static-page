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
import { computeDeviationStats } from '../utils/stats';
import { HexagonRadar, type HexagonAxis } from '../components/HexagonRadar';
import { ErrorDonut } from '../components/ErrorDonut';
import {
  analyzeQuizResults,
  type PlayerProfile,
  type ProfileLabel,
  type WeaknessSummary,
  type WeaknessAnalysis,
} from '../utils/analyzeQuizResults';
import { WEAKNESS_MAP, ALL_TAGS, type WeaknessId } from '../utils/weaknessMap';
import type { AllData, QuizRecord } from '../types';
import type { NavigateIntent } from '../App';

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

function formatDelta(v: number): string {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

function interpret(delta: number, positiveLabel: string, negativeLabel: string, neutralLabel = '균형'): string {
  if (delta > 2) return positiveLabel;
  if (delta < -2) return negativeLabel;
  return neutralLabel;
}

function deltaColor(v: number): string {
  if (v > 2) return 'text-orange-400';
  if (v < -2) return 'text-sky-400';
  return 'text-gray-300';
}

function PlayStyleSection({ d }: { d: ReturnType<typeof computeDeviationStats> }) {
  if (!d) return null;
  const lowSample = d.sampleSize < 100;

  const axes: HexagonAxis[] = [
    {
      key: 'vpip',
      label: 'VPIP',
      value: d.vpipDelta,
      positiveLabel: '루즈',
      negativeLabel: '타이트',
      sampleSize: d.sampleSize,
      description: '자발적으로 팟에 투입한 비율. 폴드가 아닌 모든 액션(콜/레이즈/림프/셔브)을 콤보 가중으로 합산.',
      userValue: d.userVpipPct,
      gtoValue: d.gtoVpipPct,
      unit: '%',
    },
    {
      key: 'pfr',
      label: 'PFR',
      value: d.pfrDelta,
      positiveLabel: '어그로',
      negativeLabel: '패시브',
      sampleSize: d.sampleSize,
      description: '프리플랍 레이즈 비율. 레이즈/셔브/3벳 등 공격 액션만 카운트 (콜·림프 제외).',
      userValue: d.userPfrPct,
      gtoValue: d.gtoPfrPct,
      unit: '%',
    },
    {
      key: 'threebet',
      label: '3Bet',
      value: d.threebetDelta,
      positiveLabel: '공격적',
      negativeLabel: '소극적',
      sampleSize: d.threebetSampleSize,
      description: 'Facing RFI 상황에서 3벳(리레이즈) 비율. 15~40BB에선 allIn 3벳 셔브도 포함.',
      userValue: d.userThreebetPct,
      gtoValue: d.gtoThreebetPct,
      unit: '%',
    },
    {
      key: 'coldcall',
      label: 'Cold Call',
      value: d.coldCallDelta,
      positiveLabel: '콜링',
      negativeLabel: '덜 콜',
      sampleSize: d.coldCallSampleSize,
      description: 'Facing RFI에서 콜드 콜 비율. 높으면 콜링 스테이션 성향, 낮으면 3벳/폴드 편향.',
      userValue: d.userColdCallPct,
      gtoValue: d.gtoColdCallPct,
      unit: '%',
    },
    {
      key: 'steal',
      label: 'Steal',
      value: d.stealDelta,
      positiveLabel: '자주 스틸',
      negativeLabel: '소극적',
      sampleSize: d.stealSampleSize,
      description: 'CO/BTN/SB RFI에서 오픈(레이즈·셔브) 비율. 레이트 포지션의 블라인드 훔치기 어그레션.',
      userValue: d.userStealPct,
      gtoValue: d.gtoStealPct,
      unit: '%',
    },
    {
      key: 'foldToSteal',
      label: 'Fold to Steal',
      value: d.foldToStealDelta,
      positiveLabel: '과폴드',
      negativeLabel: '오버디펜드',
      sampleSize: d.foldToStealSampleSize,
      description: 'SB/BB에서 CO/BTN/SB의 스틸 오픈을 마주쳤을 때 폴드 비율. 양수면 GTO보다 많이 접음(익스플로잇 당하기 쉬움).',
      userValue: d.userFoldToStealPct,
      gtoValue: d.gtoFoldToStealPct,
      unit: '%',
    },
  ];

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-gray-400 mb-2">플레이 스타일 (GTO 대비 편차)</h3>
      <div className="bg-gray-800/30 rounded-lg p-3 flex flex-col items-center relative">
        <HexagonRadar axes={axes} />
        <div className="text-xs text-gray-500 mt-1 text-center">
          라벨에 커서/터치하면 상세 보임 · 중심선 = GTO 일치
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mt-2">
        {axes.map(a => (
          <div key={a.key} className="bg-gray-800/50 rounded px-2 py-1.5 flex items-center justify-between text-xs">
            <span className="text-gray-400">{a.label}</span>
            <span className="flex items-center gap-2">
              {a.value === null ? (
                <span className="text-gray-600">데이터 없음</span>
              ) : (
                <>
                  <span className="text-gray-400">
                    {interpret(a.value, a.positiveLabel, a.negativeLabel)}
                  </span>
                  <span className={`font-bold ${deltaColor(a.value)} w-14 text-right`}>
                    {formatDelta(a.value)}
                  </span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="text-xs text-gray-500 mt-2 space-y-0.5">
        <div>
          샘플 {d.sampleSize}건
          {lowSample && <span className="text-yellow-500 ml-1">⚠️ 100건 미만, 참고용</span>}
        </div>
        <div>양수(+): GTO보다 자주함 / 음수(−): GTO보다 덜함</div>
      </div>
    </div>
  );
}

const PROFILE_COLORS: Record<ProfileLabel, string> = {
  'TAG-Linear': 'bg-indigo-600',
  Nit: 'bg-sky-600',
  LAG: 'bg-orange-600',
  Passive: 'bg-yellow-600',
  Balanced: 'bg-emerald-600',
};

const PROFILE_DESC: Record<ProfileLabel, string> = {
  'TAG-Linear': '타이트하고 공격적 — 3벳을 공격적으로 씀',
  Nit: '지나치게 타이트 — 마진 핸드를 폴드함',
  LAG: '루즈하고 공격적 — 과플레이 경향',
  Passive: '수동적 — 블러프/리레이즈 부족',
  Balanced: 'GTO에 가까운 균형 잡힌 플레이',
};

function HeaderCard({ profile }: { profile: PlayerProfile }) {
  const accPct = Math.round(profile.accuracy * 100);
  const badgeClass = PROFILE_COLORS[profile.profileLabel];
  return (
    <div className="w-full bg-gray-800/50 rounded-lg p-4 flex items-center justify-between gap-4">
      <div>
        <div className="text-3xl font-bold text-white">{accPct}%</div>
        <div className="text-xs text-gray-400 mt-0.5">
          정답률 ({profile.totalQuestions}문항)
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${badgeClass}`}>
          {profile.profileLabel}
        </span>
        <span className="text-[10px] text-gray-500 text-right max-w-[180px]">
          {PROFILE_DESC[profile.profileLabel]}
        </span>
      </div>
    </div>
  );
}

function severityBadge(severity: number): { label: string; cls: string } {
  if (severity >= 0.66) return { label: '상', cls: 'bg-red-900/60 text-red-300' };
  if (severity >= 0.33) return { label: '중', cls: 'bg-yellow-900/60 text-yellow-300' };
  return { label: '하', cls: 'bg-gray-800/60 text-gray-400' };
}

function ChartLinkButton({
  chartLink, onNavigate, label = '차트 보기', variant = 'primary',
}: {
  chartLink: { stack: import('../types').StackSize; chartName: string; viewType: 'open-range' | 'sb-open' | 'facing' };
  onNavigate: (i: NavigateIntent) => void;
  label?: string;
  variant?: 'primary' | 'subtle';
}) {
  const cls = variant === 'subtle'
    ? 'px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-indigo-600 text-gray-200'
    : 'px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium';
  return (
    <button
      onClick={() => onNavigate({
        kind: 'chart',
        stack: chartLink.stack,
        chartName: chartLink.chartName,
        viewType: chartLink.viewType,
      })}
      className={`shrink-0 rounded ${cls}`}
    >
      {label}
    </button>
  );
}

function WeaknessCard({
  s, onNavigate,
}: {
  s: WeaknessSummary;
  onNavigate: (i: NavigateIntent) => void;
}) {
  const sev = severityBadge(s.severity);
  return (
    <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
      <div className="flex items-start gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-900/60 text-red-300 text-xs font-bold shrink-0">
          {s.rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white font-semibold text-sm">{s.meta.title}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sev.cls}`}>{sev.label}</span>
            <span className="text-gray-500 text-[10px]">{s.errorCount}/{s.spotCount}회</span>
          </div>
          <div className="text-gray-400 text-xs mt-0.5">{s.meta.description}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {s.meta.tag.map(t => (
              <span key={t} className="text-[10px] text-gray-500">{t}</span>
            ))}
          </div>
        </div>
        <ChartLinkButton chartLink={s.meta.chartLink} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function WeaknessAllTable({
  analysis, onNavigate, tagFilter,
}: {
  analysis: WeaknessAnalysis;
  onNavigate: (i: NavigateIntent) => void;
  tagFilter: string | null;
}) {
  const rows = useMemo(() => {
    const ids = Object.keys(WEAKNESS_MAP) as Exclude<WeaknessId, 'other'>[];
    return ids
      .filter(id => !tagFilter || WEAKNESS_MAP[id].tag.includes(tagFilter))
      .map(id => {
        const b = analysis.byWeakness[id];
        return {
          id,
          meta: WEAKNESS_MAP[id],
          errorCount: b?.errorCount ?? 0,
          spotCount: b?.spotCount ?? 0,
          severity: b?.severity ?? 0,
        };
      })
      .sort((a, b) => {
        if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
        return a.id.localeCompare(b.id);
      });
  }, [analysis, tagFilter]);

  return (
    <div className="w-full text-xs">
      <div className="grid grid-cols-[24px_1fr_auto_auto_auto] gap-2 px-2 py-1 text-gray-500 font-medium border-b border-gray-800">
        <span>군</span><span>약점</span><span>오답</span><span>심각도</span><span></span>
      </div>
      {rows.map(r => {
        const sev = severityBadge(r.severity);
        return (
          <div key={r.id} className="grid grid-cols-[24px_1fr_auto_auto_auto] gap-2 px-2 py-1.5 items-center border-b border-gray-800/50 hover:bg-gray-800/30">
            <span className="text-gray-500">{r.meta.category}</span>
            <span className="text-gray-300 truncate" title={r.meta.description}>{r.meta.title}</span>
            <span className={r.errorCount > 0 ? 'text-red-400 font-medium' : 'text-gray-600'}>
              {r.errorCount}/{r.spotCount}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sev.cls}`}>{sev.label}</span>
            <ChartLinkButton chartLink={r.meta.chartLink} onNavigate={onNavigate} label="차트" variant="subtle" />
          </div>
        );
      })}
    </div>
  );
}

function WeaknessSection({
  analysis, onNavigate,
}: {
  analysis: WeaknessAnalysis;
  onNavigate: (i: NavigateIntent) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400">
          약점 TOP {analysis.top3.length}
          {analysis.stackInconsistencies.length > 0 && (
            <span className="ml-2 text-[10px] text-yellow-500">
              ⚠ 스택 조정 실패 {analysis.stackInconsistencies.length}건
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowAll(v => !v)}
          className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
        >
          {showAll ? '간단히' : '모든 약점 보기'}
        </button>
      </div>

      {analysis.top3.length === 0 && !showAll && (
        <div className="text-center text-xs text-gray-500 py-3 bg-gray-800/30 rounded">
          현저한 약점 없음 (각 카테고리 오답 2건 미만)
        </div>
      )}

      {!showAll && analysis.top3.length > 0 && (
        <div className="space-y-2">
          {analysis.top3.map(s => (
            <WeaknessCard key={s.weaknessId} s={s} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {showAll && (
        <>
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              onClick={() => setTagFilter(null)}
              className={`text-[10px] px-2 py-0.5 rounded ${tagFilter === null ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              전체
            </button>
            {ALL_TAGS.map(t => (
              <button
                key={t}
                onClick={() => setTagFilter(t)}
                className={`text-[10px] px-2 py-0.5 rounded ${tagFilter === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <WeaknessAllTable analysis={analysis} onNavigate={onNavigate} tagFilter={tagFilter} />
        </>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

function ErrorTable({
  records,
  onReview,
}: {
  records: QuizRecord[];
  onReview: (r: QuizRecord) => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * PAGE_SIZE;
  const pageRecords = records.slice(start, start + PAGE_SIZE);

  if (records.length === 0) return null;
  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-gray-400 mb-2">오답 목록 ({records.length}건)</h3>
      <div className="space-y-1">
        {pageRecords.map((r, i) => (
          <div key={start + i} className="bg-gray-800/50 rounded px-2 py-1.5 flex items-center gap-2 text-xs">
            <span className="text-gray-500 font-mono w-12 shrink-0">{r.question.stackSize}</span>
            <span className="text-white font-bold w-10 shrink-0">{r.question.hand}</span>
            <span className="text-gray-400 flex-1 truncate">{r.question.situation || r.question.chartName}</span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium line-through opacity-60 shrink-0"
              style={{
                backgroundColor: ACTION_COLORS[r.userAnswer]?.bg || '#374151',
                color: ACTION_COLORS[r.userAnswer]?.text || '#d1d5db',
              }}
            >
              {actionLabel(r.userAnswer)}
            </span>
            <span className="text-gray-600 shrink-0">→</span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
              style={{
                backgroundColor: ACTION_COLORS[r.question.correctAction]?.bg || '#374151',
                color: ACTION_COLORS[r.question.correctAction]?.text || '#d1d5db',
              }}
            >
              {actionLabel(r.question.correctAction)}
            </span>
            <button
              onClick={() => onReview(r)}
              className="shrink-0 px-2 py-0.5 bg-gray-700 hover:bg-indigo-600 text-gray-200 hover:text-white rounded text-[10px] font-medium transition-colors"
            >
              복습
            </button>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            이전
          </button>
          <span className="text-xs text-gray-400">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="px-3 py-1 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
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

interface QuizStatsPageProps {
  data: AllData;
  onNavigate: (intent: NavigateIntent) => void;
}

type TabKey = 'profile' | 'accuracy' | 'wrongs';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'profile', label: '프로파일' },
  { key: 'accuracy', label: '정답률' },
  { key: 'wrongs', label: '오답 목록' },
];

export function QuizStatsPage({ data, onNavigate }: QuizStatsPageProps) {
  const [records, setRecords] = useState<QuizRecord[]>(() => loadQuizRecords());
  const [filter, setFilter] = useState<Filter>(null);
  const [tab, setTab] = useState<TabKey>('profile');
  const fileRef = useRef<HTMLInputElement>(null);

  const deviation = useMemo(() => computeDeviationStats(records), [records]);
  const profile = useMemo(() => analyzeQuizResults(records), [records]);

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

  const wrongRecords = useMemo(
    () => records.filter(r => !r.correct),
    [records],
  );

  const filteredWrong = useMemo(() => {
    if (!filter) return [];
    return wrongRecords.filter(r => {
      if (filter.type === 'stack') return r.question.stackSize === filter.value;
      return r.question.heroPosition === filter.value;
    });
  }, [wrongRecords, filter]);

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
        <p className="text-gray-500">아직 푼 퀴즈가 없습니다. 먼저 퀴즈를 풀어보세요!</p>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate({ kind: 'quiz' })}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500"
          >
            퀴즈 시작
          </button>
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
      <h2 className="text-lg font-bold text-white">플레이어 프로파일</h2>

      <HeaderCard profile={profile} />

      <div className="w-full flex gap-1 bg-gray-800/40 rounded-lg p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlayStyleSection d={deviation} />
            <div className="bg-gray-800/30 rounded-lg p-3 flex flex-col items-center">
              <h3 className="text-sm font-medium text-gray-400 mb-2 self-start">에러 분포</h3>
              <ErrorDonut buckets={profile.errorBuckets} />
            </div>
          </div>

          <WeaknessSection analysis={profile.weaknessAnalysis} onNavigate={onNavigate} />
        </>
      )}

      {tab === 'accuracy' && (
        <>
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
        </>
      )}

      {tab === 'wrongs' && (
        <ErrorTable
          records={wrongRecords}
          onReview={r => onNavigate({ kind: 'review', question: r.question })}
        />
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
