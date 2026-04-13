import { describe, it, expect } from 'vitest';
import { classifyAction, getChartContext, computeDeviationStats } from './stats';
import type { QuizRecord, StackSize } from '../types';

function makeRecord(opts: {
  hand: string;
  stack?: StackSize;
  chartName: string;
  correctAction: string;
  userAnswer: string;
}): QuizRecord {
  return {
    question: {
      stackSize: opts.stack ?? '100BB',
      chartName: opts.chartName,
      hand: opts.hand,
      correctAction: opts.correctAction,
      heroPosition: '',
      villainPosition: '',
      situation: '',
    },
    userAnswer: opts.userAnswer,
    correct: opts.correctAction === opts.userAnswer,
    timestamp: 0,
  };
}

describe('classifyAction', () => {
  it('fold: 모든 버킷 false', () => {
    expect(classifyAction('fold')).toEqual({ vpip: false, pfr: false, threebet: false });
  });

  it('call: VPIP만 true', () => {
    expect(classifyAction('call')).toEqual({ vpip: true, pfr: false, threebet: false });
  });

  it('raise: VPIP + PFR', () => {
    expect(classifyAction('raise')).toEqual({ vpip: true, pfr: true, threebet: false });
  });

  it('raise_bluff: VPIP + PFR', () => {
    expect(classifyAction('raise_bluff')).toEqual({ vpip: true, pfr: true, threebet: false });
  });

  it('limp 계열: VPIP만 (PFR 아님)', () => {
    expect(classifyAction('limp')).toEqual({ vpip: true, pfr: false, threebet: false });
    expect(classifyAction('limp_call')).toEqual({ vpip: true, pfr: false, threebet: false });
    expect(classifyAction('limp_raise')).toEqual({ vpip: true, pfr: false, threebet: false });
    expect(classifyAction('limp_fold')).toEqual({ vpip: true, pfr: false, threebet: false });
  });

  it('check: VPIP/PFR/3Bet 모두 false (자발적 투입 아님)', () => {
    expect(classifyAction('check')).toEqual({ vpip: false, pfr: false, threebet: false });
  });

  it('threebet (25/40BB): VPIP + PFR + 3Bet', () => {
    expect(classifyAction('threebet')).toEqual({ vpip: true, pfr: true, threebet: true });
  });

  it('threebet_value / threebet_bluff (100BB): 모두 true', () => {
    expect(classifyAction('threebet_value')).toEqual({ vpip: true, pfr: true, threebet: true });
    expect(classifyAction('threebet_bluff')).toEqual({ vpip: true, pfr: true, threebet: true });
  });

  it('fourbet_value/bluff: VPIP + PFR (3Bet 아님, 4벳)', () => {
    expect(classifyAction('fourbet_value')).toEqual({ vpip: true, pfr: true, threebet: false });
    expect(classifyAction('fourbet_bluff')).toEqual({ vpip: true, pfr: true, threebet: false });
  });

  it('allIn (기본: RFI 컨텍스트) → VPIP + PFR, 3Bet 아님', () => {
    expect(classifyAction('allIn')).toEqual({ vpip: true, pfr: true, threebet: false });
  });

  it('allIn (Facing RFI 컨텍스트, 15~40BB) → 3Bet 셔브로 카운트', () => {
    expect(classifyAction('allIn', { isFacingRFI: true, stack: '15BB' })).toEqual({
      vpip: true, pfr: true, threebet: true,
    });
    expect(classifyAction('allIn', { isFacingRFI: true, stack: '25BB' })).toEqual({
      vpip: true, pfr: true, threebet: true,
    });
    expect(classifyAction('allIn', { isFacingRFI: true, stack: '40BB' })).toEqual({
      vpip: true, pfr: true, threebet: true,
    });
  });

  it('allIn (Facing RFI 컨텍스트, 100BB) → 3Bet 아님 (100BB는 threebet_* 사용)', () => {
    expect(classifyAction('allIn', { isFacingRFI: true, stack: '100BB' })).toEqual({
      vpip: true, pfr: true, threebet: false,
    });
  });

  it('raise_value / raise4bet / raise_fold / raise_call (SB BvB): PFR', () => {
    expect(classifyAction('raise_value').pfr).toBe(true);
    expect(classifyAction('raise4bet').pfr).toBe(true);
    expect(classifyAction('raise_fold').pfr).toBe(true);
    expect(classifyAction('raise_call').pfr).toBe(true);
  });

  it('알 수 없는 액션: 안전한 기본값 (모두 false)', () => {
    expect(classifyAction('unknown_action')).toEqual({ vpip: false, pfr: false, threebet: false });
  });
});

describe('getChartContext', () => {
  it('RFI 차트', () => {
    expect(getChartContext('UTG RFI')).toBe('rfi');
    expect(getChartContext('SB RFI')).toBe('rfi');
    expect(getChartContext('SB RFI BvB')).toBe('rfi');
    expect(getChartContext('UTG+1 RFI')).toBe('rfi');
  });

  it('Facing RFI 차트 (15-40BB 스타일)', () => {
    expect(getChartContext('CO vs UTG RFI')).toBe('facing-rfi');
    expect(getChartContext('LJ/HJ vs UTG RFI')).toBe('facing-rfi');
    expect(getChartContext('BB vs SB RFI')).toBe('facing-rfi');
  });

  it('Facing RFI 차트 (100BB 스타일, RFI 접미사 없음)', () => {
    expect(getChartContext('HJ vs UTG')).toBe('facing-rfi');
    expect(getChartContext('BB vs BTN')).toBe('facing-rfi');
    expect(getChartContext('CO vs UTG/UTG+1')).toBe('facing-rfi');
  });

  it('Facing 3bet 차트', () => {
    expect(getChartContext('UTG vs UTG+1 3bet')).toBe('facing-3bet');
    expect(getChartContext('SB RFI vs BB 3bet')).toBe('facing-3bet');
  });

  it('Allin/Limp 관련은 other', () => {
    expect(getChartContext('UTG RFI vs BTN Allin')).toBe('other');
    expect(getChartContext('BB vs SB Limp')).toBe('other');
    expect(getChartContext('SB Limp vs BB Raise')).toBe('other');
    expect(getChartContext('BB vs SB Allin')).toBe('other');
  });
});

describe('computeDeviationStats', () => {
  it('빈 레코드 → null', () => {
    expect(computeDeviationStats([])).toBeNull();
  });

  it('RFI, raise vs raise (동일) → 편차 0', () => {
    const r = makeRecord({ hand: 'AA', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.vpipDelta).toBeCloseTo(0);
    expect(s.pfrDelta).toBeCloseTo(0);
    expect(s.sampleSize).toBe(1);
    expect(s.totalCombos).toBe(6); // pair
  });

  it('RFI, AKo(12콤보) user=call, gto=raise → VPIP 0, PFR -100%', () => {
    const r = makeRecord({ hand: 'AKo', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'call' });
    const s = computeDeviationStats([r])!;
    expect(s.vpipDelta).toBeCloseTo(0);
    expect(s.pfrDelta).toBeCloseTo(-100);
    expect(s.totalCombos).toBe(12);
  });

  it('RFI, AKs(4콤보) user=fold, gto=raise → VPIP -100%, PFR -100%', () => {
    const r = makeRecord({ hand: 'AKs', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'fold' });
    const s = computeDeviationStats([r])!;
    expect(s.vpipDelta).toBeCloseTo(-100);
    expect(s.pfrDelta).toBeCloseTo(-100);
  });

  it('RFI, user=raise gto=fold → VPIP +100%, PFR +100%', () => {
    const r = makeRecord({ hand: '72o', chartName: 'UTG RFI', correctAction: 'fold', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.vpipDelta).toBeCloseTo(100);
    expect(s.pfrDelta).toBeCloseTo(100);
  });

  it('콤보 가중 합산: AA(6) raise/raise + 72o(12) raise/fold → 편차 (12)/(18) = 66.7% on VPIP, PFR', () => {
    const records = [
      makeRecord({ hand: 'AA', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' }),
      makeRecord({ hand: '72o', chartName: 'UTG RFI', correctAction: 'fold', userAnswer: 'raise' }),
    ];
    const s = computeDeviationStats(records)!;
    // user VPIP combos = 6 + 12 = 18, GTO VPIP combos = 6 + 0 = 6; total = 18
    // delta = (18-6)/18 * 100 = 66.66...
    expect(s.vpipDelta).toBeCloseTo((12 / 18) * 100, 1);
    expect(s.pfrDelta).toBeCloseTo((12 / 18) * 100, 1);
  });

  it('RFI 차트에서 3Bet 편차는 집계에서 제외 (facingSampleSize=0)', () => {
    const r = makeRecord({ hand: 'AA', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.threebetSampleSize).toBe(0);
    expect(s.threebetDelta).toBeNull();
  });

  it('Facing RFI, user=threebet_value gto=call → 3Bet 편차 +100%', () => {
    const r = makeRecord({
      hand: 'AA',
      chartName: 'HJ vs UTG',
      correctAction: 'call',
      userAnswer: 'threebet_value',
    });
    const s = computeDeviationStats([r])!;
    expect(s.threebetDelta).toBeCloseTo(100);
    expect(s.threebetSampleSize).toBe(1);
    expect(s.threebetTotalCombos).toBe(6);
  });

  it('Facing RFI 15BB allIn은 3Bet으로 카운트', () => {
    const r = makeRecord({
      hand: 'AA',
      stack: '15BB',
      chartName: 'CO vs UTG RFI',
      correctAction: 'allIn',
      userAnswer: 'allIn',
    });
    const s = computeDeviationStats([r])!;
    expect(s.threebetDelta).toBeCloseTo(0); // user matches gto
    expect(s.threebetSampleSize).toBe(1);
  });

  it('Facing RFI 15BB user=fold, gto=allIn → 3Bet 편차 -100%', () => {
    const r = makeRecord({
      hand: 'AA',
      stack: '15BB',
      chartName: 'CO vs UTG RFI',
      correctAction: 'allIn',
      userAnswer: 'fold',
    });
    const s = computeDeviationStats([r])!;
    expect(s.threebetDelta).toBeCloseTo(-100);
  });

  it('혼합: RFI + Facing RFI, 각각 분모가 다름', () => {
    const records = [
      makeRecord({ hand: 'AA', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' }), // RFI 6
      makeRecord({ hand: 'AA', chartName: 'HJ vs UTG', correctAction: 'call', userAnswer: 'threebet_value' }), // facing 6
    ];
    const s = computeDeviationStats(records)!;
    expect(s.sampleSize).toBe(2);
    expect(s.totalCombos).toBe(12); // both records count toward VPIP/PFR
    expect(s.threebetSampleSize).toBe(1);
    expect(s.threebetTotalCombos).toBe(6); // only facing record
  });

  // --- Cold Call ---
  it('Cold Call: Facing-RFI call 콤보 편차', () => {
    // user call, gto raise → user cold call +, gto 0 → +100%
    const r = makeRecord({ hand: 'AA', chartName: 'HJ vs UTG', correctAction: 'threebet_value', userAnswer: 'call' });
    const s = computeDeviationStats([r])!;
    expect(s.coldCallDelta).toBeCloseTo(100);
    expect(s.coldCallSampleSize).toBe(1);
  });

  it('Cold Call: RFI 차트는 분모에 포함 안 됨', () => {
    const r = makeRecord({ hand: 'AA', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'call' });
    const s = computeDeviationStats([r])!;
    expect(s.coldCallDelta).toBeNull();
    expect(s.coldCallSampleSize).toBe(0);
  });

  // --- Steal ---
  it('Steal: CO/BTN/SB RFI에서 PFR 편차', () => {
    // user raise, gto fold → +100%
    const r = makeRecord({ hand: '72o', chartName: 'BTN RFI', correctAction: 'fold', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.stealDelta).toBeCloseTo(100);
    expect(s.stealSampleSize).toBe(1);
  });

  it('Steal: CO RFI도 포함', () => {
    const r = makeRecord({ hand: '72o', chartName: 'CO RFI', correctAction: 'fold', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.stealSampleSize).toBe(1);
  });

  it('Steal: SB RFI BvB도 포함', () => {
    const r = makeRecord({ hand: '72o', chartName: 'SB RFI BvB', correctAction: 'fold', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.stealSampleSize).toBe(1);
  });

  it('Steal: UTG RFI는 포함 안 됨', () => {
    const r = makeRecord({ hand: '72o', chartName: 'UTG RFI', correctAction: 'fold', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.stealSampleSize).toBe(0);
    expect(s.stealDelta).toBeNull();
  });

  // --- Fold to Steal ---
  it('Fold to Steal: SB vs BTN에서 user fold, gto raise → +100%', () => {
    const r = makeRecord({ hand: 'AA', chartName: 'SB vs BTN', correctAction: 'threebet_value', userAnswer: 'fold' });
    const s = computeDeviationStats([r])!;
    expect(s.foldToStealDelta).toBeCloseTo(100);
    expect(s.foldToStealSampleSize).toBe(1);
  });

  it('Fold to Steal: 15BB SB vs CO RFI도 포함', () => {
    const r = makeRecord({
      hand: 'AA', stack: '15BB', chartName: 'SB vs CO RFI',
      correctAction: 'allIn', userAnswer: 'fold',
    });
    const s = computeDeviationStats([r])!;
    expect(s.foldToStealSampleSize).toBe(1);
  });

  it('Fold to Steal: 100BB BB vs SB (SB steal) 포함', () => {
    const r = makeRecord({ hand: '72o', chartName: 'BB vs SB', correctAction: 'fold', userAnswer: 'fold' });
    const s = computeDeviationStats([r])!;
    expect(s.foldToStealSampleSize).toBe(1);
    expect(s.foldToStealDelta).toBeCloseTo(0); // both fold
  });

  it('Fold to Steal: SB vs UTG RFI는 포함 안 됨 (UTG는 스틸 아님)', () => {
    const r = makeRecord({ hand: 'AA', chartName: 'SB vs UTG RFI', correctAction: 'threebet', userAnswer: 'fold' });
    const s = computeDeviationStats([r])!;
    expect(s.foldToStealSampleSize).toBe(0);
    expect(s.foldToStealDelta).toBeNull();
  });

  it('Fold to Steal: CO vs BTN은 포함 안 됨 (hero가 SB/BB 아님)', () => {
    const r = makeRecord({ hand: 'AA', chartName: 'CO vs BTN', correctAction: 'fold', userAnswer: 'fold' });
    const s = computeDeviationStats([r])!;
    expect(s.foldToStealSampleSize).toBe(0);
  });

  it('Fold to Steal: 절대값 user/gto fold%', () => {
    const records = [
      makeRecord({ hand: 'AA', chartName: 'SB vs BTN', correctAction: 'threebet_value', userAnswer: 'fold' }),
      makeRecord({ hand: '72o', chartName: 'BB vs CO', correctAction: 'fold', userAnswer: 'fold' }),
    ];
    const s = computeDeviationStats(records)!;
    // user fold combos = 6 + 12 = 18, gto fold combos = 0 + 12 = 12, total = 18
    // user = 100%, gto = 66.7%
    expect(s.userFoldToStealPct).toBeCloseTo(100);
    expect(s.gtoFoldToStealPct).toBeCloseTo((12 / 18) * 100, 1);
    expect(s.foldToStealDelta).toBeCloseTo(((18 - 12) / 18) * 100, 1);
  });

  // --- Absolute values ---
  it('절대값: VPIP user=100%, gto=100% (둘 다 raise)', () => {
    const r = makeRecord({ hand: 'AA', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.userVpipPct).toBeCloseTo(100);
    expect(s.gtoVpipPct).toBeCloseTo(100);
    expect(s.userPfrPct).toBeCloseTo(100);
    expect(s.gtoPfrPct).toBeCloseTo(100);
  });

  it('절대값: user=call gto=raise → user VPIP 100%, PFR 0%, gto VPIP 100%, PFR 100%', () => {
    const r = makeRecord({ hand: 'AA', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'call' });
    const s = computeDeviationStats([r])!;
    expect(s.userVpipPct).toBeCloseTo(100);
    expect(s.gtoVpipPct).toBeCloseTo(100);
    expect(s.userPfrPct).toBeCloseTo(0);
    expect(s.gtoPfrPct).toBeCloseTo(100);
  });

  it('절대값: 3Bet (Facing-RFI 분모)', () => {
    const r = makeRecord({
      hand: 'AA', chartName: 'HJ vs UTG', correctAction: 'call', userAnswer: 'threebet_value',
    });
    const s = computeDeviationStats([r])!;
    expect(s.userThreebetPct).toBeCloseTo(100);
    expect(s.gtoThreebetPct).toBeCloseTo(0);
  });

  it('절대값: Cold Call', () => {
    const r = makeRecord({
      hand: 'AA', chartName: 'HJ vs UTG', correctAction: 'threebet_value', userAnswer: 'call',
    });
    const s = computeDeviationStats([r])!;
    expect(s.userColdCallPct).toBeCloseTo(100);
    expect(s.gtoColdCallPct).toBeCloseTo(0);
  });

  it('절대값: Steal (CO RFI에서 open/fold)', () => {
    const r = makeRecord({ hand: '72o', chartName: 'CO RFI', correctAction: 'fold', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.userStealPct).toBeCloseTo(100);
    expect(s.gtoStealPct).toBeCloseTo(0);
  });

  it('절대값: Fold to Steal null if no relevant records', () => {
    const r = makeRecord({ hand: 'AA', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.userFoldToStealPct).toBeNull();
    expect(s.gtoFoldToStealPct).toBeNull();
  });

  it('절대값: Facing 없으면 3Bet/ColdCall의 user/gto 모두 null', () => {
    const r = makeRecord({ hand: 'AA', chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' });
    const s = computeDeviationStats([r])!;
    expect(s.userThreebetPct).toBeNull();
    expect(s.gtoThreebetPct).toBeNull();
    expect(s.userColdCallPct).toBeNull();
    expect(s.gtoColdCallPct).toBeNull();
  });
});
