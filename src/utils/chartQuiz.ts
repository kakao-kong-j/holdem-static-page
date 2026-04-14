import type { ColorDef, QuizRecord, StackData, StackSize } from '../types';
import { ACTION_COLORS } from '../constants';
import { forEachHand } from './hand';
import { parseChartScenario } from './quiz';

export type SpotCategory = 'open-range' | 'facing' | 'other';

export interface SpotOption {
  chartName: string;
  label: string;
  category: SpotCategory;
  heroPosition: string;
  villainPosition: string;
  situation: string;
}

const CATEGORY_LABEL: Record<SpotCategory, string> = {
  'open-range': '오픈 레인지',
  facing: 'Facing',
  other: '기타',
};

export function getCategoryLabel(c: SpotCategory): string {
  return CATEGORY_LABEL[c];
}

export function getSpotOptions(stackData: StackData): SpotOption[] {
  const options: SpotOption[] = [];
  for (const chartName of Object.keys(stackData)) {
    const parsed = parseChartScenario(chartName);
    if (parsed) {
      options.push({
        chartName,
        label: parsed.situation,
        category: parsed.chartType,
        heroPosition: parsed.heroPosition,
        villainPosition: parsed.villainPosition,
        situation: parsed.situation,
      });
    } else {
      options.push({
        chartName,
        label: chartName,
        category: 'other',
        heroPosition: '',
        villainPosition: '',
        situation: chartName,
      });
    }
  }
  return options;
}

export function groupSpotsByCategory(
  spots: SpotOption[],
): Array<{ category: SpotCategory; label: string; items: SpotOption[] }> {
  const order: SpotCategory[] = ['open-range', 'facing', 'other'];
  return order
    .map(category => ({
      category,
      label: CATEGORY_LABEL[category],
      items: spots
        .filter(s => s.category === category)
        .sort((a, b) => a.label.localeCompare(b.label, 'ko')),
    }))
    .filter(g => g.items.length > 0);
}

export function filterRecordsForSpot(
  records: QuizRecord[],
  stack: StackSize,
  chartName: string,
): QuizRecord[] {
  return records.filter(
    r => r.question.stackSize === stack && r.question.chartName === chartName,
  );
}

/**
 * Build a hand→action map from quiz records for one spot.
 * - Every one of the 169 hands is present.
 * - Hands without an answer get the sentinel action `'unanswered'`.
 * - If a hand was answered multiple times, the latest answer wins.
 */
export function buildUserHandAction(
  spotRecords: QuizRecord[],
): Record<string, string> {
  const result: Record<string, string> = {};
  forEachHand(hand => {
    result[hand] = 'unanswered';
  });

  const latestByHand = new Map<string, QuizRecord>();
  for (const r of spotRecords) {
    const existing = latestByHand.get(r.question.hand);
    if (!existing || r.timestamp > existing.timestamp) {
      latestByHand.set(r.question.hand, r);
    }
  }
  for (const [hand, r] of latestByHand) {
    result[hand] = r.userAnswer;
  }
  return result;
}

export function getAnsweredHands(spotRecords: QuizRecord[]): Set<string> {
  return new Set(spotRecords.map(r => r.question.hand));
}

const STORAGE_KEY = 'holdem_quiz_records';

/** Remove all records for one spot from localStorage, return remaining records. */
export function resetSpotRecords(
  stack: StackSize,
  chartName: string,
): QuizRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const records = raw ? (JSON.parse(raw) as QuizRecord[]) : [];
    const kept = records.filter(
      r => !(r.question.stackSize === stack && r.question.chartName === chartName),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
    return kept;
  } catch {
    return [];
  }
}

export const UNANSWERED_COLOR: ColorDef = {
  bg: 'transparent',
  text: '#374151',
  label: '',
};

export const USER_COLOR_MAP: Record<string, ColorDef> = {
  ...ACTION_COLORS,
  unanswered: UNANSWERED_COLOR,
};
