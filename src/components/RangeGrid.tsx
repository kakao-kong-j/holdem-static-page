import { memo } from 'react';
import { RANKS } from '../constants';
import { getHandName, getCombos } from '../utils/hand';
import type { ColorDef } from '../types';

interface Props {
  handAction: Record<string, string>;
  colorMap: Record<string, ColorDef>;
  borderColor?: Record<string, string>;
  highlightedHand?: string | null;
  onHoverHand?: (hand: string | null) => void;
}

const FOLD_COLOR: ColorDef = { bg: 'transparent', text: '#6b7280', label: '-' };
const cellSize = { width: 'clamp(28px, 5.5vw, 52px)', height: 'clamp(28px, 5.5vw, 52px)' };

export const RangeGrid = memo(function RangeGrid({ handAction, colorMap, borderColor, highlightedHand, onHoverHand }: Props) {
  return (
    <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}>
      {RANKS.map((_, ri) =>
        RANKS.map((_, ci) => {
          const hand = getHandName(ri, ci);
          const combos = getCombos(ri, ci);
          const action = handAction[hand] ?? 'fold';
          const color = colorMap[action] ?? FOLD_COLOR;
          const isFold = action === 'fold';
          const border = borderColor?.[hand];
          const isHighlighted = highlightedHand === hand;

          return (
            <div
              key={`${ri}-${ci}`}
              className="flex flex-col items-center justify-center rounded-sm cursor-default select-none transition-transform hover:scale-110 hover:z-10 relative"
              style={{
                ...cellSize,
                backgroundColor: color.bg || (isFold ? '#1f2937' : undefined),
                color: color.text,
                opacity: isFold && !border && !isHighlighted ? 0.4 : 1,
                outline: isHighlighted
                  ? '3px solid #fbbf24'
                  : border ? `2px solid ${border}` : undefined,
                outlineOffset: isHighlighted ? '-3px' : border ? '-2px' : undefined,
                boxShadow: isHighlighted
                  ? '0 0 14px 3px rgba(251, 191, 36, 0.85)'
                  : undefined,
                transform: isHighlighted ? 'scale(1.35)' : undefined,
                zIndex: isHighlighted ? 20 : undefined,
              }}
              title={`${hand} (${combos} combos) - ${action}`}
              onMouseEnter={onHoverHand ? () => onHoverHand(hand) : undefined}
              onMouseLeave={onHoverHand ? () => onHoverHand(null) : undefined}
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
