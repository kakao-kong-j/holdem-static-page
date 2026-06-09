export type CoinPokerPosition = 'UTG' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB' | 'UNKNOWN';

export interface CoinPokerAction {
  player: string;
  position?: CoinPokerPosition;
  action: string;
  line: string;
}

export interface CoinPokerHand {
  handId: string;
  rawText: string;
  startedAt: string;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  tableSize: number;
  buttonSeat: number | null;
  heroSeat: number | null;
  heroStack: number | null;
  heroStackBb: number | null;
  heroPosition: CoinPokerPosition;
  heroCards: string[];
  heroHand: string | null;
  preflopActions: CoinPokerAction[];
  heroFirstAction: string | null;
  rfiEligible: boolean;
  exclusionReason: string | null;
}

interface SeatInfo {
  seat: number;
  player: string;
  stack: number;
}

const RANK_ORDER = 'AKQJT98765432';
const VALID_SUITS = new Set(['c', 'd', 'h', 's']);
const CARD_PATTERN = /^[2-9TJQKA][cdhs]$/i;
const AMOUNT_PATTERN = '₮?[\\d,]+(?:\\.\\d+)?';
const SUPPORTED_RFI_POSITIONS: CoinPokerPosition[] = ['UTG', 'LJ', 'HJ', 'CO', 'BTN'];
const VOLUNTARY_ACTIONS = new Set(['calls', 'raises', 'bets', 'ALLIN']);

export function normalizeHoleCards(cards: string[]): string | null {
  if (cards.length !== 2) return null;
  if (cards.some((card) => !CARD_PATTERN.test(card))) return null;

  const parsed = cards.map((card) => ({
    rank: card[0]?.toUpperCase(),
    suit: card[1]?.toLowerCase(),
  }));

  if (new Set(cards.map((card) => card.toLowerCase())).size !== cards.length) {
    return null;
  }

  if (parsed.some((card) => !card.rank || !card.suit || !RANK_ORDER.includes(card.rank) || !VALID_SUITS.has(card.suit))) {
    return null;
  }

  const [first, second] = parsed;
  if (first.rank === second.rank) {
    return `${first.rank}${second.rank}`;
  }

  const ordered = [...parsed].sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));
  const suitedness = first.suit === second.suit ? 's' : 'o';
  return `${ordered[0].rank}${ordered[1].rank}${suitedness}`;
}

export function parseCoinPokerHands(raw: string): CoinPokerHand[] {
  return splitHandBlocks(raw)
    .map(parseHandBlock)
    .filter((hand): hand is CoinPokerHand => hand !== null);
}

function splitHandBlocks(raw: string): string[] {
  const starts = [...raw.matchAll(/^CoinPoker Hand #/gm)].map((match) => match.index ?? 0);
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? raw.length;
    return raw.slice(start, end).trim();
  });
}

function parseHandBlock(block: string): CoinPokerHand | null {
  const header = block.match(
    new RegExp(`^CoinPoker Hand #(\\d+):\\s+NLH\\s+\\((${AMOUNT_PATTERN})\\/(${AMOUNT_PATTERN})(?:\\/(${AMOUNT_PATTERN}))?\\)\\s+(.+)$`, 'm'),
  );
  const table = block.match(/^(?:Table|Tournament)\s+.+?\s+(\d+)-max Seat #(\d+) is the button$/m);
  const heroCardsMatch = block.match(/^Dealt to Hero \[([^\]]+)\]$/m);

  if (!header || !table || !heroCardsMatch) return null;

  const seats = parseSeats(block);
  const heroSeatInfo = seats.find((seat) => seat.player === 'Hero');
  const heroCards = heroCardsMatch[1].split(/\s+/);
  const heroHand = normalizeHoleCards(heroCards);

  if (!heroSeatInfo || !heroHand) return null;

  const smallBlind = parseAmount(header[2]);
  const bigBlind = parseAmount(header[3]);
  const ante = header[4] ? parseAmount(header[4]) : 0;
  const tableSize = Number(table[1]);
  const buttonSeat = Number(table[2]);
  const blindSeats = parseBlindSeats(block, seats);
  const positionByPlayer = buildPositionByPlayer(seats, buttonSeat, blindSeats);
  const heroPosition = positionByPlayer.get('Hero') ?? 'UNKNOWN';
  const preflopActions = parsePreflopActions(block, positionByPlayer);
  const heroFirstAction = preflopActions.find((action) => action.player === 'Hero')?.action ?? null;
  const heroStackBb = roundToTwo(heroSeatInfo.stack / bigBlind);
  const exclusionReason = getExclusionReason(preflopActions, heroFirstAction, heroPosition);

  return {
    handId: header[1],
    rawText: block,
    startedAt: header[5],
    smallBlind,
    bigBlind,
    ante,
    tableSize,
    buttonSeat,
    heroSeat: heroSeatInfo.seat,
    heroStack: heroSeatInfo.stack,
    heroStackBb,
    heroPosition,
    heroCards,
    heroHand,
    preflopActions,
    heroFirstAction,
    rfiEligible: exclusionReason === null,
    exclusionReason,
  };
}

function parseSeats(block: string): SeatInfo[] {
  return [...block.matchAll(new RegExp(`^Seat\\s+(\\d+):\\s+(.+?)\\s+\\((${AMOUNT_PATTERN})\\s+in chips\\)$`, 'gm'))].map((match) => ({
    seat: Number(match[1]),
    player: match[2],
    stack: parseAmount(match[3]),
  }));
}

function parseBlindSeats(block: string, seats: SeatInfo[]): { smallBlindSeat: number | null; bigBlindSeat: number | null } {
  const smallBlindPlayer = block.match(new RegExp(`^(.+?): posts small blind ${AMOUNT_PATTERN}$`, 'm'))?.[1] ?? null;
  const bigBlindPlayer = block.match(new RegExp(`^(.+?): posts big blind ${AMOUNT_PATTERN}$`, 'm'))?.[1] ?? null;

  return {
    smallBlindSeat: seats.find((seat) => seat.player === smallBlindPlayer)?.seat ?? null,
    bigBlindSeat: seats.find((seat) => seat.player === bigBlindPlayer)?.seat ?? null,
  };
}

function parsePreflopActions(block: string, positionByPlayer: Map<string, CoinPokerPosition>): CoinPokerAction[] {
  const holeCardsIndex = block.indexOf('*** HOLE CARDS ***');
  if (holeCardsIndex === -1) return [];

  const afterHoleCards = block.slice(holeCardsIndex + '*** HOLE CARDS ***'.length);
  const streetMarker = afterHoleCards.search(/^\*\*\* (FLOP|TURN|RIVER|SHOWDOWN|SUMMARY)/m);
  const preflopText = streetMarker === -1 ? afterHoleCards : afterHoleCards.slice(0, streetMarker);

  return preflopText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('Dealt to '))
    .map((line) => parseActionLine(line, positionByPlayer))
    .filter((action): action is CoinPokerAction => action !== null);
}

function parseActionLine(line: string, positionByPlayer: Map<string, CoinPokerPosition>): CoinPokerAction | null {
  const allIn = line.match(/^(.+?):\s+ALLIN\b/);
  if (allIn) {
    return {
      player: allIn[1],
      position: positionByPlayer.get(allIn[1]),
      action: 'ALLIN',
      line,
    };
  }

  const action = line.match(/^(.+?):\s+(folds|calls|checks|raises|bets)\b/);
  if (!action) return null;

  return {
    player: action[1],
    position: positionByPlayer.get(action[1]),
    action: action[2],
    line,
  };
}

function buildPositionByPlayer(
  seats: SeatInfo[],
  buttonSeat: number,
  blindSeats: { smallBlindSeat: number | null; bigBlindSeat: number | null },
): Map<string, CoinPokerPosition> {
  return new Map(seats.map((seat) => [
    seat.player,
    derivePosition(seats, buttonSeat, seat.seat, blindSeats),
  ]));
}

function derivePosition(
  seats: SeatInfo[],
  buttonSeat: number,
  heroSeat: number,
  blindSeats: { smallBlindSeat: number | null; bigBlindSeat: number | null },
): CoinPokerPosition {
  if (heroSeat === blindSeats.smallBlindSeat) return 'SB';
  if (heroSeat === blindSeats.bigBlindSeat) return 'BB';
  if (heroSeat === buttonSeat) return 'BTN';

  const orderedSeats = seats.map((seat) => seat.seat).sort((a, b) => a - b);
  const buttonIndex = orderedSeats.indexOf(buttonSeat);
  if (buttonIndex === -1) return 'UNKNOWN';

  const buttonRelativeSeats = [
    ...orderedSeats.slice(buttonIndex + 1),
    ...orderedSeats.slice(0, buttonIndex + 1),
  ];
  const positionOrder = getPositionOrder(orderedSeats.length);
  const heroIndex = buttonRelativeSeats.indexOf(heroSeat);

  return positionOrder[heroIndex] ?? 'UNKNOWN';
}

function getPositionOrder(playerCount: number): CoinPokerPosition[] {
  if (playerCount >= 7) return ['SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO', 'BTN'];
  if (playerCount === 6) return ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];
  if (playerCount === 5) return ['SB', 'BB', 'HJ', 'CO', 'BTN'];
  if (playerCount === 4) return ['SB', 'BB', 'CO', 'BTN'];
  if (playerCount === 3) return ['SB', 'BB', 'BTN'];
  return ['SB', 'BB'];
}

function getExclusionReason(
  preflopActions: CoinPokerAction[],
  heroFirstAction: string | null,
  heroPosition: CoinPokerPosition,
): string | null {
  if (!heroFirstAction) return 'hero-no-action';
  if (!SUPPORTED_RFI_POSITIONS.includes(heroPosition)) return 'position-not-supported';

  const heroActionIndex = preflopActions.findIndex((action) => action.player === 'Hero');
  const priorVoluntaryAction = preflopActions
    .slice(0, heroActionIndex)
    .some((action) => VOLUNTARY_ACTIONS.has(action.action));

  if (priorVoluntaryAction) return 'prior-voluntary-action';
  return null;
}

function parseAmount(value: string): number {
  return Number(value.replace(/[^\d.-]/g, ''));
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
