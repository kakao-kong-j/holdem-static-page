import { useState, useMemo, useRef } from 'react';
import { ACTION_COLORS, POSITION_COLORS } from '../constants';
import { RangeGrid } from '../components/RangeGrid';
import { Legend } from '../components/Legend';
import { Chip, ActionChip } from '../components/Chip';
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

function WrongListChips({
  records,
  data,
}: {
  records: QuizRecord[];
  data: AllData;
}) {
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
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {records.map((r, i) => {
          const correctColor = ACTION_COLORS[r.question.correctAction];
          const userColor = ACTION_COLORS[r.userAnswer];
          return (
            <Chip
              key={i}
              size="sm"
              selected={selectedIdx === i}
              onClick={() => setSelectedIdx(prev => (prev === i ? null : i))}
              title={r.question.situation}
              accent={correctColor?.bg}
              label={r.question.hand}
            >
              <ActionChip
                actionLabel={actionLabel(r.userAnswer)}
                actionBg={userColor?.bg || '#374151'}
                actionText={userColor?.text || '#d1d5db'}
                strike
              />
              <span className="text-gray-500">→</span>
              <ActionChip
                actionLabel={actionLabel(r.question.correctAction)}
                actionBg={correctColor?.bg || '#374151'}
                actionText={correctColor?.text || '#d1d5db'}
              />
            </Chip>
          );
        })}
      </div>
      {selected && chartData && (
        <ChartPreview chartData={chartData} chartName={selected.question.chartName} />
      )}
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

function deltaAccent(v: number | null): string | undefined {
  if (v === null) return undefined;
  if (v > 2) return '#fb923c'; // orange-400
  if (v < -2) return '#38bdf8'; // sky-400
  return '#6b7280'; // gray-500
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
      <div className="flex flex-wrap gap-1.5 mt-2">
        {axes.map(a => {
          const titleParts: string[] = [];
          if (a.value !== null) {
            titleParts.push(interpret(a.value, a.positiveLabel, a.negativeLabel));
          }
          if (a.userValue != null && a.gtoValue != null) {
            titleParts.push(`나 ${a.userValue.toFixed(1)}% vs GTO ${a.gtoValue.toFixed(1)}%`);
          }
          return (
            <Chip
              key={a.key}
              size="sm"
              accent={deltaAccent(a.value)}
              title={titleParts.join(' · ')}
              label={a.label}
              value={
                a.value === null ? (
                  <span className="text-gray-600">-</span>
                ) : (
                  <span className={`font-bold ${deltaColor(a.value)}`}>{formatDelta(a.value)}</span>
                )
              }
            />
          );
        })}
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

function severityInfo(severity: number): { label: string; accent: string; cls: string } {
  if (severity >= 0.66) return { label: '상', accent: '#f87171', cls: 'bg-red-900/60 text-red-300' };
  if (severity >= 0.33) return { label: '중', accent: '#facc15', cls: 'bg-yellow-900/60 text-yellow-300' };
  return { label: '하', accent: '#6b7280', cls: 'bg-gray-800/60 text-gray-400' };
}

function WeaknessChip({
  s,
  rank,
  onNavigate,
}: {
  s: WeaknessSummary;
  rank?: number;
  onNavigate: (i: NavigateIntent) => void;
}) {
  const sev = severityInfo(s.severity);
  const tooltip = [
    s.meta.description,
    s.meta.tag.length > 0 ? `태그: ${s.meta.tag.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <Chip
      size="sm"
      accent={sev.accent}
      title={tooltip}
      onClick={() =>
        onNavigate({
          kind: 'chart',
          stack: s.meta.chartLink.stack,
          chartName: s.meta.chartLink.chartName,
          viewType: s.meta.chartLink.viewType,
        })
      }
      label={
        <>
          {rank !== undefined && <span className="text-red-300 mr-1">#{rank}</span>}
          {s.meta.title}
        </>
      }
    >
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sev.cls}`}>{sev.label}</span>
      <span className="text-gray-500 text-[10px]">
        {s.errorCount}/{s.spotCount}
      </span>
    </Chip>
  );
}

function WeaknessAllChips({
  analysis,
  onNavigate,
  tagFilter,
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

  const grouped = useMemo(() => {
    const m: Record<string, typeof rows> = {};
    for (const r of rows) {
      const cat = r.meta.category;
      if (!m[cat]) m[cat] = [];
      m[cat].push(r);
    }
    return m;
  }, [rows]);

  const categories = Object.keys(grouped).sort();

  return (
    <div className="w-full space-y-2">
      {categories.map(cat => (
        <div key={cat}>
          <div className="text-[10px] text-gray-500 mb-1 font-medium">분류 {cat}</div>
          <div className="flex flex-wrap gap-1.5">
            {grouped[cat].map(r => {
              const sev = severityInfo(r.severity);
              const hasErrors = r.errorCount > 0;
              return (
                <Chip
                  key={r.id}
                  size="sm"
                  accent={hasErrors ? sev.accent : '#374151'}
                  title={r.meta.description}
                  onClick={() =>
                    onNavigate({
                      kind: 'chart',
                      stack: r.meta.chartLink.stack,
                      chartName: r.meta.chartLink.chartName,
                      viewType: r.meta.chartLink.viewType,
                    })
                  }
                  label={r.meta.title}
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      hasErrors ? sev.cls : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {sev.label}
                  </span>
                  <span
                    className={`text-[10px] ${hasErrors ? 'text-red-400 font-medium' : 'text-gray-600'}`}
                  >
                    {r.errorCount}/{r.spotCount}
                  </span>
                </Chip>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeaknessSection({
  analysis,
  onNavigate,
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
        <div className="flex flex-wrap gap-1.5">
          {analysis.top3.map(s => (
            <WeaknessChip key={s.weaknessId} s={s} rank={s.rank} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {showAll && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Chip
              size="xs"
              selected={tagFilter === null}
              onClick={() => setTagFilter(null)}
              label="전체"
            />
            {ALL_TAGS.map(t => (
              <Chip
                key={t}
                size="xs"
                selected={tagFilter === t}
                onClick={() => setTagFilter(t)}
                label={t}
              />
            ))}
          </div>
          <WeaknessAllChips analysis={analysis} onNavigate={onNavigate} tagFilter={tagFilter} />
        </>
      )}
    </div>
  );
}

function ErrorChips({
  records,
  onReview,
}: {
  records: QuizRecord[];
  onReview: (r: QuizRecord) => void;
}) {
  if (records.length === 0) return null;
  const shown = records.slice(0, 50);
  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-gray-400 mb-2">오답 목록 ({records.length}건)</h3>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((r, i) => {
          const correctColor = ACTION_COLORS[r.question.correctAction];
          const userColor = ACTION_COLORS[r.userAnswer];
          return (
            <Chip
              key={i}
              size="sm"
              accent={correctColor?.bg}
              title={r.question.situation || r.question.chartName}
              onClick={() => onReview(r)}
              label={
                <>
                  <span className="text-gray-500 font-mono mr-1">{r.question.stackSize}</span>
                  <span className="text-white">{r.question.hand}</span>
                </>
              }
            >
              <ActionChip
                actionLabel={actionLabel(r.userAnswer)}
                actionBg={userColor?.bg || '#374151'}
                actionText={userColor?.text || '#d1d5db'}
                strike
              />
              <span className="text-gray-500">→</span>
              <ActionChip
                actionLabel={actionLabel(r.question.correctAction)}
                actionBg={correctColor?.bg || '#374151'}
                actionText={correctColor?.text || '#d1d5db'}
              />
            </Chip>
          );
        })}
      </div>
      {records.length > 50 && (
        <div className="text-center text-xs text-gray-500 mt-2">
          최신 50건만 표시 (총 {records.length}건)
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

export function QuizStatsPage({ data, onNavigate }: QuizStatsPageProps) {
  const [records, setRecords] = useState<QuizRecord[]>(() => loadQuizRecords());
  const [filter, setFilter] = useState<Filter>(null);
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

      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlayStyleSection d={deviation} />
        <div className="bg-gray-800/30 rounded-lg p-3 flex flex-col items-center">
          <h3 className="text-sm font-medium text-gray-400 mb-2 self-start">에러 분포</h3>
          <ErrorDonut buckets={profile.errorBuckets} />
        </div>
      </div>

      <WeaknessSection analysis={profile.weaknessAnalysis} onNavigate={onNavigate} />

      <div className="w-full">
        <h3 className="text-sm font-medium text-gray-400 mb-2">스택별 정답률</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.stackBuckets).map(([stack, b]) => (
            <Chip
              key={stack}
              size="md"
              selected={filter?.type === 'stack' && filter.value === stack}
              onClick={() => toggleFilter('stack', stack)}
              label={<span className="font-mono">{stack}</span>}
              value={
                <>
                  <span className="text-white font-medium">{pct(b.correct, b.total)}</span>
                  <span className="text-gray-500 ml-1">({b.total})</span>
                </>
              }
            />
          ))}
        </div>
        {filter?.type === 'stack' && <WrongListChips key={filter.value} records={filteredWrong} data={data} />}
      </div>

      <div className="w-full">
        <h3 className="text-sm font-medium text-gray-400 mb-2">포지션별 정답률</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.posBuckets).map(([pos, b]) => (
            <Chip
              key={pos}
              size="md"
              accent={POSITION_COLORS[pos]}
              selected={filter?.type === 'position' && filter.value === pos}
              onClick={() => toggleFilter('position', pos)}
              label={pos}
              value={
                <>
                  <span className="text-white font-medium">{pct(b.correct, b.total)}</span>
                  <span className="text-gray-500 ml-1">({b.total})</span>
                </>
              }
            />
          ))}
        </div>
        {filter?.type === 'position' && <WrongListChips key={filter.value} records={filteredWrong} data={data} />}
      </div>

      {stats.topMisses.length > 0 && (
        <div className="w-full">
          <h3 className="text-sm font-medium text-gray-400 mb-2">자주 틀리는 핸드 TOP 10</h3>
          <div className="flex flex-wrap gap-1.5">
            {stats.topMisses.map((m, i) => {
              const color = ACTION_COLORS[m.correctAction];
              return (
                <Chip
                  key={i}
                  size="sm"
                  accent={color?.bg}
                  title={m.situation}
                  label={
                    <>
                      <span className="text-gray-500 mr-1">#{i + 1}</span>
                      <span className="text-white">{m.hand}</span>
                    </>
                  }
                >
                  <ActionChip
                    actionLabel={actionLabel(m.correctAction)}
                    actionBg={color?.bg || '#374151'}
                    actionText={color?.text || '#d1d5db'}
                  />
                  <span className="text-red-400 text-[10px]">{m.count}회</span>
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      {Object.keys(stats.confusion).length > 0 && (
        <div className="w-full">
          <h3 className="text-sm font-medium text-gray-400 mb-2">액션별 혼동 분석</h3>
          <div className="space-y-1.5">
            {Object.entries(stats.confusion).map(([correct, wrongMap]) => {
              const correctColor = ACTION_COLORS[correct];
              return (
                <div key={correct} className="flex flex-wrap items-center gap-1.5">
                  <Chip
                    size="sm"
                    accent={correctColor?.bg}
                    label={<span className="text-gray-500">정답</span>}
                  >
                    <ActionChip
                      actionLabel={actionLabel(correct)}
                      actionBg={correctColor?.bg || '#374151'}
                      actionText={correctColor?.text || '#d1d5db'}
                      size="sm"
                    />
                  </Chip>
                  <span className="text-gray-600 text-xs">→</span>
                  {Object.entries(wrongMap)
                    .sort((a, b) => b[1] - a[1])
                    .map(([wrong, count]) => {
                      const wrongColor = ACTION_COLORS[wrong];
                      return (
                        <Chip
                          key={wrong}
                          size="xs"
                          accent={wrongColor?.bg}
                          label={actionLabel(wrong)}
                          value={<span className="text-red-400">{count}회</span>}
                        />
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ErrorChips
        records={records.filter(r => !r.correct)}
        onReview={r => onNavigate({ kind: 'review', question: r.question })}
      />

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
