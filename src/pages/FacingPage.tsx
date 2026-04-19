import { useState, useMemo, useEffect } from 'react';
import { RangeGrid } from '../components/RangeGrid';
import { Legend } from '../components/Legend';
import { ACTION_COLORS } from '../constants';
import { buildHandAction, buildActionStats } from '../utils/hand';
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

  // 통계 페이지에서 넘어온 pendingChart를 마운트 시점에 초기 상태로 적용
  // (effect 캐스케이드가 덮어쓰지 못하도록 useState 초기값으로 직접 주입)
  const [initialFromPending] = useState<{
    cat: ScenarioCategory; h: string; v: string; chartName: string;
  } | null>(() => {
    const pending = sessionStorage.getItem('pendingChart');
    if (!pending) return null;
    sessionStorage.removeItem('pendingChart');
    try {
      const { chartName } = JSON.parse(pending) as { chartName: string };
      if (!chartName) return null;
      for (const cat of scenarioMap.categories) {
        for (const h of getHeroPositions(scenarioMap, cat)) {
          for (const v of getVillainOptions(scenarioMap, h, cat)) {
            if (getScenarios(scenarioMap, h, v, cat).some(s => s.chartName === chartName)) {
              return { cat, h, v, chartName };
            }
          }
        }
      }
    } catch { /* ignore */ }
    return null;
  });

  const [category, setCategory] = useState<ScenarioCategory>(
    initialFromPending?.cat ?? '상대 오픈 대응'
  );
  const [hero, setHero] = useState(initialFromPending?.h ?? '');
  const [villain, setVillain] = useState(initialFromPending?.v ?? '');
  const [selectedChart, setSelectedChart] = useState(initialFromPending?.chartName ?? '');

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

  // 히어로 유효성: 현재 hero가 새 목록에 없으면만 첫 항목으로
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

  // 빌런 유효성: 현재 villain이 새 목록에 없으면만 첫 항목으로
  useEffect(() => {
    if (!villainOptions.includes(villain)) {
      setVillain(villainOptions[0] ?? '');
    }
  }, [villainOptions, villain]);

  // 차트 유효성: 현재 selectedChart가 (hero, villain, category) 시나리오 안에 없으면만 첫 항목으로
  useEffect(() => {
    if (!hero || !villain) return;
    const s = getScenarios(scenarioMap, hero, villain, category);
    if (!s.some(x => x.chartName === selectedChart)) {
      setSelectedChart(s[0]?.chartName ?? '');
    }
  }, [scenarioMap, hero, villain, category, selectedChart]);

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

  const { actionStats, legendItems, totalNonFold } = useMemo(
    () => buildActionStats(handAction),
    [handAction]
  );

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
