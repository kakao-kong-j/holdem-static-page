import { describe, it, expect } from 'vitest';
import { classifyWeakness, isWeaknessSpot, analyzeWeaknesses, detectStackInconsistency } from './analyzeQuizResults';
import type { QuizRecord, StackSize, QuizQuestion } from '../types';

function makeQ(opts: Partial<QuizQuestion> & { chartName: string; stack?: StackSize }): QuizQuestion {
  const { stack, ...rest } = opts;
  return {
    stackSize: stack ?? '100BB',
    hand: 'AKs',
    correctAction: 'raise',
    heroPosition: '',
    villainPosition: '',
    situation: '',
    ...rest,
  };
}

function makeRec(opts: Partial<QuizQuestion> & { chartName: string; userAnswer: string; stack?: StackSize }): QuizRecord {
  const q = makeQ(opts);
  return {
    question: q,
    userAnswer: opts.userAnswer,
    correct: q.correctAction === opts.userAnswer,
    timestamp: 0,
  };
}

describe('classifyWeakness — 24 categories', () => {
  // [A] RFI
  it('A1_EP_타이트: UTG RFI raise→fold', () => {
    expect(classifyWeakness(makeQ({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'raise' }), 'fold')).toBe('A1_EP_타이트');
  });
  it('A1_EP_타이트: UTG+1 RFI raise→fold', () => {
    expect(classifyWeakness(makeQ({ chartName: 'UTG+1 RFI', heroPosition: 'UTG+1', correctAction: 'raise' }), 'fold')).toBe('A1_EP_타이트');
  });
  it('A2_MP_타이트: HJ RFI raise→fold', () => {
    expect(classifyWeakness(makeQ({ chartName: 'HJ RFI', heroPosition: 'HJ', correctAction: 'raise' }), 'fold')).toBe('A2_MP_타이트');
  });
  it('A2_MP_타이트: LJ/HJ 결합 라벨도 MP', () => {
    expect(classifyWeakness(makeQ({ chartName: 'LJ/HJ vs UTG RFI', heroPosition: 'LJ/HJ', villainPosition: 'UTG', correctAction: 'call' }), 'fold')).not.toBe('A2_MP_타이트'); // facing-rfi라 B 분기로 가야 함
  });
  it('A3_LP_타이트: BTN RFI raise→fold', () => {
    expect(classifyWeakness(makeQ({ chartName: 'BTN RFI', heroPosition: 'BTN', correctAction: 'raise' }), 'fold')).toBe('A3_LP_타이트');
  });
  it('A4_SB_보수적: SB RFI raise→fold', () => {
    expect(classifyWeakness(makeQ({ chartName: 'SB RFI', heroPosition: 'SB', correctAction: 'raise' }), 'fold')).toBe('A4_SB_보수적');
  });
  it('A5_오픈_루즈: UTG RFI fold→raise', () => {
    expect(classifyWeakness(makeQ({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'fold' }), 'raise')).toBe('A5_오픈_루즈');
  });

  // [B] Facing RFI
  it('B7_BB디펜스_15BB', () => {
    expect(classifyWeakness(makeQ({ stack: '15BB', chartName: 'BB vs UTG RFI', heroPosition: 'BB', villainPosition: 'UTG', correctAction: 'call' }), 'fold')).toBe('B7_BB디펜스_15BB');
  });
  it('B8_BB디펜스_25_40BB: 25BB', () => {
    expect(classifyWeakness(makeQ({ stack: '25BB', chartName: 'BB vs CO RFI', heroPosition: 'BB', villainPosition: 'CO', correctAction: 'call' }), 'fold')).toBe('B8_BB디펜스_25_40BB');
  });
  it('B8_BB디펜스_25_40BB: 40BB', () => {
    expect(classifyWeakness(makeQ({ stack: '40BB', chartName: 'BB vs BTN RFI', heroPosition: 'BB', villainPosition: 'BTN', correctAction: 'call' }), 'fold')).toBe('B8_BB디펜스_25_40BB');
  });
  it('B9_SB_혼동: SB facing fold→call', () => {
    expect(classifyWeakness(makeQ({ chartName: 'SB vs BTN', heroPosition: 'SB', villainPosition: 'BTN', correctAction: 'call' }), 'fold')).toBe('B9_SB_혼동');
  });
  it('B10_IP플랫_부재: BTN vs HJ call→fold', () => {
    expect(classifyWeakness(makeQ({ chartName: 'BTN vs HJ', heroPosition: 'BTN', villainPosition: 'HJ', correctAction: 'call' }), 'fold')).toBe('B10_IP플랫_부재');
  });
  it('B11_vsEP_오버3bet: HJ vs UTG call→3bet', () => {
    expect(classifyWeakness(makeQ({ chartName: 'HJ vs UTG', heroPosition: 'HJ', villainPosition: 'UTG', correctAction: 'call' }), 'threebet_value')).toBe('B11_vsEP_오버3bet');
  });
  it('B12_vsLP_오버3bet: BB vs BTN call→3bet', () => {
    expect(classifyWeakness(makeQ({ chartName: 'BB vs BTN', heroPosition: 'BB', villainPosition: 'BTN', correctAction: 'call' }), 'threebet_value')).toBe('B12_vsLP_오버3bet');
  });

  // [C] 공격/블러프
  it('C13_블러프3bet_부재: threebet_bluff→fold', () => {
    expect(classifyWeakness(makeQ({ chartName: 'SB vs CO', heroPosition: 'SB', villainPosition: 'CO', correctAction: 'threebet_bluff' }), 'fold')).toBe('C13_블러프3bet_부재');
  });
  it('C14_블러프RFI_부재: raise_bluff→fold', () => {
    expect(classifyWeakness(makeQ({ chartName: 'SB RFI', heroPosition: 'SB', correctAction: 'raise_bluff' }), 'fold')).toBe('C14_블러프RFI_부재');
  });
  it('C15_밸류3bet_누락: threebet_value 정답을 다른 답', () => {
    expect(classifyWeakness(makeQ({ chartName: 'BTN vs CO', heroPosition: 'BTN', villainPosition: 'CO', correctAction: 'threebet_value' }), 'call')).toBe('C15_밸류3bet_누락');
  });
  it('C17_트랩_실패: AA로 call 정답인데 3bet', () => {
    expect(classifyWeakness(makeQ({ chartName: 'HJ vs UTG', heroPosition: 'HJ', villainPosition: 'UTG', hand: 'AA', correctAction: 'call' }), 'threebet_value')).toBe('C17_트랩_실패');
  });
  // C16, C18은 현재 차트에 없어 트리거되지 않음 — 통과만 검증
  it('C16_스퀴즈_부재: 현재 트리거 없음 (other)', () => {
    expect(classifyWeakness(makeQ({ chartName: 'SB RFI', heroPosition: 'SB', correctAction: 'raise' }), 'fold')).not.toBe('C16_스퀴즈_부재');
  });

  // [D] 스택/특수
  it('D19_15BB_올인기준: 15BB allIn→fold', () => {
    expect(classifyWeakness(makeQ({ stack: '15BB', chartName: 'CO RFI', heroPosition: 'CO', correctAction: 'allIn' }), 'fold')).toBe('D19_15BB_올인기준');
  });
  it('D21_40BB_3bet후대응: raise_fold→다른 답', () => {
    expect(classifyWeakness(makeQ({ stack: '40BB', chartName: 'SB RFI BvB', heroPosition: 'SB', villainPosition: 'BB', correctAction: 'raise_fold' }), 'raise_call')).toBe('D21_40BB_3bet후대응');
  });
  it('D22_100BB_플랫: 100BB RFI call→3bet', () => {
    expect(classifyWeakness(makeQ({ stack: '100BB', chartName: 'BTN RFI', heroPosition: 'BTN', correctAction: 'call' }), 'threebet_value')).toBe('D22_100BB_플랫');
  });
  it('D23_SB_림프: 100BB SB limp 정답을 다른 답', () => {
    expect(classifyWeakness(makeQ({ stack: '100BB', chartName: 'SB RFI', heroPosition: 'SB', correctAction: 'limp' }), 'fold')).toBe('D23_SB_림프');
  });
  it('D24_BvB_혼동: SB RFI BvB 차트', () => {
    expect(classifyWeakness(makeQ({ chartName: 'SB RFI BvB', heroPosition: 'SB', villainPosition: 'BB', correctAction: 'raise' }), 'fold')).toBe('D24_BvB_혼동');
  });
});

describe('isWeaknessSpot', () => {
  it('A1 spot: UTG RFI raise 정답이면 spot', () => {
    expect(isWeaknessSpot(makeQ({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'raise' }), 'A1_EP_타이트')).toBe(true);
  });
  it('A1 spot: UTG RFI fold 정답이면 spot 아님', () => {
    expect(isWeaknessSpot(makeQ({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'fold' }), 'A1_EP_타이트')).toBe(false);
  });
});

describe('analyzeWeaknesses', () => {
  it('TOP 3: 카운트 내림차순, other 제외, count<2 제외', () => {
    const recs: QuizRecord[] = [
      // tooLoose 3개 — A5
      makeRec({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'fold', userAnswer: 'raise' }),
      makeRec({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'fold', userAnswer: 'raise' }),
      makeRec({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'fold', userAnswer: 'raise' }),
      // BB 디펜스 2개 — B7
      makeRec({ stack: '15BB', chartName: 'BB vs UTG RFI', heroPosition: 'BB', villainPosition: 'UTG', correctAction: 'call', userAnswer: 'fold' }),
      makeRec({ stack: '15BB', chartName: 'BB vs UTG RFI', heroPosition: 'BB', villainPosition: 'UTG', correctAction: 'call', userAnswer: 'fold' }),
      // BB 디펜스 2개 — B8
      makeRec({ stack: '25BB', chartName: 'BB vs CO RFI', heroPosition: 'BB', villainPosition: 'CO', correctAction: 'call', userAnswer: 'fold' }),
      makeRec({ stack: '40BB', chartName: 'BB vs BTN RFI', heroPosition: 'BB', villainPosition: 'BTN', correctAction: 'call', userAnswer: 'fold' }),
      // 단일 에러 (count=1) → TOP에서 제외
      makeRec({ chartName: 'BTN RFI', heroPosition: 'BTN', correctAction: 'raise', userAnswer: 'fold' }),
    ];
    const w = analyzeWeaknesses(recs);
    expect(w.top3).toHaveLength(3);
    expect(w.top3[0].weaknessId).toBe('A5_오픈_루즈'); // 3
    // 2위/3위는 B7과 B8 (각각 2개)
    expect(w.top3[1].errorCount).toBe(2);
    expect(w.top3[2].errorCount).toBe(2);
    // 단일 에러 약점은 미포함
    expect(w.top3.find(t => t.weaknessId === 'A3_LP_타이트')).toBeUndefined();
  });

  it('severity = errors / spots: 4 spot 중 3 오답 → 75%', () => {
    const recs: QuizRecord[] = [
      makeRec({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'raise', userAnswer: 'fold' }),
      makeRec({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'raise', userAnswer: 'fold' }),
      makeRec({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'raise', userAnswer: 'fold' }),
      makeRec({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'raise', userAnswer: 'raise' }),
    ];
    const w = analyzeWeaknesses(recs);
    const a1 = w.byWeakness['A1_EP_타이트']!;
    expect(a1.errorCount).toBe(3);
    expect(a1.spotCount).toBe(4);
    expect(a1.severity).toBeCloseTo(0.75);
  });
});

describe('detectStackInconsistency (A6)', () => {
  it('같은 (포지션, 핸드)에서 스택만 다를 때 정답률 차이 → 검출', () => {
    const recs: QuizRecord[] = [
      makeRec({ stack: '100BB', hand: 'AKo', chartName: 'CO RFI', heroPosition: 'CO', correctAction: 'raise', userAnswer: 'raise' }), // 정답
      makeRec({ stack: '15BB', hand: 'AKo', chartName: 'CO RFI', heroPosition: 'CO', correctAction: 'allIn', userAnswer: 'fold' }), // 오답
    ];
    const flagged = detectStackInconsistency(recs);
    expect(flagged.length).toBeGreaterThan(0);
  });

  it('같은 핸드 모두 정답이면 검출 안 됨', () => {
    const recs: QuizRecord[] = [
      makeRec({ stack: '100BB', hand: 'AA', chartName: 'CO RFI', heroPosition: 'CO', correctAction: 'raise', userAnswer: 'raise' }),
      makeRec({ stack: '15BB', hand: 'AA', chartName: 'CO RFI', heroPosition: 'CO', correctAction: 'allIn', userAnswer: 'allIn' }),
    ];
    expect(detectStackInconsistency(recs)).toHaveLength(0);
  });

  it('단일 스택 데이터만 있으면 검출 안 됨', () => {
    const recs: QuizRecord[] = [
      makeRec({ stack: '100BB', hand: 'AA', chartName: 'CO RFI', heroPosition: 'CO', correctAction: 'raise', userAnswer: 'raise' }),
      makeRec({ stack: '100BB', hand: 'AA', chartName: 'CO RFI', heroPosition: 'CO', correctAction: 'raise', userAnswer: 'fold' }),
    ];
    expect(detectStackInconsistency(recs)).toHaveLength(0);
  });
});
