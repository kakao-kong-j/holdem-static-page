import type { FlopCbetData } from './flopCbet';

type Board = FlopCbetData['boards'][number];
export type BoardMatch =
  | { kind: 'invalid' }
  | { kind: 'unmatched'; cards: string[]; texture: string }
  | { kind: 'exact'; cards: string[]; board: Board }
  | { kind: 'inferred'; cards: string[]; board: Board; rule: 'suits' | 'low-card' | 'texture'; texture: string; changes: string[] };
const ranks = '23456789TJQKA';
const rank = (card: string) => ranks.indexOf(card[0]) + 2;
const ordered = (cards: string[]) => [...cards].sort((a, b) => rank(b) - rank(a) || a.localeCompare(b));

export function parseFlopBoard(input: string): string[] | null {
  const symbols: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
  const compact = input.replace(/[♠♥♦♣]/g, suit => symbols[suit]).replace(/\s/g, '');
  if (!/^(?:[2-9tjqka][shdc]){3}$/i.test(compact)) return null;
  const cards = compact.match(/../g)!.map(card => card[0].toUpperCase() + card[1].toLowerCase());
  return new Set(cards).size === 3 ? ordered(cards) : null;
}

export const displayBoard = (cards: string[]) => cards.map(card => card[0] + ({ s: '♠', h: '♥', d: '♦', c: '♣' }[card[1]])).join(' ');

// Pair ranks can swap positions, so compare every rank-compatible card ordering.
function alignments(cards: string[]): string[][] {
  const [a, b, c] = cards;
  return [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];
}
function suitDistance(input: string[], candidate: string[]) {
  let relationships = 0;
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    if ((input[i][1] === input[j][1]) !== (candidate[i][1] === candidate[j][1])) relationships++;
  }
  return relationships * 4 + input.filter((card, i) => card[1] !== candidate[i][1]).length;
}
export function classifyBoardTexture(cards: string[]): string {
  const [high, middle, low] = ordered(cards).map(rank);
  if (high === low) return 'Trips';
  if (high === middle || middle === low) return 'Paired';
  if (high === 14) return middle >= 10 ? (low >= 10 ? 'ABB' : 'ABx') : 'Axy';
  if (low >= 10) return 'BBB';
  if (middle >= 10) return '2 Broadway';
  if (high >= 12) return 'K/Q + 2';
  if (high >= 10) return high - low <= 4 ? 'J/T connected' : 'J/T + 2';
  return high - low <= 4 ? 'Low connected' : 'Low unconnected';
}
function disconnectedLow(cards: string[]) {
  return rank(cards[1]) - rank(cards[2]) >= 5;
}
function pairPosition(cards: string[]) {
  return cards[0][0] === cards[1][0] ? 'top' : cards[1][0] === cards[2][0] ? 'bottom' : 'none';
}
function textureDistance(input: string[], candidate: string[]): number[] {
  const a = input.map(rank), b = candidate.map(rank);
  const suitScore = suitDistance(input, candidate);
  return [
    Number(pairPosition(input) !== pairPosition(candidate)),
    Math.floor(suitScore / 4),
    Math.abs(a[0] - b[0]),
    Math.abs((a[0] - a[1]) - (b[0] - b[1])) + Math.abs((a[1] - a[2]) - (b[1] - b[2])),
    a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0),
    suitScore % 4,
  ];
}
function compareScores(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function matchFlopBoard(input: string, boards: Board[]): BoardMatch {
  const cards = parseFlopBoard(input);
  if (!cards) return { kind: 'invalid' };
  const exact = boards.find(board => ordered(board.cards).join('') === cards.join(''));
  if (exact) return { kind: 'exact', cards, board: exact };

  const texture = classifyBoardTexture(cards);
  const sameTexture = boards.filter(board => board.textures?.includes(texture));
  for (const rule of ['suits', 'low-card', 'texture'] as const) {
    if (rule === 'low-card' && !disconnectedLow(cards)) continue;
    const candidates = sameTexture.flatMap(board => alignments(board.cards).flatMap(candidate => {
      const ranksMatch = candidate.every((card, i) => card[0] === cards[i][0]);
      const lowMatch = candidate[0][0] === cards[0][0] && candidate[1][0] === cards[1][0]
        && rank(candidate[2]) < rank(candidate[1]) && candidate[2][0] !== cards[2][0] && disconnectedLow(candidate);
      const descending = rank(candidate[0]) >= rank(candidate[1]) && rank(candidate[1]) >= rank(candidate[2]);
      if (!(rule === 'suits' ? ranksMatch : rule === 'low-card' ? lowMatch : descending)) return [];
      return [{ board, candidate, suitScore: suitDistance(cards, candidate), rankGap: Math.abs(rank(cards[2]) - rank(candidate[2])) }];
    }));
    // Preserve flush relationships first, then choose the nearest disconnected rank.
    candidates.sort((a, b) => rule === 'texture'
      ? compareScores(textureDistance(cards, a.candidate), textureDistance(cards, b.candidate)) || a.board.id.localeCompare(b.board.id)
      : Math.floor(a.suitScore / 4) - Math.floor(b.suitScore / 4)
      || (rule === 'low-card' ? a.rankGap - b.rankGap : 0)
      || a.suitScore - b.suitScore || a.board.id.localeCompare(b.board.id));
    const found = candidates[0];
    if (found) return {
      kind: 'inferred', cards, board: found.board, rule, texture,
      changes: cards.flatMap((card, i) => card === found.candidate[i] ? [] : [`${displayBoard([card])} → ${displayBoard([found.candidate[i]])}`]),
    };
  }
  return { kind: 'unmatched', cards, texture };
}
