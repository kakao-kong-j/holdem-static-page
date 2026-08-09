import { RANKS } from '../constants';
import { getHandName } from './hand';

export type CashPosition = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type CashSituation = 'unopened' | 'opened' | 'sb-limp' | 'sb-raise' | 'bb-raise-after-limp';
export type CashActionFrequencies = Record<string, number>;

export interface CashScenario {
  id: string;
  position: CashPosition;
  actionHistory: [CashPosition, string][];
  availableActions: string[];
  hands: Record<string, CashActionFrequencies>;
}

export interface CashRangeData {
  game: { name: string; stackBb: number; openSizeBb: number };
  scenarios: CashScenario[];
}

export interface CashAction {
  action: string;
  frequency: number;
}

const POSITIONS = new Set<CashPosition>(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
const VALID_HANDS = new Set(
  RANKS.flatMap((_, row) => RANKS.map((__, column) => getHandName(row, column))),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCashRangeData(value: unknown): CashRangeData {
  if (!isRecord(value) || !isRecord(value.game)
    || typeof value.game.name !== 'string' || typeof value.game.stackBb !== 'number'
    || typeof value.game.openSizeBb !== 'number' || !Array.isArray(value.scenarios)) {
    throw new Error('Invalid cash range payload');
  }

  for (const scenario of value.scenarios) {
    if (!isRecord(scenario) || typeof scenario.id !== 'string'
      || typeof scenario.position !== 'string' || !POSITIONS.has(scenario.position as CashPosition)
      || !Array.isArray(scenario.actionHistory) || !scenario.actionHistory.every(entry =>
        Array.isArray(entry) && entry.length === 2
        && POSITIONS.has(entry[0] as CashPosition) && typeof entry[1] === 'string')
      || !Array.isArray(scenario.availableActions)
      || !scenario.availableActions.every(action => typeof action === 'string')
      || !isRecord(scenario.hands)) {
      throw new Error('Invalid cash range scenario');
    }

    for (const frequencies of Object.values(scenario.hands)) {
      if (!isRecord(frequencies) || !Object.values(frequencies).every(frequency =>
        typeof frequency === 'number' && Number.isFinite(frequency)
        && frequency >= 0 && frequency <= 100)) {
        throw new Error('Invalid cash range frequencies');
      }
    }
  }

  return value as unknown as CashRangeData;
}

export function normalizeCashHand(value: string): string | null {
  const upper = value.trim().toUpperCase();
  const hand = upper.length === 3 ? `${upper.slice(0, 2)}${upper[2].toLowerCase()}` : upper;
  return VALID_HANDS.has(hand) ? hand : null;
}

function nonFoldHistory(scenario: CashScenario): [CashPosition, string][] {
  return scenario.actionHistory.filter(([, action]) => action !== 'fold');
}

function situationOf(scenario: CashScenario): CashSituation | null {
  const actions = nonFoldHistory(scenario);
  if (actions.length === 0) return 'unopened';
  if (scenario.position === 'BB' && actions.length === 1 && actions[0][0] === 'SB' && actions[0][1] === 'call') return 'sb-limp';
  if (scenario.position === 'BB' && actions.length === 1 && actions[0][0] === 'SB' && actions[0][1] === 'raise_3.5') return 'sb-raise';
  if (scenario.position === 'SB' && actions.length === 2 && actions[0][0] === 'SB'
    && actions[0][1] === 'call' && actions[1][0] === 'BB') return 'bb-raise-after-limp';
  if (actions.length === 1 && actions[0][1] === 'raise_2.5') return 'opened';
  return null;
}

export function getAvailableCashPositions(data: CashRangeData): CashPosition[] {
  return [...new Set(data.scenarios.map(scenario => scenario.position))];
}

export function getAvailableCashSituations(data: CashRangeData, hero: CashPosition): CashSituation[] {
  return [...new Set(data.scenarios
    .filter(scenario => scenario.position === hero)
    .map(situationOf)
    .filter((value): value is CashSituation => value !== null))];
}

export function getAvailableCashOpeners(data: CashRangeData, hero: CashPosition): CashPosition[] {
  return data.scenarios
    .filter(scenario => scenario.position === hero && situationOf(scenario) === 'opened')
    .map(scenario => nonFoldHistory(scenario)[0][0]);
}

export function findCashScenario(
  data: CashRangeData,
  hero: CashPosition,
  situation: CashSituation,
  opener?: CashPosition,
): CashScenario | null {
  return data.scenarios.find(scenario => {
    if (scenario.position !== hero || situationOf(scenario) !== situation) return false;
    return situation !== 'opened' || nonFoldHistory(scenario)[0][0] === opener;
  }) ?? null;
}

export function getCashActions(frequencies: CashActionFrequencies): CashAction[] {
  return Object.entries(frequencies)
    .filter(([, frequency]) => frequency > 0)
    .map(([action, frequency]) => ({ action, frequency }))
    .sort((a, b) => b.frequency - a.frequency);
}

export function getPrimaryCashActions(actions: CashAction[]): CashAction[] {
  return actions.length === 0
    ? []
    : actions.filter(action => action.frequency === actions[0].frequency);
}

export function getCashActionLabel(action: string): string {
  if (action.startsWith('raise_')) return `${action.slice(6)}BB 레이즈`;
  if (action.startsWith('all_in_')) return `${action.slice(7)}BB 올인`;
  return ({ call: '콜', fold: '폴드', check: '체크' } as Record<string, string>)[action] ?? action;
}

export function getCashActionColor(action: string): string {
  if (action.startsWith('raise_')) return '#C94040';
  if (action.startsWith('all_in_')) return '#7B2FBE';
  return ({ call: '#2AA875', check: '#1C7AA8', fold: '#374151' } as Record<string, string>)[action] ?? '#6b7280';
}

export function getCashActionGradient(frequencies: CashActionFrequencies): string {
  let start = 0;
  const stops = getCashActions(frequencies).flatMap(({ action, frequency }) => {
    const end = start + frequency;
    const color = getCashActionColor(action);
    const segment = [`${color} ${start}%`, `${color} ${end}%`];
    start = end;
    return segment;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
