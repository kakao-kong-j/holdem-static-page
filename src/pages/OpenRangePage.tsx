import { useMemo } from 'react';
import { RangeGrid } from '../components/RangeGrid';
import { Legend, type LegendItem } from '../components/Legend';
import { OPEN_RANGE_POSITIONS, POSITION_COLORS } from '../constants';
import { buildOpenRangeData, forEachHand } from '../utils/hand';
import type { StackData, ColorDef } from '../types';

interface Props {
  stackData: StackData;
}

const positionColorMap: Record<string, ColorDef> = Object.fromEntries([
  ...OPEN_RANGE_POSITIONS.map(p => [p, { bg: POSITION_COLORS[p], text: '#fff', label: p }]),
  ['fold', { bg: 'transparent', text: '#6b7280', label: '-' }],
]);

export function OpenRangePage({ stackData }: Props) {
  const handPosition = useMemo(() => buildOpenRangeData(stackData), [stackData]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of OPEN_RANGE_POSITIONS) counts[p] = 0;
    let foldCount = 0;

    forEachHand((hand, combos) => {
      const pos = handPosition[hand];
      if (pos) counts[pos] += combos;
      else foldCount += combos;
    });

    const totalOpen = Object.values(counts).reduce((a, b) => a + b, 0);
    const epCount = (counts['UTG'] || 0) + (counts['UTG+1'] || 0) + (counts['UTG+2'] || 0);
    return { counts, foldCount, totalOpen, epCount };
  }, [handPosition]);

  const legendItems: LegendItem[] = [
    ...OPEN_RANGE_POSITIONS.map(p => ({ label: p, bg: POSITION_COLORS[p], count: stats.counts[p] || 0 })),
    { label: 'Fold', bg: '#374151', count: stats.foldCount },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4">
        <RangeGrid handAction={handPosition} colorMap={positionColorMap} />
      </div>

      <Legend items={legendItems} total={1326} />

      <div className="mt-3 flex flex-wrap gap-4 justify-center text-sm text-gray-300">
        <span>
          전체 오픈: <b className="text-white">{stats.totalOpen}</b> combos
          ({((stats.totalOpen / 1326) * 100).toFixed(1)}%)
        </span>
        <span>
          EP 전용 (UTG~UTG+2): <b className="text-white">{stats.epCount}</b> combos
        </span>
        <span>
          Fold: <b className="text-white">{stats.foldCount}</b> combos
        </span>
      </div>
    </div>
  );
}
