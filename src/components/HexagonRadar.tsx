import { useState } from 'react';

export interface HexagonAxis {
  key: string;
  label: string;
  value: number | null;
  positiveLabel: string;
  negativeLabel: string;
  sampleSize: number;
  description: string;
  userValue: number | null;
  gtoValue: number | null;
  unit?: string;
}

interface Props {
  axes: HexagonAxis[];
  cap?: number;
  size?: number;
}

function formatPct(v: number | null, unit = '%'): string {
  if (v === null) return '—';
  return `${v.toFixed(1)}${unit}`;
}

function formatDelta(v: number | null): string {
  if (v === null) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%p`;
}

function anchorForAngle(angle: number): 'start' | 'middle' | 'end' {
  const cx = Math.cos(angle);
  if (cx > 0.2) return 'start';
  if (cx < -0.2) return 'end';
  return 'middle';
}

export function HexagonRadar({ axes, cap = 20, size = 280 }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const center = size / 2;
  const outerR = size * 0.34;
  const midR = outerR / 2;
  const labelR = outerR + size * 0.06;
  // extra horizontal padding so long labels like "Fold to Steal" fit
  const padX = size * 0.18;
  const padY = size * 0.06;

  const angles = axes.map((_, i) => -Math.PI / 2 + (i * Math.PI) / 3);

  const toPoint = (angle: number, r: number) => ({
    x: center + r * Math.cos(angle),
    y: center + r * Math.sin(angle),
  });

  const radiusForDelta = (d: number | null): number => {
    if (d === null) return midR;
    const clamped = Math.max(-cap, Math.min(cap, d));
    return ((clamped + cap) / (2 * cap)) * outerR;
  };

  const outerPoints = angles.map(a => toPoint(a, outerR));
  const midPoints = angles.map(a => toPoint(a, midR));
  const userPoints = angles.map((a, i) => toPoint(a, radiusForDelta(axes[i].value)));

  const ptStr = (pts: { x: number; y: number }[]) =>
    pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const hovered = hoveredIdx !== null ? axes[hoveredIdx] : null;

  return (
    <div className="relative w-full max-w-sm">
      <svg
        viewBox={`${-padX} ${-padY} ${size + 2 * padX} ${size + 2 * padY}`}
        className="w-full"
      >
        <polygon points={ptStr(outerPoints)} fill="none" stroke="#374151" strokeWidth="1" />
        <polygon
          points={ptStr(angles.map(a => toPoint(a, outerR * 0.25)))}
          fill="none" stroke="#374151" strokeWidth="0.5" strokeDasharray="2 2"
        />
        <polygon points={ptStr(midPoints)} fill="none" stroke="#6b7280" strokeWidth="1" strokeDasharray="3 3" />
        <polygon
          points={ptStr(angles.map(a => toPoint(a, outerR * 0.75)))}
          fill="none" stroke="#374151" strokeWidth="0.5" strokeDasharray="2 2"
        />

        {angles.map((a, i) => {
          const o = toPoint(a, outerR);
          return (
            <line key={i} x1={center} y1={center} x2={o.x} y2={o.y} stroke="#374151" strokeWidth="0.5" />
          );
        })}

        <polygon
          points={ptStr(userPoints)}
          fill="rgba(99, 102, 241, 0.25)"
          stroke="#818cf8"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {userPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 5 : 3}
            fill={axes[i].value === null ? '#4b5563' : '#818cf8'}
          />
        ))}

        {angles.map((a, i) => {
          const p = toPoint(a, labelR);
          const v = axes[i].value;
          const sign = v === null ? '' : v > 0 ? '+' : '';
          const valStr = v === null ? '—' : `${sign}${v.toFixed(1)}%`;
          const anchor = anchorForAngle(a);
          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onTouchStart={() => setHoveredIdx(prev => (prev === i ? null : i))}
              className="cursor-pointer"
            >
              <circle cx={p.x} cy={p.y} r="22" fill="transparent" />
              <text
                x={p.x} y={p.y - 4}
                textAnchor={anchor} fontSize="11"
                fill={hoveredIdx === i ? '#e5e7eb' : '#9ca3af'}
                fontWeight={hoveredIdx === i ? '600' : '500'}
              >
                {axes[i].label}
              </text>
              <text
                x={p.x} y={p.y + 10}
                textAnchor={anchor} fontSize="10"
                fill={v === null ? '#6b7280' : v > 2 ? '#fb923c' : v < -2 ? '#38bdf8' : '#d1d5db'}
              >
                {valStr}
              </text>
            </g>
          );
        })}

        <text x={center} y={center - midR + 4} textAnchor="middle" fontSize="9" fill="#6b7280">GTO</text>
      </svg>

      {hovered && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-lg z-10">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-white font-bold text-sm">{hovered.label}</span>
            <span className={`font-bold ${
              hovered.value === null ? 'text-gray-500' :
              hovered.value > 2 ? 'text-orange-400' :
              hovered.value < -2 ? 'text-sky-400' : 'text-gray-300'
            }`}>
              {formatDelta(hovered.value)}
            </span>
          </div>
          <div className="text-gray-400 mb-2">{hovered.description}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-800/50 rounded px-2 py-1">
              <div className="text-gray-500">내 값</div>
              <div className="text-white font-medium">{formatPct(hovered.userValue, hovered.unit)}</div>
            </div>
            <div className="bg-gray-800/50 rounded px-2 py-1">
              <div className="text-gray-500">GTO 값</div>
              <div className="text-white font-medium">{formatPct(hovered.gtoValue, hovered.unit)}</div>
            </div>
          </div>
          <div className="text-gray-600 text-[10px] mt-1.5">샘플 {hovered.sampleSize}건</div>
        </div>
      )}
    </div>
  );
}
