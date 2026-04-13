import type { ErrorBucket, ErrorBuckets } from '../utils/analyzeQuizResults';

interface Props {
  buckets: ErrorBuckets;
  size?: number;
}

const BUCKET_META: { key: Exclude<ErrorBucket, 'other'>; label: string; color: string }[] = [
  { key: 'tooTight_BB',    label: 'BB 과폴드',    color: '#60a5fa' },
  { key: 'tooTight_RFI',   label: 'RFI 과폴드',   color: '#38bdf8' },
  { key: 'missedBluff',    label: '블러프 놓침',   color: '#a78bfa' },
  { key: 'tooLoose',       label: '과플레이',     color: '#fb923c' },
  { key: 'tooPassive',     label: '패시브',       color: '#fbbf24' },
  { key: 'overAggressive', label: '과공격',       color: '#f87171' },
];

export function ErrorDonut({ buckets, size = 200 }: Props) {
  const counts = BUCKET_META.map(m => ({ ...m, count: buckets[m.key].length }));
  const total = counts.reduce((a, b) => a + b.count, 0);

  const center = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.26;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-gray-500 text-xs" style={{ height: size }}>
        <div className="rounded-full border-2 border-dashed border-gray-700" style={{ width: outerR * 2, height: outerR * 2 }} />
        <div className="mt-2">에러 없음</div>
      </div>
    );
  }

  // Build SVG arc segments (compute start angles first so map stays pure)
  const startAngles: number[] = [];
  {
    let acc = -Math.PI / 2;
    for (const c of counts) {
      startAngles.push(acc);
      acc += (c.count / total) * Math.PI * 2;
    }
  }
  const segments = counts.map((c, i) => {
    if (c.count === 0) return null;
    const sliceAngle = (c.count / total) * Math.PI * 2;
    const start = startAngles[i];
    const endAngle = start + sliceAngle;
    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const x1 = center + outerR * Math.cos(start);
    const y1 = center + outerR * Math.sin(start);
    const x2 = center + outerR * Math.cos(endAngle);
    const y2 = center + outerR * Math.sin(endAngle);
    const x3 = center + innerR * Math.cos(endAngle);
    const y3 = center + innerR * Math.sin(endAngle);
    const x4 = center + innerR * Math.cos(start);
    const y4 = center + innerR * Math.sin(start);

    const d = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      'Z',
    ].join(' ');

    return { key: c.key, label: c.label, color: c.color, count: c.count, d };
  });

  return (
    <div className="flex flex-col items-center w-full">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }} className="w-full">
        {segments.map(s => s && (
          <path key={s.key} d={s.d} fill={s.color} stroke="#111827" strokeWidth="1" />
        ))}
        <text x={center} y={center - 4} textAnchor="middle" fontSize="22" fill="#e5e7eb" fontWeight="700">
          {total}
        </text>
        <text x={center} y={center + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">
          총 오답
        </text>
      </svg>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-xs w-full">
        {counts.map(c => (
          <div key={c.key} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
            <span className="text-gray-400 flex-1 truncate">{c.label}</span>
            <span className={`font-medium ${c.count === 0 ? 'text-gray-600' : 'text-gray-300'}`}>
              {c.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
