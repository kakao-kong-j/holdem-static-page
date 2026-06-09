import { useCallback, useEffect, useMemo, useState } from 'react';
import { RangeGrid } from './RangeGrid';
import { OPEN_RANGE_POSITIONS, SB_RFI_BVB_CHART, SB_RFI_CHART, STACK_SIZES } from '../constants';
import { buildHandAction, buildOpenRangeData } from '../utils/hand';
import {
  buildAnswerTitles,
  buildUserOpenRange,
  compareSummary,
  computeAnswerBorders,
  computeRecordBorders,
  recordSummary,
  COMPARE_ACTION_COLORMAP,
  COMPARE_OPEN_RANGE_COLORMAP,
  fillUnanswered,
  latestRecordsByHand,
  latestUserAnswersByHand,
  maskMismatchesOnly,
} from '../utils/compare';
import {
  buildScenarioMap,
  getHeroPositions,
  getScenarios,
  getVillainOptions,
  type ScenarioCategory,
} from '../utils/scenarioMap';
import type { AllData, QuizRecord, StackSize } from '../types';

type Mode = 'open-range' | 'sb-open' | 'facing';

const MODES: { key: Mode; label: string }[] = [
  { key: 'open-range', label: 'Open Range' },
  { key: 'sb-open', label: 'SB Open' },
  { key: 'facing', label: 'Facing Charts' },
];

const FACING_CATEGORY: ScenarioCategory = '상대 오픈 대응';

function resolveSbOpenChart(
  stackData: Record<string, Record<string, string[]>>,
): string | null {
  const simple = stackData[SB_RFI_CHART];
  const bvb = stackData[SB_RFI_BVB_CHART];
  if (bvb && Object.keys(bvb).length > Object.keys(simple ?? {}).length) {
    return SB_RFI_BVB_CHART;
  }
  if (simple) return SB_RFI_CHART;
  if (bvb) return SB_RFI_BVB_CHART;
  return null;
}

interface Props {
  data: AllData;
  records: QuizRecord[];
}

export function QuizCompareSection({ data, records }: Props) {
  const [mode, setMode] = useState<Mode>('open-range');
  const [stack, setStack] = useState<StackSize>('100BB');
  const [onlyWrong, setOnlyWrong] = useState(false);

  const stackData = data[stack];

  const sbOpenChart = useMemo(() => resolveSbOpenChart(stackData), [stackData]);

  const scenarioMap = useMemo(() => buildScenarioMap(stackData), [stackData]);

  const heroPositions = useMemo(
    () => getHeroPositions(scenarioMap, FACING_CATEGORY),
    [scenarioMap],
  );

  const [hero, setHero] = useState('');
  const [villain, setVillain] = useState('');
  const [selectedChart, setSelectedChart] = useState('');

  useEffect(() => {
    if (!heroPositions.includes(hero)) {
      setHero(heroPositions[0] ?? '');
    }
  }, [heroPositions, hero]);

  const villainOptions = useMemo(
    () => (hero ? getVillainOptions(scenarioMap, hero, FACING_CATEGORY) : []),
    [scenarioMap, hero],
  );

  useEffect(() => {
    if (!villainOptions.includes(villain)) {
      setVillain(villainOptions[0] ?? '');
    }
  }, [villainOptions, villain]);

  const scenarios = useMemo(() => {
    if (!hero || !villain) return [];
    return getScenarios(scenarioMap, hero, villain, FACING_CATEGORY);
  }, [scenarioMap, hero, villain]);

  useEffect(() => {
    if (!scenarios.some(s => s.chartName === selectedChart)) {
      setSelectedChart(scenarios[0]?.chartName ?? '');
    }
  }, [scenarios, selectedChart]);

  const view = useMemo(() => {
    if (mode === 'open-range') {
      return {
        left: buildOpenRangeData(stackData),
        right: buildUserOpenRange(records, stack),
        colorMap: COMPARE_OPEN_RANGE_COLORMAP,
        title: `${stack} · Open Range`,
      };
    }

    if (mode === 'sb-open') {
      const chart = sbOpenChart ? stackData[sbOpenChart] : undefined;
      return {
        left: chart ? buildHandAction(chart) : {},
        right: fillUnanswered(
          sbOpenChart ? latestUserAnswersByHand(records, stack, sbOpenChart) : {},
        ),
        colorMap: COMPARE_ACTION_COLORMAP,
        title: sbOpenChart ? `${stack} · ${sbOpenChart}` : `${stack} · SB Open`,
        missing: !chart,
      };
    }

    const chart = selectedChart ? stackData[selectedChart] : undefined;
    return {
      left: chart ? buildHandAction(chart) : {},
      right: selectedChart
        ? fillUnanswered(latestUserAnswersByHand(records, stack, selectedChart))
        : fillUnanswered({}),
      colorMap: COMPARE_ACTION_COLORMAP,
      title: selectedChart ? `${stack} · ${selectedChart}` : `${stack} · 차트 선택`,
      missing: !chart,
    };
  }, [mode, stack, stackData, records, selectedChart, sbOpenChart]);

  const rightRecords = useMemo(() => {
    if (mode === 'open-range') {
      const rfiCharts = new Set(OPEN_RANGE_POSITIONS.map(p => `${p} RFI`));
      return latestRecordsByHand(
        records,
        r => r.question.stackSize === stack && rfiCharts.has(r.question.chartName),
      );
    }
    const targetChart = mode === 'sb-open' ? sbOpenChart : selectedChart;
    if (!targetChart) return {};
    return latestRecordsByHand(
      records,
      r => r.question.stackSize === stack && r.question.chartName === targetChart,
    );
  }, [mode, stack, records, selectedChart, sbOpenChart]);

  const summary = useMemo(
    () =>
      mode === 'open-range'
        ? recordSummary(rightRecords)
        : compareSummary(view.left, view.right),
    [mode, rightRecords, view.left, view.right],
  );

  const displayed = useMemo(
    () => (onlyWrong ? maskMismatchesOnly(view.left, view.right) : view),
    [onlyWrong, view],
  );

  const rightBorders = useMemo(
    () =>
      mode === 'open-range'
        ? computeRecordBorders(rightRecords, displayed.right)
        : computeAnswerBorders(displayed.left, displayed.right),
    [mode, rightRecords, displayed],
  );

  const rightTitles = useMemo(() => buildAnswerTitles(rightRecords), [rightRecords]);

  const [hoveredHand, setHoveredHand] = useState<string | null>(null);

  const handleRightHover = useCallback((hand: string | null) => {
    setHoveredHand(hand);
  }, []);

  const hoveredRecord = hoveredHand ? rightRecords[hoveredHand] : undefined;

  const selectClass =
    'bg-gray-800 text-gray-200 rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none';

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="flex gap-1.5 flex-wrap justify-center">
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              mode === m.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap justify-center">
        {STACK_SIZES.map(s => (
          <button
            key={s}
            onClick={() => setStack(s)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              stack === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {mode === 'facing' && (
        <>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">나</label>
              <select
                value={hero}
                onChange={e => setHero(e.target.value)}
                className={selectClass}
              >
                {heroPositions.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <span className="text-gray-500 font-bold">vs</span>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">빌런</label>
              <select
                value={villain}
                onChange={e => setVillain(e.target.value)}
                className={selectClass}
              >
                {villainOptions.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          {scenarios.length > 1 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {scenarios.map(s => (
                <button
                  key={s.chartName}
                  onClick={() => setSelectedChart(s.chartName)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    selectedChart === s.chartName
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                  title={s.chartName}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-white">{view.title}</h3>
        <button
          onClick={() => setOnlyWrong(v => !v)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            onlyWrong
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          오답만 보기
        </button>
      </div>

      <div className="min-h-[56px] px-3 py-2 rounded bg-gray-800/60 border border-gray-700 text-xs text-gray-300 w-full max-w-xl">
        {hoveredRecord ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm">{hoveredRecord.question.hand}</span>
              <span className="text-gray-400">·</span>
              <span>{hoveredRecord.question.stackSize}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-200">{hoveredRecord.question.chartName}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-400">나:</span>
              <span className="font-semibold text-white">{hoveredRecord.question.heroPosition || '-'}</span>
              {hoveredRecord.question.villainPosition && (
                <>
                  <span className="text-gray-400">vs 빌런:</span>
                  <span className="font-semibold text-white">{hoveredRecord.question.villainPosition}</span>
                </>
              )}
              <span className="text-gray-400">·</span>
              <span className="text-gray-400">내 답변:</span>
              <span className={`font-semibold ${hoveredRecord.correct ? 'text-emerald-400' : 'text-red-400'}`}>
                {hoveredRecord.userAnswer}
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-400">정답:</span>
              <span className="font-semibold text-white">{hoveredRecord.question.correctAction}</span>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 italic">내 답변 셀에 마우스를 올리면 퀴즈 정보가 표시됩니다</div>
        )}
      </div>

      {view.missing ? (
        <div className="text-gray-500 py-8 text-sm">
          해당 스팟의 차트 데이터가 없습니다
        </div>
      ) : (
        <div className="w-full flex flex-wrap gap-4 justify-center items-start">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-medium text-gray-400">GTO</span>
            <RangeGrid
              handAction={displayed.left}
              colorMap={view.colorMap}
              highlightedHand={hoveredHand}
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-medium text-gray-400">내 답변</span>
            <RangeGrid
              handAction={displayed.right}
              colorMap={view.colorMap}
              borderColor={rightBorders}
              onHoverHand={handleRightHover}
              handTitles={rightTitles}
            />
          </div>
        </div>
      )}

      <div className="text-sm text-gray-300 flex gap-4 flex-wrap justify-center">
        <span>
          응답 <b className="text-white">{summary.answered}</b> / {summary.total}
        </span>
        <span className="text-emerald-400">
          일치 <b>{summary.matched}</b>
        </span>
        <span className="text-red-400">
          불일치 <b>{summary.mismatched}</b>
        </span>
      </div>
    </div>
  );
}
