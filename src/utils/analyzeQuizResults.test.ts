import { describe, it, expect } from 'vitest';
import {
  classifyError,
  computeMetrics,
  classifyProfile,
  buildPriorities,
  analyzeQuizResults,
} from './analyzeQuizResults';
import type { QuizRecord, StackSize } from '../types';

function makeRecord(opts: {
  hand?: string;
  stack?: StackSize;
  chartName: string;
  heroPosition?: string;
  villainPosition?: string;
  correctAction: string;
  userAnswer: string;
}): QuizRecord {
  return {
    question: {
      stackSize: opts.stack ?? '100BB',
      chartName: opts.chartName,
      hand: opts.hand ?? 'AA',
      correctAction: opts.correctAction,
      heroPosition: opts.heroPosition ?? '',
      villainPosition: opts.villainPosition ?? '',
      situation: '',
    },
    userAnswer: opts.userAnswer,
    correct: opts.correctAction === opts.userAnswer,
    timestamp: 0,
  };
}

describe('classifyError', () => {
  it('tooTight_BB: BB에서 폴드해야 할 때가 아닌데 폴드', () => {
    const q = makeRecord({
      chartName: 'BB vs BTN', heroPosition: 'BB', villainPosition: 'BTN',
      correctAction: 'call', userAnswer: 'fold',
    }).question;
    expect(classifyError(q, 'fold')).toBe('tooTight_BB');
  });

  it('tooTight_RFI: RFI 차트에서 오픈해야 하는데 폴드', () => {
    const q = makeRecord({
      chartName: 'BTN RFI', heroPosition: 'BTN',
      correctAction: 'raise', userAnswer: 'fold',
    }).question;
    expect(classifyError(q, 'fold')).toBe('tooTight_RFI');
  });

  it('missedBluff: GTO가 bluff인데 폴드 (Facing RFI)', () => {
    const q = makeRecord({
      chartName: 'CO vs HJ', heroPosition: 'CO', villainPosition: 'HJ',
      correctAction: 'threebet_bluff', userAnswer: 'fold',
    }).question;
    expect(classifyError(q, 'fold')).toBe('missedBluff');
  });

  it('tooLoose: 폴드해야 하는데 플레이', () => {
    const q = makeRecord({
      chartName: 'UTG RFI', heroPosition: 'UTG',
      correctAction: 'fold', userAnswer: 'raise',
    }).question;
    expect(classifyError(q, 'raise')).toBe('tooLoose');
  });

  it('tooPassive: 레이즈/3벳해야 하는데 콜', () => {
    const q = makeRecord({
      chartName: 'HJ vs UTG', heroPosition: 'HJ', villainPosition: 'UTG',
      correctAction: 'threebet_value', userAnswer: 'call',
    }).question;
    expect(classifyError(q, 'call')).toBe('tooPassive');
  });

  it('overAggressive: 콜해야 하는데 3벳', () => {
    const q = makeRecord({
      chartName: 'HJ vs UTG', heroPosition: 'HJ', villainPosition: 'UTG',
      correctAction: 'call', userAnswer: 'threebet_value',
    }).question;
    expect(classifyError(q, 'threebet_value')).toBe('overAggressive');
  });

  it('other: 정답인 경우 (분류 밖)', () => {
    const q = makeRecord({
      chartName: 'UTG RFI', heroPosition: 'UTG',
      correctAction: 'raise', userAnswer: 'raise',
    }).question;
    expect(classifyError(q, 'raise')).toBe('other');
  });

  it('Facing RFI에서 BB가 과폴드: tooTight_BB 우선', () => {
    const q = makeRecord({
      chartName: 'BB vs CO', heroPosition: 'BB', villainPosition: 'CO',
      correctAction: 'threebet_bluff', userAnswer: 'fold',
    }).question;
    // BB fold to non-fold → tooTight_BB (heroPosition 우선)
    expect(classifyError(q, 'fold')).toBe('tooTight_BB');
  });
});

describe('computeMetrics', () => {
  it('VPIP compliance: GTO non-fold 3개 중 user non-fold 2개 → 2/3', () => {
    const records = [
      makeRecord({ chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' }),
      makeRecord({ chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'fold' }),
      makeRecord({ chartName: 'HJ vs UTG', correctAction: 'call', userAnswer: 'call' }),
      makeRecord({ chartName: 'UTG RFI', correctAction: 'fold', userAnswer: 'fold' }), // denom 제외
    ];
    const m = computeMetrics(records);
    expect(m.vpip.compliance).toBeCloseTo(2 / 3);
  });

  it('PFR compliance: RFI 차트 GTO raise 2개 중 user raise 1개 → 1/2', () => {
    const records = [
      makeRecord({ chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' }),
      makeRecord({ chartName: 'BTN RFI', correctAction: 'raise', userAnswer: 'call' }),
      makeRecord({ chartName: 'HJ vs UTG', correctAction: 'threebet_value', userAnswer: 'call' }), // facing, 제외
    ];
    const m = computeMetrics(records);
    expect(m.pfr.compliance).toBeCloseTo(1 / 2);
  });

  it('over3betRate: Facing RFI GTO call 2개 중 user 3bet 1개', () => {
    const records = [
      makeRecord({ chartName: 'HJ vs UTG', correctAction: 'call', userAnswer: 'threebet_value' }),
      makeRecord({ chartName: 'CO vs UTG', correctAction: 'call', userAnswer: 'call' }),
    ];
    const m = computeMetrics(records);
    expect(m.threebet.over3betRate).toBeCloseTo(1 / 2);
  });

  it('missedBluffRate: GTO bluff 액션 2개 중 user fold 1개', () => {
    const records = [
      makeRecord({ chartName: 'SB RFI', correctAction: 'raise_bluff', userAnswer: 'fold' }),
      makeRecord({ chartName: 'HJ vs UTG', correctAction: 'threebet_bluff', userAnswer: 'threebet_bluff' }),
    ];
    const m = computeMetrics(records);
    expect(m.threebet.missedBluffRate).toBeCloseTo(1 / 2);
  });

  it('coldCall compliance: GTO call 3개 중 user call 2개', () => {
    const records = [
      makeRecord({ chartName: 'HJ vs UTG', correctAction: 'call', userAnswer: 'call' }),
      makeRecord({ chartName: 'CO vs UTG', correctAction: 'call', userAnswer: 'fold' }),
      makeRecord({ chartName: 'BB vs CO', correctAction: 'call', userAnswer: 'call' }),
    ];
    const m = computeMetrics(records);
    expect(m.coldCall.compliance).toBeCloseTo(2 / 3);
  });

  it('steal compliance: CO/BTN/SB RFI GTO raise 2개 중 user raise 1개', () => {
    const records = [
      makeRecord({ chartName: 'BTN RFI', correctAction: 'raise', userAnswer: 'raise' }),
      makeRecord({ chartName: 'CO RFI', correctAction: 'raise', userAnswer: 'fold' }),
      makeRecord({ chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'fold' }), // 스틸 아님
    ];
    const m = computeMetrics(records);
    expect(m.steal.compliance).toBeCloseTo(1 / 2);
  });

  it('positionSense: 정답률이 포지션별 균일할수록 score↑', () => {
    const records = [
      makeRecord({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'raise', userAnswer: 'raise' }),
      makeRecord({ chartName: 'BTN RFI', heroPosition: 'BTN', correctAction: 'raise', userAnswer: 'raise' }),
      makeRecord({ chartName: 'HJ RFI', heroPosition: 'HJ', correctAction: 'raise', userAnswer: 'raise' }),
    ];
    const m = computeMetrics(records);
    expect(m.positionSense.score).toBeCloseTo(1, 1); // 모두 100% → stddev 0 → score 1
  });

  it('positionSense: weakPositions는 평균-0.15 미만 포지션', () => {
    const records = [
      // UTG 2개 중 2개 정답 (100%)
      makeRecord({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'raise', userAnswer: 'raise' }),
      makeRecord({ chartName: 'UTG RFI', heroPosition: 'UTG', correctAction: 'fold', userAnswer: 'fold' }),
      // BTN 2개 중 2개 정답 (100%)
      makeRecord({ chartName: 'BTN RFI', heroPosition: 'BTN', correctAction: 'raise', userAnswer: 'raise' }),
      makeRecord({ chartName: 'BTN RFI', heroPosition: 'BTN', correctAction: 'raise', userAnswer: 'raise' }),
      // HJ 2개 중 0개 정답 (0%)  → 약점
      makeRecord({ chartName: 'HJ RFI', heroPosition: 'HJ', correctAction: 'raise', userAnswer: 'fold' }),
      makeRecord({ chartName: 'HJ RFI', heroPosition: 'HJ', correctAction: 'raise', userAnswer: 'fold' }),
    ];
    const m = computeMetrics(records);
    expect(m.positionSense.weakPositions).toContain('HJ');
  });
});

describe('classifyProfile', () => {
  const base = {
    vpip: { compliance: 0.9, deviation: '' },
    pfr: { compliance: 0.9, deviation: '' },
    threebet: { over3betRate: 0.15, missedBluffRate: 0.2, verdict: '' },
    coldCall: { compliance: 0.8, verdict: '' },
    steal: { compliance: 0.85, verdict: '' },
    positionSense: { score: 0.9, weakPositions: [] },
  };

  it('Balanced: 모두 중간 범위', () => {
    expect(classifyProfile(base, 0)).toBe('Balanced');
  });

  it('Nit: vpipCompliance < 0.80', () => {
    expect(classifyProfile({ ...base, vpip: { compliance: 0.7, deviation: '' } }, 0)).toBe('Nit');
  });

  it('TAG-Linear: vpipCompliance < 0.85 && over3betRate > 0.3', () => {
    const m = {
      ...base,
      vpip: { compliance: 0.82, deviation: '' },
      threebet: { ...base.threebet, over3betRate: 0.35 },
    };
    expect(classifyProfile(m, 0)).toBe('TAG-Linear');
  });

  it('LAG: tooLooseRate > 0.15', () => {
    // 100 total, tooLoose 20 → 0.20
    expect(classifyProfile(base, 20 / 100)).toBe('LAG');
  });

  it('Passive: over3betRate<0.1 && missedBluffRate>0.3', () => {
    const m = {
      ...base,
      threebet: { over3betRate: 0.05, missedBluffRate: 0.4, verdict: '' },
    };
    expect(classifyProfile(m, 0)).toBe('Passive');
  });
});

describe('buildPriorities', () => {
  it('가장 많은 버킷이 rank 1, other는 제외', () => {
    const buckets = {
      tooTight_BB: [makeRecord({ chartName: 'BB vs CO', correctAction: 'call', userAnswer: 'fold' })],
      tooTight_RFI: [],
      tooLoose: [
        makeRecord({ chartName: 'UTG RFI', correctAction: 'fold', userAnswer: 'raise' }),
        makeRecord({ chartName: 'UTG RFI', correctAction: 'fold', userAnswer: 'raise' }),
        makeRecord({ chartName: 'UTG RFI', correctAction: 'fold', userAnswer: 'raise' }),
      ],
      tooPassive: [makeRecord({ chartName: 'HJ vs UTG', correctAction: 'threebet_value', userAnswer: 'call' })],
      overAggressive: [],
      missedBluff: [],
      other: [makeRecord({ chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' })],
    };
    const p = buildPriorities(buckets);
    expect(p[0].bucket).toBe('tooLoose');
    expect(p[0].rank).toBe(1);
    expect(p.length).toBe(3);
    // other는 포함 안 됨
    expect(p.find(x => x.bucket === ('other' as never))).toBeUndefined();
  });

  it('빈 에러 버킷만 있으면 priorities 0개', () => {
    const buckets = {
      tooTight_BB: [], tooTight_RFI: [], tooLoose: [],
      tooPassive: [], overAggressive: [], missedBluff: [], other: [],
    };
    expect(buildPriorities(buckets).length).toBe(0);
  });
});

describe('analyzeQuizResults', () => {
  it('빈 레코드 → totalQuestions 0 + accuracy 0', () => {
    const p = analyzeQuizResults([]);
    expect(p.totalQuestions).toBe(0);
    expect(p.accuracy).toBe(0);
    expect(p.priorities.length).toBe(0);
  });

  it('정답 레코드만 → 모두 other 버킷, priorities 없음', () => {
    const records = [
      makeRecord({ chartName: 'UTG RFI', correctAction: 'raise', userAnswer: 'raise' }),
    ];
    const p = analyzeQuizResults(records);
    expect(p.accuracy).toBe(1);
    expect(p.errorBuckets.other.length).toBe(1);
    expect(p.priorities.length).toBe(0);
  });
});
