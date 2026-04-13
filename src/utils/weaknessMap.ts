import type { StackSize } from '../types';

export type WeaknessId =
  | 'A1_EP_타이트' | 'A2_MP_타이트' | 'A3_LP_타이트' | 'A4_SB_보수적' | 'A5_오픈_루즈' | 'A6_스택조정_실패'
  | 'B7_BB디펜스_15BB' | 'B8_BB디펜스_25_40BB' | 'B9_SB_혼동' | 'B10_IP플랫_부재' | 'B11_vsEP_오버3bet' | 'B12_vsLP_오버3bet'
  | 'C13_블러프3bet_부재' | 'C14_블러프RFI_부재' | 'C15_밸류3bet_누락' | 'C16_스퀴즈_부재' | 'C17_트랩_실패' | 'C18_4bet_오판'
  | 'D19_15BB_올인기준' | 'D20_25BB_올인' | 'D21_40BB_3bet후대응' | 'D22_100BB_플랫' | 'D23_SB_림프' | 'D24_BvB_혼동'
  | 'other';

export type WeaknessCategory = 'A' | 'B' | 'C' | 'D';

export type ChartViewType = 'open-range' | 'sb-open' | 'facing';

export interface WeaknessMeta {
  title: string;
  description: string;
  tag: string[];
  category: WeaknessCategory;
  chartLink: {
    stack: StackSize;
    chartName: string;
    viewType: ChartViewType;
  };
}

export const WEAKNESS_MAP: Record<Exclude<WeaknessId, 'other'>, WeaknessMeta> = {
  // [A] 오픈 레인지 (RFI)
  A1_EP_타이트: {
    title: 'EP 오픈 타이트',
    description: 'UTG/UTG+1에서 오픈해야 할 핸드를 폴드합니다.',
    tag: ['#타이트', '#RFI', '#EP'],
    category: 'A',
    chartLink: { stack: '100BB', chartName: 'UTG RFI', viewType: 'open-range' },
  },
  A2_MP_타이트: {
    title: 'MP 오픈 타이트',
    description: 'UTG+2/LJ/HJ에서 오픈해야 할 핸드를 폴드합니다.',
    tag: ['#타이트', '#RFI', '#MP'],
    category: 'A',
    chartLink: { stack: '100BB', chartName: 'HJ RFI', viewType: 'open-range' },
  },
  A3_LP_타이트: {
    title: 'LP 오픈 타이트',
    description: 'CO/BTN에서 오픈해야 할 핸드를 폴드합니다.',
    tag: ['#타이트', '#RFI', '#LP'],
    category: 'A',
    chartLink: { stack: '100BB', chartName: 'BTN RFI', viewType: 'open-range' },
  },
  A4_SB_보수적: {
    title: 'SB RFI 보수적',
    description: 'SB에서 오픈/셔브 정답을 폴드합니다.',
    tag: ['#타이트', '#RFI', '#SB'],
    category: 'A',
    chartLink: { stack: '100BB', chartName: 'SB RFI', viewType: 'sb-open' },
  },
  A5_오픈_루즈: {
    title: '오픈 루즈',
    description: 'RFI에서 폴드해야 할 핸드를 오픈합니다.',
    tag: ['#루즈', '#RFI'],
    category: 'A',
    chartLink: { stack: '25BB', chartName: 'CO RFI', viewType: 'open-range' },
  },
  A6_스택조정_실패: {
    title: '스택별 조정 실패',
    description: '같은 포지션·핸드인데 스택에 따라 정답률이 들쭉날쭉합니다.',
    tag: ['#스택', '#일관성'],
    category: 'A',
    chartLink: { stack: '100BB', chartName: 'UTG RFI', viewType: 'open-range' },
  },

  // [B] 오픈 대응 (Facing RFI)
  B7_BB디펜스_15BB: {
    title: 'BB 디펜스 부족 (숏스택)',
    description: '15BB BB에서 디펜스 정답을 폴드합니다.',
    tag: ['#타이트', '#BB', '#숏스택'],
    category: 'B',
    chartLink: { stack: '15BB', chartName: 'BB vs UTG RFI', viewType: 'facing' },
  },
  B8_BB디펜스_25_40BB: {
    title: 'BB 디펜스 부족 (미드스택)',
    description: '25/40BB BB에서 디펜스 정답을 폴드합니다.',
    tag: ['#타이트', '#BB', '#미드스택'],
    category: 'B',
    chartLink: { stack: '25BB', chartName: 'BB vs CO RFI', viewType: 'facing' },
  },
  B9_SB_혼동: {
    title: 'SB 디펜스 혼동',
    description: 'SB에서 facing 결정에 오답이 많습니다.',
    tag: ['#SB', '#Facing'],
    category: 'B',
    chartLink: { stack: '100BB', chartName: 'SB vs BTN', viewType: 'facing' },
  },
  B10_IP플랫_부재: {
    title: 'IP 플랫 부재',
    description: 'CO/BTN에서 콜 정답을 폴드 또는 3벳합니다.',
    tag: ['#콜링', '#IP'],
    category: 'B',
    chartLink: { stack: '100BB', chartName: 'BTN vs HJ', viewType: 'facing' },
  },
  B11_vsEP_오버3bet: {
    title: 'vs EP 오버-3bet',
    description: 'UTG/UTG+1 오픈에 콜 정답인데 3벳합니다.',
    tag: ['#3bet', '#vsEP'],
    category: 'B',
    chartLink: { stack: '100BB', chartName: 'HJ vs UTG', viewType: 'facing' },
  },
  B12_vsLP_오버3bet: {
    title: 'vs LP 오버-3bet',
    description: 'CO/BTN 오픈에 콜 정답인데 3벳합니다.',
    tag: ['#3bet', '#vsLP'],
    category: 'B',
    chartLink: { stack: '100BB', chartName: 'BB vs BTN', viewType: 'facing' },
  },

  // [C] 공격 / 블러프
  C13_블러프3bet_부재: {
    title: '블러프 3bet 부재',
    description: 'threebet_bluff 정답을 폴드합니다.',
    tag: ['#블러프', '#3bet'],
    category: 'C',
    chartLink: { stack: '100BB', chartName: 'SB vs CO', viewType: 'facing' },
  },
  C14_블러프RFI_부재: {
    title: '블러프 RFI 부재',
    description: 'raise_bluff 정답을 폴드합니다 (SB 100BB).',
    tag: ['#블러프', '#RFI', '#SB'],
    category: 'C',
    chartLink: { stack: '100BB', chartName: 'SB RFI', viewType: 'sb-open' },
  },
  C15_밸류3bet_누락: {
    title: '밸류 3bet 누락',
    description: 'threebet_value 정답을 폴드/콜합니다.',
    tag: ['#밸류', '#3bet'],
    category: 'C',
    chartLink: { stack: '100BB', chartName: 'BTN vs CO', viewType: 'facing' },
  },
  C16_스퀴즈_부재: {
    title: '스퀴즈 기회 놓침',
    description: '스퀴즈 차트가 아직 활성화되지 않았습니다 (향후 추가).',
    tag: ['#스퀴즈', '#향후'],
    category: 'C',
    chartLink: { stack: '100BB', chartName: 'SB RFI', viewType: 'sb-open' },
  },
  C17_트랩_실패: {
    title: '프리미엄 트랩 실패',
    description: 'AA/KK/QQ로 콜 정답인데 3벳합니다.',
    tag: ['#트랩', '#프리미엄'],
    category: 'C',
    chartLink: { stack: '100BB', chartName: 'HJ vs UTG', viewType: 'facing' },
  },
  C18_4bet_오판: {
    title: '4-bet 오판',
    description: 'fourbet_value/bluff 정답과 다르게 답합니다 (현재 퀴즈 미수록).',
    tag: ['#4bet', '#향후'],
    category: 'C',
    chartLink: { stack: '100BB', chartName: 'HJ vs UTG', viewType: 'facing' },
  },

  // [D] 스택 / 특수 상황
  D19_15BB_올인기준: {
    title: '15BB 올인 판단',
    description: '15BB allIn 정답을 콜/폴드합니다.',
    tag: ['#숏스택', '#올인'],
    category: 'D',
    chartLink: { stack: '15BB', chartName: 'CO RFI', viewType: 'open-range' },
  },
  D20_25BB_올인: {
    title: '25BB 올인 판단',
    description: '25BB allIn 정답을 실수합니다.',
    tag: ['#미드스택', '#올인'],
    category: 'D',
    chartLink: { stack: '25BB', chartName: 'CO RFI', viewType: 'open-range' },
  },
  D21_40BB_3bet후대응: {
    title: '40BB 3bet 후 대응',
    description: 'raise_call/raise_fold/raise4bet 등을 혼동합니다.',
    tag: ['#미드스택', '#3bet후'],
    category: 'D',
    chartLink: { stack: '40BB', chartName: 'SB RFI BvB', viewType: 'sb-open' },
  },
  D22_100BB_플랫: {
    title: '100BB 플랫 부족',
    description: '100BB call 정답을 3벳/폴드합니다.',
    tag: ['#콜링', '#딥스택'],
    category: 'D',
    chartLink: { stack: '100BB', chartName: 'BTN vs HJ', viewType: 'facing' },
  },
  D23_SB_림프: {
    title: 'SB 림프 미사용',
    description: '100BB SB limp 정답을 실수합니다.',
    tag: ['#림프', '#SB'],
    category: 'D',
    chartLink: { stack: '100BB', chartName: 'SB RFI', viewType: 'sb-open' },
  },
  D24_BvB_혼동: {
    title: 'BvB 혼동',
    description: 'SB vs BB 전용 차트에서 실수합니다.',
    tag: ['#BvB', '#SB'],
    category: 'D',
    chartLink: { stack: '100BB', chartName: 'BB vs SB', viewType: 'facing' },
  },
};

export const ALL_TAGS: string[] = Array.from(
  new Set(Object.values(WEAKNESS_MAP).flatMap(m => m.tag)),
).sort();
