import { RANKS } from '../constants';
import { getHandName } from '../utils/hand';
import {
  getCashActionGradient,
  getCashActionLabel,
  getCashActions,
  type CashScenario,
} from '../utils/cashRange';

interface Props {
  scenario: CashScenario;
  highlightedHand: string | null;
}

const cellSize = { width: 'clamp(28px, 5.5vw, 52px)', height: 'clamp(28px, 5.5vw, 52px)' };

function shortAction(action: string): string {
  if (action.startsWith('raise_')) return 'R';
  if (action.startsWith('all_in_')) return 'AI';
  return ({ call: 'C', fold: 'F', check: 'X' } as Record<string, string>)[action] ?? action;
}

export function CashRangeGrid({ scenario, highlightedHand }: Props) {
  return (
    <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(13, 1fr)' }} role="list" aria-label="캐시 핸드레인지 차트">
      {RANKS.map((_, row) => RANKS.map((__, column) => {
        const hand = getHandName(row, column);
        const frequencies = scenario.hands[hand] ?? {};
        const actions = getCashActions(frequencies);
        const highlighted = highlightedHand === hand;
        const details = actions.length > 0
          ? actions.map(({ action, frequency }) => `${getCashActionLabel(action)} ${frequency}%`).join(', ')
          : '데이터 없음';
        const compact = actions
          .map(({ action, frequency }) => `${shortAction(action)}${frequency}`)
          .join('/');

        return (
          <div
            key={hand}
            data-hand={hand}
            data-highlighted={highlighted ? 'true' : 'false'}
            role="listitem"
            aria-label={`${hand} — ${details}`}
            className="flex flex-col items-center justify-center rounded-sm select-none relative"
            style={{
              ...cellSize,
              backgroundImage: getCashActionGradient(frequencies),
              color: '#fff',
              outline: highlighted ? '3px solid #fbbf24' : undefined,
              outlineOffset: highlighted ? '-3px' : undefined,
              boxShadow: highlighted ? '0 0 14px 3px rgba(251, 191, 36, 0.85)' : undefined,
              transform: highlighted ? 'scale(1.25)' : undefined,
              zIndex: highlighted ? 20 : undefined,
            }}
            title={`${hand} — ${details}`}
          >
            <span className="text-[clamp(7px,1.3vw,11px)] font-bold leading-tight">{hand}</span>
            <span className="text-[clamp(5px,0.9vw,8px)] leading-tight opacity-90">{compact}</span>
          </div>
        );
      }))}
    </div>
  );
}
