import { STACK_SIZES } from '../constants';
import type { StackSize } from '../types';

interface Props {
  selected: StackSize;
  onChange: (s: StackSize) => void;
  disabledStacks?: StackSize[];
}

export function StackTabs({ selected, onChange, disabledStacks }: Props) {
  return (
    <div className="flex gap-1">
      {STACK_SIZES.map(s => {
        const disabled = disabledStacks?.includes(s) ?? false;
        return (
          <button
            key={s}
            onClick={() => !disabled && onChange(s)}
            disabled={disabled}
            className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${
              disabled
                ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
                : selected === s
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
