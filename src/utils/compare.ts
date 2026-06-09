import type { QuizRecord, StackSize, ColorDef } from '../types';
import { ACTION_COLORS, OPEN_RANGE_COLOR_MAP, OPEN_RANGE_POSITIONS } from '../constants';
import { forEachHand, getHandCombos } from './hand';

export const UNANSWERED_ACTION = 'unanswered';
export const DIMMED_ACTION = 'dimmed';

export const UNANSWERED_COLOR: ColorDef = {
  bg: '#374151',
  text: '#9ca3af',
  label: '?',
};

export const DIMMED_COLOR: ColorDef = {
  bg: '#0f172a',
  text: '#334155',
  label: '',
};

export const COMPARE_ACTION_COLORMAP: Record<string, ColorDef> = {
  ...ACTION_COLORS,
  [UNANSWERED_ACTION]: UNANSWERED_COLOR,
  [DIMMED_ACTION]: DIMMED_COLOR,
};

export const COMPARE_OPEN_RANGE_COLORMAP: Record<string, ColorDef> = {
  ...OPEN_RANGE_COLOR_MAP,
  [UNANSWERED_ACTION]: UNANSWERED_COLOR,
  [DIMMED_ACTION]: DIMMED_COLOR,
};

export function maskMismatchesOnly(
  left: Record<string, string>,
  right: Record<string, string>,
): { left: Record<string, string>; right: Record<string, string> } {
  const maskedLeft: Record<string, string> = {};
  const maskedRight: Record<string, string> = {};
  forEachHand(hand => {
    const r = right[hand] ?? UNANSWERED_ACTION;
    const l = left[hand] ?? 'fold';
    const isMismatch = r !== UNANSWERED_ACTION && l !== r;
    maskedLeft[hand] = isMismatch ? l : DIMMED_ACTION;
    maskedRight[hand] = isMismatch ? r : DIMMED_ACTION;
  });
  return { left: maskedLeft, right: maskedRight };
}

const CORRECT_BORDER = '#10b981';
const WRONG_BORDER = '#ef4444';

export function computeAnswerBorders(
  left: Record<string, string>,
  right: Record<string, string>,
): Record<string, string> {
  const borders: Record<string, string> = {};
  forEachHand(hand => {
    const r = right[hand] ?? UNANSWERED_ACTION;
    if (r === UNANSWERED_ACTION || r === DIMMED_ACTION) return;
    const l = left[hand] ?? 'fold';
    borders[hand] = l === r ? CORRECT_BORDER : WRONG_BORDER;
  });
  return borders;
}

export function computeRecordBorders(
  rightRecords: Record<string, QuizRecord>,
  displayedRight: Record<string, string>,
): Record<string, string> {
  const borders: Record<string, string> = {};
  forEachHand(hand => {
    const r = displayedRight[hand] ?? UNANSWERED_ACTION;
    if (r === UNANSWERED_ACTION || r === DIMMED_ACTION) return;
    const rec = rightRecords[hand];
    if (!rec) return;
    borders[hand] = rec.correct ? CORRECT_BORDER : WRONG_BORDER;
  });
  return borders;
}

export function latestRecordsByHand(
  records: QuizRecord[],
  predicate: (r: QuizRecord) => boolean,
): Record<string, QuizRecord> {
  const latest: Record<string, QuizRecord> = {};
  for (const r of records) {
    if (!predicate(r)) continue;
    const h = r.question.hand;
    if (!latest[h] || r.timestamp > latest[h].timestamp) {
      latest[h] = r;
    }
  }
  return latest;
}

export function buildAnswerTitle(r: QuizRecord): string {
  const { question, userAnswer } = r;
  const { hand, stackSize, chartName, heroPosition, villainPosition } = question;
  const combos = getHandCombos(hand);
  const posLine = villainPosition
    ? `나: ${heroPosition} vs 빌런: ${villainPosition}`
    : `나: ${heroPosition}`;
  return `${hand} (${combos} combos)\n${stackSize} · ${chartName}\n${posLine}\n내 답변: ${userAnswer}`;
}

export function buildAnswerTitles(
  latestByHand: Record<string, QuizRecord>,
): Record<string, string> {
  const titles: Record<string, string> = {};
  for (const [hand, rec] of Object.entries(latestByHand)) {
    titles[hand] = buildAnswerTitle(rec);
  }
  return titles;
}

export function latestUserAnswersByHand(
  records: QuizRecord[],
  stackSize: StackSize,
  chartName: string,
): Record<string, string> {
  const latestTs: Record<string, number> = {};
  const result: Record<string, string> = {};
  for (const r of records) {
    if (r.question.stackSize !== stackSize) continue;
    if (r.question.chartName !== chartName) continue;
    const h = r.question.hand;
    if (latestTs[h] === undefined || r.timestamp > latestTs[h]) {
      latestTs[h] = r.timestamp;
      result[h] = r.userAnswer;
    }
  }
  return result;
}

export function fillUnanswered(
  answered: Record<string, string>,
): Record<string, string> {
  const full: Record<string, string> = {};
  forEachHand(hand => {
    full[hand] = answered[hand] ?? UNANSWERED_ACTION;
  });
  return full;
}

export function buildUserOpenRange(
  records: QuizRecord[],
  stackSize: StackSize,
): Record<string, string> {
  const perPos: Record<string, Record<string, string>> = {};
  const anyAttempt = new Set<string>();
  for (const pos of OPEN_RANGE_POSITIONS) {
    const m = latestUserAnswersByHand(records, stackSize, `${pos} RFI`);
    perPos[pos] = m;
    for (const h of Object.keys(m)) anyAttempt.add(h);
  }

  const result: Record<string, string> = {};
  forEachHand(hand => {
    let assigned: string | null = null;
    for (const pos of OPEN_RANGE_POSITIONS) {
      if (perPos[pos][hand] === 'raise') {
        assigned = pos;
        break;
      }
    }
    if (assigned) result[hand] = assigned;
    else if (anyAttempt.has(hand)) result[hand] = 'fold';
    else result[hand] = UNANSWERED_ACTION;
  });

  return result;
}

export interface CompareSummary {
  answered: number;
  matched: number;
  mismatched: number;
  total: number;
}

export function compareSummary(
  left: Record<string, string>,
  right: Record<string, string>,
): CompareSummary {
  let answered = 0;
  let matched = 0;
  let mismatched = 0;
  forEachHand(hand => {
    const r = right[hand] ?? UNANSWERED_ACTION;
    if (r === UNANSWERED_ACTION) return;
    answered++;
    const l = left[hand] ?? 'fold';
    if (l === r) matched++;
    else mismatched++;
  });
  return { answered, matched, mismatched, total: 169 };
}

export function recordSummary(
  rightRecords: Record<string, QuizRecord>,
): CompareSummary {
  let answered = 0;
  let matched = 0;
  let mismatched = 0;
  for (const rec of Object.values(rightRecords)) {
    answered++;
    if (rec.correct) matched++;
    else mismatched++;
  }
  return { answered, matched, mismatched, total: 169 };
}
