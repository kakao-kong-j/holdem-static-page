import { STACK_SIZES } from '../constants';
import type { StackSize } from '../types';

interface Props {
  selected: StackSize;
  onChange: (s: StackSize) => void;
}

export function StackTabs({ selected, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {STACK_SIZES.map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${
            selected === s
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
