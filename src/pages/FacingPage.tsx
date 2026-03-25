import { useState, useMemo, useEffect } from 'react';
import { RangeGrid } from '../components/RangeGrid';
import { Legend, type LegendItem } from '../components/Legend';
import { ACTION_COLORS } from '../constants';
import { buildHandAction, forEachHand } from '../utils/hand';
import {
  buildScenarioMap,
  getVillainOptions,
  getScenarios,
  getRfiScenarios,
  type Scenario,
} from '../utils/scenarioMap';
import type { StackData } from '../types';

interface Props {
  stackData: StackData;
}

export function FacingPage({ stackData }: Props) {
  const scenarioMap = useMemo(() => buildScenarioMap(stackData), [stackData]);

  const [hero, setHero] = useState('');
  const [villain, setVillain] = useState('');
  const [selectedChart, setSelectedChart] = useState('');

  // hero 초기화 (마운트 시 또는 stackData 변경 시)
  useEffect(() => {
    if (!scenarioMap.heroPositions.includes(hero)) {
      setHero(scenarioMap.heroPositions[0] || '');
    }
  }, [scenarioMap, hero]);

  // hero 변경 → villain + selectedChart 일괄 리셋 (cascade 제거)
  useEffect(() => {
    const opts = getVillainOptions(scenarioMap, hero);
    const newVillain = opts.length > 0 ? opts[0] : '';
    setVillain(newVillain);

    const newScenarios = newVillain
      ? getScenarios(scenarioMap, hero, newVillain)
      : getRfiScenarios(scenarioMap, hero);
    setSelectedChart(newScenarios[0]?.chartName ?? '');
  }, [hero, scenarioMap]);

  // villain 변경 → selectedChart 리셋
  const villainOptions = useMemo(
    () => (hero ? getVillainOptions(scenarioMap, hero) : []),
    [scenarioMap, hero]
  );

  const scenarios: Scenario[] = useMemo(() => {
    if (!hero) return [];
    if (villain) return getScenarios(scenarioMap, hero, villain);
    return getRfiScenarios(scenarioMap, hero);
  }, [scenarioMap, hero, villain]);

  // villain이 사용자에 의해 변경될 때 chart 리셋
  const handleVillainChange = (v: string) => {
    setVillain(v);
    const newScenarios = v
      ? getScenarios(scenarioMap, hero, v)
      : getRfiScenarios(scenarioMap, hero);
    setSelectedChart(newScenarios[0]?.chartName ?? '');
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
      <div className="flex items-center gap-3 mb-4 flex-wrap justify-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400 font-medium">나</label>
          <select
            value={hero}
            onChange={e => setHero(e.target.value)}
            className={selectClass}
          >
            {scenarioMap.heroPositions.map(p => (
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
            <option value="">없음 (내가 오픈)</option>
            {villainOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

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
          {selectedChart
            ? `차트를 찾을 수 없습니다: "${selectedChart}"`
            : '포지션을 선택해주세요'}
        </div>
      )}
    </div>
  );
}
