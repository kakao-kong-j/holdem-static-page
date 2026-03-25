import { memo } from 'react';
import { RANKS } from '../constants';
import { getHandName, getCombos } from '../utils/hand';
import type { ColorDef } from '../types';

interface Props {
  handAction: Record<string, string>;
  colorMap: Record<string, ColorDef>;
}

const FOLD_COLOR: ColorDef = { bg: 'transparent', text: '#6b7280', label: '-' };
const cellSize = { width: 'clamp(28px, 5.5vw, 52px)', height: 'clamp(28px, 5.5vw, 52px)' };

export const RangeGrid = memo(function RangeGrid({ handAction, colorMap }: Props) {
  return (
    <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}>
      {RANKS.map((_, ri) =>
        RANKS.map((_, ci) => {
          const hand = getHandName(ri, ci);
          const combos = getCombos(ri, ci);
          const action = handAction[hand] ?? 'fold';
          const color = colorMap[action] ?? FOLD_COLOR;
          const isFold = action === 'fold';

          return (
            <div
              key={`${ri}-${ci}`}
              className="flex flex-col items-center justify-center rounded-sm cursor-default select-none transition-transform hover:scale-110 hover:z-10 relative"
              style={{
                ...cellSize,
                backgroundColor: color.bg || (isFold ? '#1f2937' : undefined),
                color: color.text,
                opacity: isFold ? 0.4 : 1,
              }}
              title={`${hand} (${combos} combos) - ${action}`}
            >
              <span className="text-[clamp(7px,1.3vw,11px)] font-bold leading-tight">{hand}</span>
              <span className="text-[clamp(6px,1.1vw,9px)] leading-tight opacity-80">{color.label}</span>
            </div>
          );
        })
      )}
    </div>
  );
});
