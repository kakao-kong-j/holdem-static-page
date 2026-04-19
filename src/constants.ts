import type { ColorDef, StackSize } from './types';

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

export const POSITIONS = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB'] as const;

export const OPEN_RANGE_POSITIONS = POSITIONS.filter(p => p !== 'SB');

export const STACK_SIZES: StackSize[] = ['15BB', '25BB', '40BB', '100BB'];

export const ACTION_COLORS: Record<string, ColorDef> = {
  raise:          { bg: '#C94040', text: '#fff', label: 'R' },
  allIn:          { bg: '#7B2FBE', text: '#fff', label: 'J' },
  call:           { bg: '#2AA875', text: '#fff', label: 'C' },
  raise_bluff:    { bg: '#1C7AA8', text: '#fff', label: 'Rb' },
  limp:           { bg: '#2AA875', text: '#fff', label: 'L' },
  threebet:       { bg: '#C94040', text: '#fff', label: '3' },
  threebet_value: { bg: '#C94040', text: '#fff', label: '3v' },
  threebet_bluff: { bg: '#1C7AA8', text: '#fff', label: '3b' },
  fourbet_value:  { bg: '#C94040', text: '#fff', label: '4v' },
  fourbet_bluff:  { bg: '#1C7AA8', text: '#fff', label: '4b' },
  raise4bet:      { bg: '#1C7AA8', text: '#fff', label: 'R4' },
  raise_fold:     { bg: '#6BAD25', text: '#1e3800', label: 'Rf' },
  raise_call:     { bg: '#2AA875', text: '#fff', label: 'Rc' },
  limp_call:      { bg: '#D97632', text: '#fff', label: 'Lc' },
  limp_raise:     { bg: '#C94040', text: '#fff', label: 'Lr' },
  limp_jam:       { bg: '#4A4A4A', text: '#fff', label: 'Lj' },
  limp_fold:      { bg: '#B8BD2A', text: '#4a4100', label: 'Lf' },
  fold:           { bg: 'transparent', text: '#6b7280', label: '-' },
};

export const POSITION_COLORS: Record<string, string> = {
  'UTG':   '#C94040',
  'UTG+1': '#D97632',
  'UTG+2': '#C99322',
  'LJ':    '#B8BD2A',
  'HJ':    '#6BAD25',
  'CO':    '#2AA875',
  'BTN':   '#1C7AA8',
  'SB':    '#6B4DB8',
};

export const OPEN_RANGE_COLOR_MAP: Record<string, ColorDef> = Object.fromEntries([
  ...OPEN_RANGE_POSITIONS.map(p => [p, { bg: POSITION_COLORS[p], text: '#fff', label: p }]),
  ['fold', { bg: 'transparent', text: '#6b7280', label: '-' }],
]);

export const SB_RFI_CHART = 'SB RFI';
export const SB_RFI_BVB_CHART = 'SB RFI BvB';

