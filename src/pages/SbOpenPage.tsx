import { useMemo } from 'react';
import { RangeGrid } from '../components/RangeGrid';
import { Legend } from '../components/Legend';
import { ACTION_COLORS, SB_RFI_CHART, SB_RFI_BVB_CHART } from '../constants';
import { buildHandAction, buildActionStats } from '../utils/hand';
import type { StackData } from '../types';

interface Props {
  stackData: StackData;
}

export function SbOpenPage({ stackData }: Props) {
  // Prefer the BvB chart when it exposes more action types than the simple one
  // (e.g. 25BB has 6-action limp/raise breakdown vs 3-action simple chart).
  const simple = stackData[SB_RFI_CHART];
  const bvb = stackData[SB_RFI_BVB_CHART];
  const chartData =
    bvb && Object.keys(bvb).length > Object.keys(simple ?? {}).length
      ? bvb
      : simple;

  const handAction = useMemo(
    () => (chartData ? buildHandAction(chartData) : {}),
    [chartData]
  );

  const { actionStats, legendItems, totalNonFold } = useMemo(
    () => buildActionStats(handAction),
    [handAction]
  );

  if (!chartData) {
    return <div className="text-gray-500 py-12 text-center">SB RFI 데이터가 없습니다</div>;
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4">
        <RangeGrid handAction={handAction} colorMap={ACTION_COLORS} />
      </div>

      <Legend items={legendItems} total={totalNonFold} />

      <div className="mt-3 flex flex-wrap gap-4 justify-center text-sm text-gray-300">
        <span>
          오픈: <b className="text-white">{totalNonFold}</b> combos
          ({((totalNonFold / 1326) * 100).toFixed(1)}%)
        </span>
        <span>
          Fold: <b className="text-white">{actionStats['fold'] || 0}</b> combos
        </span>
      </div>
    </div>
  );
}
