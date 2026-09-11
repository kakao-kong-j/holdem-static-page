export interface BencbLegend {
  id: string;
  color: string;
  label: string | null;
  combo_count: number;
  source_percent?: number;
}

export interface BencbChart {
  id: string;
  category: string;
  subcategory: string;
  scenario: string;
  source: string;
  legend: BencbLegend[];
  hands: Record<string, Record<string, number>>;
  total_marked_combos: number;
  mixed_hands: string[];
}

export interface BencbData {
  schema_version: number;
  charts: BencbChart[];
  incomplete_sources: { source: string }[];
}

export const BENCB_DATA_URL = `${import.meta.env.BASE_URL}bencb-preflop-charts.json`;

export function legendLabel(chart: BencbChart, id: string): string {
  if (id === 'unmarked') return '미표시';
  return chart.legend.find(entry => entry.id === id)?.label ?? '범례 없음';
}

export function handBackground(chart: BencbChart, hand: string): string {
  let offset = 0;
  const stops = Object.entries(chart.hands[hand]).map(([id, weight]) => {
    const color = id === 'unmarked' ? '#ffffff' : chart.legend.find(entry => entry.id === id)?.color ?? '#ffffff';
    const start = offset;
    offset += weight * 100;
    return `${color} ${start}% ${offset}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export function percent(weight: number): string {
  return `${Number((weight * 100).toFixed(2))}%`;
}
