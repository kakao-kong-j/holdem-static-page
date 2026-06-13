import { useState } from 'react';
import type { TrendPoint } from '../utils/bankroll';
import { formatUsd } from '../utils/bankroll';

interface Props { points: TrendPoint[]; }

const W = 720;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

export function BankrollTrendChart({ points }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) {
    return <div className="text-gray-500 text-sm py-8 text-center">데이터 없음</div>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const values = points.map(p => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - min) / span) * innerH;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const zeroY = y(0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* zero baseline */}
        <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
          stroke="#374151" strokeDasharray="4 4" />
        <text x={PAD.left - 6} y={zeroY + 4} textAnchor="end" className="fill-gray-500 text-[10px]">0</text>
        {/* line */}
        <path d={path} fill="none" stroke="#6366f1" strokeWidth={2} />
        {/* markers */}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 4 : 2.5}
            fill="#fff" stroke="#6366f1" strokeWidth={1.5}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
        {/* x labels: first / mid / last */}
        {[0, Math.floor(points.length / 2), points.length - 1]
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-gray-500 text-[10px]">
              {points[i].datetime.slice(0, 10)}
            </text>
          ))}
      </svg>
      {hover !== null && (
        <div className="absolute top-2 left-12 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs pointer-events-none">
          <div className="text-gray-300">{points[hover].datetime.slice(0, 10)}</div>
          <div className="text-indigo-300">bankroll : {formatUsd(points[hover].value)}</div>
        </div>
      )}
    </div>
  );
}
