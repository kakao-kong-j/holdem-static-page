export const FLOP_CBET_URL = `${import.meta.env.BASE_URL}tournament-flop-cbet.json`;
export const FLOP_SPOTS = {
  'srp-ip': 'SRP · IP', 'srp-oop': 'SRP · OOP', 'blind-war': 'Blind War',
  '3bp-oop': '3벳 팟 · OOP', '3bp-ip': '3벳 팟 · IP',
  '4bp-oop': '4벳 팟 · OOP', '4bp-ip': '4벳 팟 · IP',
} as const;
const PROFILES = ['GTO', 'Calling Station', 'Maniac'] as const;
const STACKS = [50, 35, 20] as const;
const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export type FlopSpot = keyof typeof FLOP_SPOTS;
export type FlopProfile = typeof PROFILES[number];
export type FlopStack = typeof STACKS[number];
export type FlopSort = 'source' | 'frequency-desc' | 'frequency-asc';
export type BetSize = { kind: 'pot'; pct: number } | { kind: 'all-in' };
export interface FlopCbetRecord {
  spot: FlopSpot;
  profile: FlopProfile;
  stack_bb: FlopStack;
  hero: string;
  villain: string;
  action: 'cbet' | 'stab';
  board_id: string;
  size: BetSize;
  frequency_pct: number;
  source: { sheet: string; row: number; url: string | null };
}
export interface FlopCbetData {
  schema_version: 1;
  source: { workbook: string; sha256: string };
  boards: { id: string; cards: string[]; textures?: string[] }[];
  records: FlopCbetRecord[];
  corrections: { sheet: string; cell: string; original: string; normalized: number }[];
}
export interface FlopCbetSelection {
  spot: FlopSpot;
  profile: FlopProfile;
  stack_bb: FlopStack;
  position: string;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function frequency(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}
function sourceUrl(value: unknown) {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'drive.google.com' && !url.username && !url.password;
  } catch { return false; }
}

export function validateFlopCbetData(value: unknown): FlopCbetData {
  const fail = () => { throw new Error('플랍 데이터 형식이 올바르지 않습니다.'); };
  if (!object(value) || value.schema_version !== 1 || !object(value.source)
    || typeof value.source.workbook !== 'string' || typeof value.source.sha256 !== 'string'
    || !/^[a-f\d]{64}$/i.test(value.source.sha256)
    || !Array.isArray(value.boards) || !value.boards.length
    || !Array.isArray(value.records) || !value.records.length || !Array.isArray(value.corrections)) return fail();
  const boards = new Set<string>();
  for (const board of value.boards) {
    if (!object(board) || typeof board.id !== 'string' || !Array.isArray(board.cards)
      || board.cards.length !== 3 || board.cards.some(card => typeof card !== 'string' || !/^[2-9TJQKA][shdc]$/.test(card))
      || new Set(board.cards).size !== 3 || board.cards.join('') !== board.id || boards.has(board.id)) return fail();
    if (board.textures !== undefined && (!Array.isArray(board.textures)
      || board.textures.some(tag => typeof tag !== 'string' || !tag.trim())
      || new Set(board.textures).size !== board.textures.length)) return fail();
    boards.add(board.id);
  }
  const keys = new Set<string>();
  for (const row of value.records) {
    if (!object(row) || !Object.hasOwn(FLOP_SPOTS, String(row.spot))
      || !PROFILES.includes(row.profile as FlopProfile) || !STACKS.includes(row.stack_bb as FlopStack)
      || !POSITIONS.includes(String(row.hero)) || !POSITIONS.includes(String(row.villain)) || row.hero === row.villain
      || !boards.has(String(row.board_id)) || !frequency(row.frequency_pct)
      || !object(row.size) || !['pot', 'all-in'].includes(String(row.size.kind))
      || (row.size.kind === 'pot' && ![10, 25, 50, 75, 100].includes(row.size.pct as number))
      || (row.size.kind === 'all-in' && row.size.pct !== undefined)
      || !object(row.source) || typeof row.source.sheet !== 'string'
      || !Number.isInteger(row.source.row) || (row.source.row as number) < 2 || !sourceUrl(row.source.url)
      || (String(row.spot).startsWith('4bp') && row.stack_bb !== 50)) return fail();
    const expectedAction = row.spot === 'blind-war' && row.hero === 'BB' && row.villain === 'SB' ? 'stab' : 'cbet';
    if (row.action !== expectedAction || (row.spot === 'blind-war' && !['SBvsBB', 'BBvsSB'].includes(`${row.hero}vs${row.villain}`))) return fail();
    const key = [row.spot, row.profile, row.stack_bb, row.hero, row.villain, row.action, row.board_id].join('|');
    if (keys.has(key)) return fail();
    keys.add(key);
  }
  for (const correction of value.corrections) {
    if (!object(correction) || typeof correction.sheet !== 'string' || typeof correction.cell !== 'string'
      || typeof correction.original !== 'string' || !frequency(correction.normalized)) return fail();
  }
  return value as unknown as FlopCbetData;
}

const positionKey = (row: FlopCbetRecord) => `${row.hero}vs${row.villain}`;
export const betSizeLabel = (size: BetSize) => size.kind === 'all-in' ? 'ALL-IN' : `${size.pct}%`;
export const formatFrequency = (value: number) => `${Number(value.toFixed(1))}%`;

export function getFlopCbetSelection(data: FlopCbetData, requested: Partial<FlopCbetSelection>) {
  const spots = (Object.keys(FLOP_SPOTS) as FlopSpot[]).filter(spot => data.records.some(row => row.spot === spot));
  const spot = spots.includes(requested.spot!) ? requested.spot! : spots[0];
  let rows = data.records.filter(row => row.spot === spot);
  const profiles = PROFILES.filter(profile => rows.some(row => row.profile === profile));
  const profile = profiles.includes(requested.profile!) ? requested.profile! : profiles[0];
  rows = rows.filter(row => row.profile === profile);
  const stacks = STACKS.filter(stack => rows.some(row => row.stack_bb === stack));
  const stack_bb = stacks.includes(requested.stack_bb!) ? requested.stack_bb! : stacks[0];
  rows = rows.filter(row => row.stack_bb === stack_bb);
  const positions = [...new Set(rows.map(positionKey))];
  const position = positions.includes(requested.position!) ? requested.position! : positions[0];
  return { selection: { spot, profile, stack_bb, position }, options: { spots, profiles, stacks, positions } };
}

export function filterFlopCbetRecords(data: FlopCbetData, selection: FlopCbetSelection, query: string, sort: FlopSort) {
  const suits: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
  const needle = query.toLowerCase().replace(/[♠♥♦♣]/g, suit => suits[suit]).replace(/\s/g, '');
  const rows = data.records.filter(row => row.spot === selection.spot && row.profile === selection.profile
    && row.stack_bb === selection.stack_bb && positionKey(row) === selection.position
    && (row.board_id.toLowerCase().includes(needle) || row.board_id.replace(/[shdc]/g, '').toLowerCase().includes(needle)));
  if (sort !== 'source') rows.sort((a, b) => (a.frequency_pct - b.frequency_pct) * (sort === 'frequency-asc' ? 1 : -1));
  return rows;
}

export function summarizeFlopCbet(rows: FlopCbetRecord[]) {
  const groups = new Map<string, { count: number; total: number; order: number }>();
  let total = 0;
  for (const row of rows) {
    const label = betSizeLabel(row.size);
    const group = groups.get(label) ?? { count: 0, total: 0, order: row.size.kind === 'pot' ? row.size.pct : 999 };
    group.count++;
    group.total += row.frequency_pct;
    total += row.frequency_pct;
    groups.set(label, group);
  }
  return {
    count: rows.length, mean: rows.length ? total / rows.length : null,
    sizes: [...groups].sort((a, b) => a[1].order - b[1].order)
      .map(([label, group]) => ({ label, count: group.count, mean: group.total / group.count })),
  };
}
