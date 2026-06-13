import type { TagRow } from '../utils/bankroll';
import { formatUsd } from '../utils/bankroll';

interface Props { rows: TagRow[]; }

const W = 720;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 48, left: 44 };

export function TagPerformanceChart({ rows }: Props) {
  if (rows.length === 0) {
    return <div className="text-gray-500 text-sm py-8 text-center">데이터 없음</div>;
  }
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const profits = rows.map(r => r.profit);
  const min = Math.min(0, ...profits);
  const max = Math.max(0, ...profits);
  const span = max - min || 1;
  const zeroY = PAD.top + innerH - ((0 - min) / span) * innerH;
  const slot = innerW / rows.length;
  const barW = Math.min(48, slot * 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="#374151" />
      {rows.map((r, i) => {
        const cx = PAD.left + slot * i + slot / 2;
        const v = PAD.top + innerH - ((r.profit - min) / span) * innerH;
        const top = Math.min(v, zeroY);
        const h = Math.abs(v - zeroY) || 1;
        return (
          <g key={r.tag}>
            <rect x={cx - barW / 2} y={top} width={barW} height={h}
              fill={r.profit >= 0 ? '#16a34a' : '#dc2626'} rx={2} />
            <text x={cx} y={H - 28} textAnchor="middle" className="fill-gray-400 text-[10px]">
              {r.tag}
            </text>
            <text x={cx} y={H - 14} textAnchor="middle" className="fill-gray-500 text-[9px]">
              {formatUsd(r.profit)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
