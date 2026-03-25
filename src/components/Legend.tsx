export interface LegendItem {
  label: string;
  bg: string;
  count: number;
}

interface Props {
  items: LegendItem[];
  total: number;
}

export function Legend({ items, total }: Props) {
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-4">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-300">
          <div
            className="w-4 h-4 rounded-sm flex-shrink-0"
            style={{ backgroundColor: item.bg || '#1f2937' }}
          />
          <span>{item.label}</span>
          <span className="text-gray-500">{item.count}</span>
        </div>
      ))}
      {total > 0 && (
        <div className="text-xs text-gray-500 ml-2">
          합계: {total} combos
        </div>
      )}
    </div>
  );
}
