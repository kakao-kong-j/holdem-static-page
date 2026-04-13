import type { QuizRecord, QuizQuestion, StackSize } from '../types';
import { getChartContext, classifyAction } from './stats';

export type ErrorBucket =
  | 'tooTight_BB'
  | 'tooTight_RFI'
  | 'tooLoose'
  | 'tooPassive'
  | 'overAggressive'
  | 'missedBluff'
  | 'other';

export type ProfileLabel = 'TAG-Linear' | 'Nit' | 'LAG' | 'Passive' | 'Balanced';

export interface Metrics {
  vpip: { compliance: number; deviation: string };
  pfr: { compliance: number; deviation: string };
  threebet: { over3betRate: number; missedBluffRate: number; verdict: string };
  positionSense: { score: number; weakPositions: string[] };
  coldCall: { compliance: number; verdict: string };
  steal: { compliance: number; verdict: string };
}

export type ErrorBuckets = Record<ErrorBucket, QuizRecord[]>;

export interface Priority {
  rank: number;
  bucket: ErrorBucket;
  title: string;
  description: string;
  chartLink: { stack: StackSize; chartName: string; type: 'rfi' | 'facing' };
}

export interface PlayerProfile {
  accuracy: number;
  totalQuestions: number;
  profileLabel: ProfileLabel;
  metrics: Metrics;
  errorBuckets: ErrorBuckets;
  priorities: Priority[];
}

const PASSIVE_CORRECT_FOR_PASSIVE_ERROR = new Set([
  'threebet', 'threebet_value', 'threebet_bluff', 'allIn', 'raise',
]);

const STEAL_RFI_CHARTS = new Set(['CO RFI', 'BTN RFI', 'SB RFI', 'SB RFI BvB']);

export function classifyError(q: QuizQuestion, userAnswer: string): ErrorBucket {
  const correct = q.correctAction;
  const isFacingRFI = getChartContext(q.chartName) === 'facing-rfi';

  if (userAnswer === correct) return 'other';

  if (userAnswer === 'fold' && correct !== 'fold') {
    if (q.heroPosition === 'BB') return 'tooTight_BB';
    if (!isFacingRFI) return 'tooTight_RFI';
    if (correct.includes('bluff')) return 'missedBluff';
    return 'tooTight_RFI';
  }
  if (userAnswer !== 'fold' && correct === 'fold') return 'tooLoose';
  if (userAnswer === 'call' && PASSIVE_CORRECT_FOR_PASSIVE_ERROR.has(correct)) {
    return 'tooPassive';
  }
  if (userAnswer.startsWith('threebet') && correct === 'call') return 'overAggressive';
  return 'other';
}

function bucketErrors(records: QuizRecord[]): ErrorBuckets {
  const buckets: ErrorBuckets = {
    tooTight_BB: [],
    tooTight_RFI: [],
    tooLoose: [],
    tooPassive: [],
    overAggressive: [],
    missedBluff: [],
    other: [],
  };
  for (const r of records) {
    const b = classifyError(r.question, r.userAnswer);
    buckets[b].push(r);
  }
  return buckets;
}

function verdictFromDeviation(userRate: number, gtoRate: number, positiveLabel: string, negativeLabel: string): string {
  const delta = userRate - gtoRate;
  if (Math.abs(delta) < 0.05) return '균형';
  return delta > 0 ? positiveLabel : negativeLabel;
}

export function computeMetrics(records: QuizRecord[]): Metrics {
  // Counters
  let vpipDenom = 0, vpipNum = 0;
  let pfrDenom = 0, pfrNum = 0;
  let over3betDenom = 0, over3betNum = 0;
  let bluffDenom = 0, bluffMissedNum = 0;
  let ccDenom = 0, ccNum = 0;
  let stealDenom = 0, stealNum = 0;

  // For "deviation" strings: aggregate user vs gto "plays" (non-fold)
  let userPlayCombos = 0, gtoPlayCombos = 0, totalCombos = 0;
  // For PFR deviation: user raises vs gto raises in RFI
  let userRfiRaises = 0, gtoRfiRaises = 0, rfiTotal = 0;

  // Position accuracy for positionSense
  const posCorrect = new Map<string, number>();
  const posTotal = new Map<string, number>();

  for (const r of records) {
    const q = r.question;
    const gto = q.correctAction;
    const user = r.userAnswer;
    const ctx = getChartContext(q.chartName);
    const actionCtx = { isFacingRFI: ctx === 'facing-rfi', stack: q.stackSize };
    const userBuckets = classifyAction(user, actionCtx);
    const gtoBuckets = classifyAction(gto, actionCtx);

    // Track position accuracy (skip blank positions)
    if (q.heroPosition) {
      posTotal.set(q.heroPosition, (posTotal.get(q.heroPosition) ?? 0) + 1);
      if (r.correct) posCorrect.set(q.heroPosition, (posCorrect.get(q.heroPosition) ?? 0) + 1);
    }

    // VPIP compliance: GTO가 폴드 아닌 스팟에서 user도 폴드 아님
    if (gtoBuckets.vpip) {
      vpipDenom++;
      if (userBuckets.vpip) vpipNum++;
    }

    // PFR compliance: RFI 차트에서 GTO가 PFR (raise/allIn/raise_bluff 등) 액션
    if (ctx === 'rfi' && gtoBuckets.pfr) {
      pfrDenom++;
      if (userBuckets.pfr) pfrNum++;
    }

    // Over-3bet Rate (Facing-RFI, GTO가 call일 때 user가 threebet 계열 선택)
    if (ctx === 'facing-rfi' && gto === 'call') {
      over3betDenom++;
      if (userBuckets.threebet) over3betNum++;
    }

    // Missed Bluff Rate (GTO가 *bluff* 액션인데 user가 fold)
    if (gto.includes('bluff')) {
      bluffDenom++;
      if (user === 'fold') bluffMissedNum++;
    }

    // Cold Call compliance (Facing-RFI에서 GTO가 'call')
    if (ctx === 'facing-rfi' && gto === 'call') {
      ccDenom++;
      if (user === 'call') ccNum++;
    }

    // Steal compliance: CO/BTN/SB RFI에서 GTO가 PFR (15BB allIn, 100BB raise/raise_bluff 모두 포함)
    if (STEAL_RFI_CHARTS.has(q.chartName) && gtoBuckets.pfr) {
      stealDenom++;
      if (userBuckets.pfr) stealNum++;
    }

    // deviation aggregates (no combo weight — reuse record-unit)
    totalCombos++;
    if (gtoBuckets.vpip) gtoPlayCombos++;
    if (userBuckets.vpip) userPlayCombos++;
    if (ctx === 'rfi') {
      rfiTotal++;
      if (gtoBuckets.pfr) gtoRfiRaises++;
      if (userBuckets.pfr) userRfiRaises++;
    }
  }

  const rate = (num: number, denom: number) => denom === 0 ? 0 : num / denom;

  const vpipCompliance = rate(vpipNum, vpipDenom);
  const pfrCompliance = rate(pfrNum, pfrDenom);
  const over3betRate = rate(over3betNum, over3betDenom);
  const missedBluffRate = rate(bluffMissedNum, bluffDenom);
  const ccCompliance = rate(ccNum, ccDenom);
  const stealCompliance = rate(stealNum, stealDenom);

  // Position Sensitivity
  const positions = Array.from(posTotal.keys()).filter(p => (posTotal.get(p) ?? 0) > 0);
  const accByPos: Record<string, number> = {};
  positions.forEach(p => {
    accByPos[p] = (posCorrect.get(p) ?? 0) / (posTotal.get(p) ?? 1);
  });
  let score = 1;
  let weakPositions: string[] = [];
  if (positions.length > 1) {
    const values = Object.values(accByPos);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);
    const normalized = Math.min(stddev / 0.5, 1);
    score = 1 - normalized;
    weakPositions = positions.filter(p => accByPos[p] < mean - 0.15);
  }

  // Deviation strings
  const userVpipRate = rate(userPlayCombos, totalCombos);
  const gtoVpipRate = rate(gtoPlayCombos, totalCombos);
  const vpipDev = verdictFromDeviation(userVpipRate, gtoVpipRate, '루즈', '타이트');

  const userPfrRate = rate(userRfiRaises, rfiTotal);
  const gtoPfrRate = rate(gtoRfiRaises, rfiTotal);
  const pfrDev = verdictFromDeviation(userPfrRate, gtoPfrRate, '어그로', '패시브');

  const tbVerdict =
    over3betRate > 0.3 ? '과공격' :
    missedBluffRate > 0.3 ? '블러프 놓침' :
    '균형';

  const ccVerdict =
    ccCompliance < 0.5 ? '콜 부족' :
    ccCompliance > 0.9 ? '콜링 과다' :
    '적절';

  const stealVerdict =
    stealCompliance > 0.9 ? '적극적' :
    stealCompliance < 0.7 ? '소극적' :
    '균형';

  return {
    vpip: { compliance: vpipCompliance, deviation: vpipDev },
    pfr: { compliance: pfrCompliance, deviation: pfrDev },
    threebet: { over3betRate, missedBluffRate, verdict: tbVerdict },
    positionSense: { score, weakPositions },
    coldCall: { compliance: ccCompliance, verdict: ccVerdict },
    steal: { compliance: stealCompliance, verdict: stealVerdict },
  };
}

export function classifyProfile(m: Metrics, tooLooseRate: number): ProfileLabel {
  if (m.vpip.compliance < 0.85 && m.threebet.over3betRate > 0.3) return 'TAG-Linear';
  if (m.vpip.compliance < 0.80) return 'Nit';
  if (tooLooseRate > 0.15) return 'LAG';
  if (m.threebet.over3betRate < 0.1 && m.threebet.missedBluffRate > 0.3) return 'Passive';
  return 'Balanced';
}

const PRIORITY_MAP: Record<Exclude<ErrorBucket, 'other'>, { title: string; description: string; chartLink: Priority['chartLink'] }> = {
  tooTight_BB: {
    title: 'BB 디펜스 강화',
    description: 'BB에서 플레이해야 할 핸드를 폴드하고 있습니다. 디펜스 레인지를 넓히세요.',
    chartLink: { stack: '15BB', chartName: 'BB vs UTG RFI', type: 'facing' },
  },
  overAggressive: {
    title: 'vs EP 강한핸드 플랫 학습',
    description: 'EP 오픈에 3벳을 과하게 하고 있습니다. 콜드 콜 레인지를 익히세요.',
    chartLink: { stack: '100BB', chartName: 'HJ vs UTG', type: 'facing' },
  },
  missedBluff: {
    title: '블러프 3bet 레인지 추가',
    description: '블러프 플레이어블 핸드를 폴드하고 있습니다. 블러프 후보를 외우세요.',
    chartLink: { stack: '100BB', chartName: 'SB RFI', type: 'rfi' },
  },
  tooPassive: {
    title: 'SB 공격적 푸시',
    description: '레이즈/3벳해야 할 핸드를 콜로 처리하고 있습니다.',
    chartLink: { stack: '25BB', chartName: 'SB vs BTN RFI', type: 'facing' },
  },
  tooTight_RFI: {
    title: '마진 RFI 핸드 학습',
    description: 'RFI에서 마진 핸드를 폴드하고 있습니다. 포지션별 오픈 레인지를 넓히세요.',
    chartLink: { stack: '40BB', chartName: 'HJ RFI', type: 'rfi' },
  },
  tooLoose: {
    title: '타이트한 폴드 기준 연습',
    description: '폴드해야 할 핸드를 플레이하고 있습니다. EP 기준 타이트 레인지 점검.',
    chartLink: { stack: '25BB', chartName: 'CO vs LJ/HJ RFI', type: 'facing' },
  },
};

export function buildPriorities(buckets: ErrorBuckets): Priority[] {
  const keys: Exclude<ErrorBucket, 'other'>[] = [
    'tooTight_BB', 'tooTight_RFI', 'tooLoose', 'tooPassive', 'overAggressive', 'missedBluff',
  ];
  const sorted = keys
    .map(k => ({ bucket: k, count: buckets[k].length }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return sorted.map((x, i) => {
    const meta = PRIORITY_MAP[x.bucket];
    return {
      rank: i + 1,
      bucket: x.bucket,
      title: meta.title,
      description: meta.description,
      chartLink: meta.chartLink,
    };
  });
}

export function analyzeQuizResults(records: QuizRecord[]): PlayerProfile {
  const total = records.length;
  if (total === 0) {
    return {
      accuracy: 0,
      totalQuestions: 0,
      profileLabel: 'Balanced',
      metrics: computeMetrics([]),
      errorBuckets: bucketErrors([]),
      priorities: [],
    };
  }

  const correctCount = records.filter(r => r.correct).length;
  const accuracy = correctCount / total;

  const errorBuckets = bucketErrors(records);
  const metrics = computeMetrics(records);
  const tooLooseRate = errorBuckets.tooLoose.length / total;
  const profileLabel = classifyProfile(metrics, tooLooseRate);
  const priorities = buildPriorities(errorBuckets);

  return {
    accuracy,
    totalQuestions: total,
    profileLabel,
    metrics,
    errorBuckets,
    priorities,
  };
}
