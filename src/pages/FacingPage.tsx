import { useState, useMemo, useEffect } from 'react';
import { RangeGrid } from '../components/RangeGrid';
import { Legend, type LegendItem } from '../components/Legend';
import { ACTION_COLORS } from '../constants';
import { buildHandAction, forEachHand } from '../utils/hand';
import {
  buildScenarioMap,
  getHeroPositions,
  getVillainOptions,
  getScenarios,
  type ScenarioCategory,
  type Scenario,
} from '../utils/scenarioMap';
import type { StackData } from '../types';

interface Props {
  stackData: StackData;
}

export function FacingPage({ stackData }: Props) {
  const scenarioMap = useMemo(() => buildScenarioMap(stackData), [stackData]);

  const [category, setCategory] = useState<ScenarioCategory>('상대 오픈 대응');
  const [hero, setHero] = useState('');
  const [villain, setVillain] = useState('');
  const [selectedChart, setSelectedChart] = useState('');

  // 카테고리 유효성
  useEffect(() => {
    if (!scenarioMap.categories.includes(category)) {
      setCategory(scenarioMap.categories[0]);
    }
  }, [scenarioMap, category]);

  // 카테고리별 히어로 목록
  const heroPositions = useMemo(
    () => getHeroPositions(scenarioMap, category),
    [scenarioMap, category]
  );

  // 카테고리 변경 → 히어로 리셋
  useEffect(() => {
    if (!heroPositions.includes(hero)) {
      setHero(heroPositions[0] ?? '');
    }
  }, [heroPositions, hero]);

  // 히어로별 빌런 목록
  const villainOptions = useMemo(
    () => (hero ? getVillainOptions(scenarioMap, hero, category) : []),
    [scenarioMap, hero, category]
  );

  // 히어로 변경 → 빌런 + 차트 리셋
  useEffect(() => {
    const newVillain = villainOptions[0] ?? '';
    setVillain(newVillain);
    const s = newVillain ? getScenarios(scenarioMap, hero, newVillain, category) : [];
    setSelectedChart(s[0]?.chartName ?? '');
  }, [hero, villainOptions, scenarioMap, category]);

  const scenarios: Scenario[] = useMemo(() => {
    if (!hero || !villain) return [];
    return getScenarios(scenarioMap, hero, villain, category);
  }, [scenarioMap, hero, villain, category]);

  const handleVillainChange = (v: string) => {
    setVillain(v);
    const s = v ? getScenarios(scenarioMap, hero, v, category) : [];
    setSelectedChart(s[0]?.chartName ?? '');
  };

  const chartData = stackData[selectedChart];
  const handAction = useMemo(
    () => (chartData ? buildHandAction(chartData) : {}),
    [chartData]
  );

  const actionStats = useMemo(() => {
    const counts: Record<string, number> = {};
    forEachHand((hand, combos) => {
      const action = handAction[hand] ?? 'fold';
      counts[action] = (counts[action] || 0) + combos;
    });
    return counts;
  }, [handAction]);

  const legendItems: LegendItem[] = Object.entries(actionStats)
    .filter(([action]) => action !== 'fold')
    .map(([action, count]) => {
      const c = ACTION_COLORS[action] || ACTION_COLORS['fold'];
      return { label: `${c.label} ${action}`, bg: c.bg, count };
    });

  const totalNonFold = legendItems.reduce((a, b) => a + b.count, 0);

  const selectClass =
    'bg-gray-800 text-gray-200 rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none';

  return (
    <div className="flex flex-col items-center">
      {/* 상황 탭 */}
      <div className="flex gap-1.5 mb-4">
        {scenarioMap.categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              category === c
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 포지션 선택 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap justify-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400 font-medium">나</label>
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
          <label className="text-sm text-gray-400 font-medium">빌런</label>
          <select
            value={villain}
            onChange={e => handleVillainChange(e.target.value)}
            className={selectClass}
          >
            {villainOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 시나리오가 여러 개일 때 하위 선택 */}
      {scenarios.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
          {scenarios.map(s => (
            <button
              key={s.chartName}
              onClick={() => setSelectedChart(s.chartName)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                selectedChart === s.chartName
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
              }`}
              title={s.chartName}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {selectedChart && (
        <h3 className="text-base font-bold text-white mb-3">{selectedChart}</h3>
      )}

      {chartData ? (
        <>
          <RangeGrid handAction={handAction} colorMap={ACTION_COLORS} />
          <Legend items={legendItems} total={totalNonFold} />
          {actionStats['fold'] && (
            <div className="text-xs text-gray-500 mt-1">
              Fold: {actionStats['fold']} combos
            </div>
          )}
        </>
      ) : (
        <div className="text-gray-500 py-12">
          포지션을 선택해주세요
        </div>
      )}
    </div>
  );
}
