import type { QuizRecord, QuizQuestion, StackSize } from '../types';
import { getChartContext, classifyAction, STEAL_RFI_CHARTS } from './stats';
import { WEAKNESS_MAP, type WeaknessId, type WeaknessMeta, type WeaknessCategory } from './weaknessMap';

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
  weaknessAnalysis: WeaknessAnalysis;
}

export interface WeaknessSummary {
  rank: number;
  weaknessId: Exclude<WeaknessId, 'other'>;
  errorCount: number;
  spotCount: number;
  severity: number; // 0-1
  meta: WeaknessMeta;
}

export interface WeaknessBucket {
  errorCount: number;
  spotCount: number;
  severity: number;
  errors: QuizRecord[];
}

export interface WeaknessAnalysis {
  byWeakness: Partial<Record<WeaknessId, WeaknessBucket>>;
  top3: WeaknessSummary[];
  stackInconsistencies: QuizRecord[];
}

export function classifyError(q: QuizQuestion, userAnswer: string): ErrorBucket {
  const correct = q.correctAction;
  if (userAnswer === correct) return 'other';

  const isFacingRFI = getChartContext(q.chartName) === 'facing-rfi';
  const userBuckets = classifyAction(userAnswer, { isFacingRFI, stack: q.stackSize });
  const gtoBuckets = classifyAction(correct, { isFacingRFI, stack: q.stackSize });

  // 1. fold should not have been fold
  if (userAnswer === 'fold' && correct !== 'fold') {
    if (q.heroPosition === 'BB') return 'tooTight_BB';
    if (!isFacingRFI) return 'tooTight_RFI';
    if (correct.includes('bluff')) return 'missedBluff';
    return 'tooTight_RFI';
  }
  // 2. should have folded but didn't
  if (userAnswer !== 'fold' && correct === 'fold') return 'tooLoose';

  // 3. should have raised/3bet but only called or limped
  // gto wants any aggressive action (PFR family) and user picked passive (call/limp)
  if (gtoBuckets.pfr && !userBuckets.pfr) return 'tooPassive';

  // 4. should have called but raised/3bet
  if (correct === 'call' && userBuckets.pfr) return 'overAggressive';

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
    if (r.correct) continue; // 정답은 'other'에 섞지 않음 (분류 불가 에러만 'other')
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
      weaknessAnalysis: { byWeakness: {}, top3: [], stackInconsistencies: [] },
    };
  }

  const correctCount = records.filter(r => r.correct).length;
  const accuracy = correctCount / total;

  const errorBuckets = bucketErrors(records);
  const metrics = computeMetrics(records);
  const tooLooseRate = errorBuckets.tooLoose.length / total;
  const profileLabel = classifyProfile(metrics, tooLooseRate);
  const priorities = buildPriorities(errorBuckets);
  const weaknessAnalysis = analyzeWeaknesses(records);

  return {
    accuracy,
    totalQuestions: total,
    profileLabel,
    metrics,
    errorBuckets,
    priorities,
    weaknessAnalysis,
  };
}

// ============================================================
// 24-category weakness classification
// ============================================================

const FORTY_BB_BVB_ACTIONS = new Set(['raise_call', 'raise_fold', 'raise4bet', 'limp_call', 'limp_raise', 'limp_fold']);
const PREMIUM_HANDS = new Set(['AA', 'KK', 'QQ']);
const EP_HEROES = new Set(['UTG', 'UTG+1']);
const MP_HEROES = new Set(['UTG+2', 'LJ', 'HJ', 'UTG1/2', 'LJ/HJ']);
const LP_HEROES = new Set(['CO', 'BTN']);
const VILLAIN_EP = new Set(['UTG', 'UTG+1', 'UTG1/2']);
const VILLAIN_LP = new Set(['CO', 'BTN']);

export function classifyWeakness(q: QuizQuestion, userAnswer: string): WeaknessId {
  const { stackSize: stack, heroPosition: hero, villainPosition: vil, correctAction: correct, hand, chartName } = q;
  if (userAnswer === correct) return 'other';

  const isRFI = !vil;

  // [C] 블러프/공격 (특수 액션 우선)
  if (correct === 'threebet_bluff' && userAnswer === 'fold') return 'C13_블러프3bet_부재';
  if (correct === 'raise_bluff' && userAnswer === 'fold') return 'C14_블러프RFI_부재';
  if (correct === 'threebet_value' && userAnswer !== 'threebet_value') return 'C15_밸류3bet_누락';
  if (PREMIUM_HANDS.has(hand) && correct === 'call' && userAnswer.startsWith('threebet')) return 'C17_트랩_실패';
  if (correct.startsWith('fourbet') && userAnswer !== correct) return 'C18_4bet_오판';

  // [D] 스택 특수 (구체적인 것 먼저 → 광범위 BvB는 마지막)
  if (stack === '40BB' && FORTY_BB_BVB_ACTIONS.has(correct) && userAnswer !== correct) return 'D21_40BB_3bet후대응';
  if (stack === '100BB' && hero === 'SB' && correct === 'limp' && userAnswer !== 'limp') return 'D23_SB_림프';
  if (correct === 'allIn' && userAnswer !== 'allIn') {
    if (stack === '15BB') return 'D19_15BB_올인기준';
    if (stack === '25BB') return 'D20_25BB_올인';
  }
  if (stack === '100BB' && correct === 'call' && userAnswer !== 'call' && isRFI) return 'D22_100BB_플랫';
  // 광범위 BvB 캐치올 — 더 구체적인 D21/D23 뒤, 일반 B/A 분기보다 우선
  // (BvB 차트의 어떤 잔여 오답도 D24로 분류해 BvB-혼동 시그널을 명확히 함)
  if (['SB RFI BvB', 'BB vs SB'].some(n => chartName.includes(n))) return 'D24_BvB_혼동';

  // [B] Facing RFI
  if (vil) {
    if (userAnswer === 'fold' && correct === 'call') {
      if (hero === 'BB' && stack === '15BB') return 'B7_BB디펜스_15BB';
      if (hero === 'BB') return 'B8_BB디펜스_25_40BB';
      if (hero === 'SB') return 'B9_SB_혼동';
      if (LP_HEROES.has(hero)) return 'B10_IP플랫_부재';
    }
    if (userAnswer.startsWith('threebet') && correct === 'call') {
      if (VILLAIN_EP.has(vil)) return 'B11_vsEP_오버3bet';
      if (VILLAIN_LP.has(vil)) return 'B12_vsLP_오버3bet';
    }
    if (hero === 'SB') return 'B9_SB_혼동';
  }

  // [A] RFI
  if (isRFI) {
    if (userAnswer === 'fold' && correct === 'raise') {
      if (EP_HEROES.has(hero)) return 'A1_EP_타이트';
      if (MP_HEROES.has(hero)) return 'A2_MP_타이트';
      if (LP_HEROES.has(hero)) return 'A3_LP_타이트';
      if (hero === 'SB') return 'A4_SB_보수적';
    }
    if (userAnswer !== 'fold' && correct === 'fold') return 'A5_오픈_루즈';
  }

  return 'other';
}

export function isWeaknessSpot(q: QuizQuestion, weaknessId: WeaknessId): boolean {
  const { stackSize: stack, heroPosition: hero, villainPosition: vil, correctAction: correct, hand, chartName } = q;
  const isRFI = !vil;

  switch (weaknessId) {
    case 'A1_EP_타이트': return isRFI && EP_HEROES.has(hero) && correct === 'raise';
    case 'A2_MP_타이트': return isRFI && MP_HEROES.has(hero) && correct === 'raise';
    case 'A3_LP_타이트': return isRFI && LP_HEROES.has(hero) && correct === 'raise';
    case 'A4_SB_보수적': return isRFI && hero === 'SB' && correct === 'raise';
    case 'A5_오픈_루즈': return isRFI && correct === 'fold';
    case 'A6_스택조정_실패': return false; // 별도 집계
    case 'B7_BB디펜스_15BB': return !!vil && hero === 'BB' && stack === '15BB' && correct === 'call';
    case 'B8_BB디펜스_25_40BB': return !!vil && hero === 'BB' && (stack === '25BB' || stack === '40BB') && correct === 'call';
    case 'B9_SB_혼동': return !!vil && hero === 'SB';
    case 'B10_IP플랫_부재': return !!vil && LP_HEROES.has(hero) && correct === 'call';
    case 'B11_vsEP_오버3bet': return !!vil && VILLAIN_EP.has(vil) && correct === 'call';
    case 'B12_vsLP_오버3bet': return !!vil && VILLAIN_LP.has(vil) && correct === 'call';
    case 'C13_블러프3bet_부재': return correct === 'threebet_bluff';
    case 'C14_블러프RFI_부재': return correct === 'raise_bluff';
    case 'C15_밸류3bet_누락': return correct === 'threebet_value';
    case 'C16_스퀴즈_부재': return false;
    case 'C17_트랩_실패': return PREMIUM_HANDS.has(hand) && correct === 'call';
    case 'C18_4bet_오판': return correct.startsWith('fourbet');
    case 'D19_15BB_올인기준': return stack === '15BB' && correct === 'allIn';
    case 'D20_25BB_올인': return stack === '25BB' && correct === 'allIn';
    case 'D21_40BB_3bet후대응': return stack === '40BB' && FORTY_BB_BVB_ACTIONS.has(correct);
    case 'D22_100BB_플랫': return stack === '100BB' && isRFI && correct === 'call';
    case 'D23_SB_림프': return stack === '100BB' && hero === 'SB' && correct === 'limp';
    case 'D24_BvB_혼동': return ['SB RFI BvB', 'BB vs SB'].some(n => chartName.includes(n));
    case 'other': return false;
  }
}

export function detectStackInconsistency(records: QuizRecord[]): QuizRecord[] {
  const groups = new Map<string, QuizRecord[]>();
  for (const r of records) {
    if (!r.question.heroPosition) continue;
    const key = `${r.question.heroPosition}|${r.question.hand}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const flagged: QuizRecord[] = [];
  for (const list of groups.values()) {
    const stacks = new Set(list.map(r => r.question.stackSize));
    if (stacks.size < 2) continue;
    const correctCount = list.filter(r => r.correct).length;
    if (correctCount > 0 && correctCount < list.length) {
      flagged.push(...list);
    }
  }
  return flagged;
}

const CAT_ORDER: Record<WeaknessCategory, number> = { B: 0, A: 1, C: 2, D: 3 };

export function analyzeWeaknesses(records: QuizRecord[]): WeaknessAnalysis {
  const ids = Object.keys(WEAKNESS_MAP) as Exclude<WeaknessId, 'other'>[];
  const errorBucket = new Map<WeaknessId, QuizRecord[]>();
  const spotCounts = new Map<WeaknessId, number>();

  for (const r of records) {
    if (!r.correct) {
      const id = classifyWeakness(r.question, r.userAnswer);
      const list = errorBucket.get(id) ?? [];
      list.push(r);
      errorBucket.set(id, list);
    }
    for (const id of ids) {
      if (isWeaknessSpot(r.question, id)) {
        spotCounts.set(id, (spotCounts.get(id) ?? 0) + 1);
      }
    }
  }

  // A6 stack inconsistency: separate aggregate
  const stackInconsistencies = detectStackInconsistency(records);
  if (stackInconsistencies.length > 0) {
    errorBucket.set('A6_스택조정_실패', stackInconsistencies);
    spotCounts.set('A6_스택조정_실패', stackInconsistencies.length);
  }

  const byWeakness: Partial<Record<WeaknessId, WeaknessBucket>> = {};
  for (const id of ids) {
    const errors = errorBucket.get(id) ?? [];
    const spotCount = spotCounts.get(id) ?? 0;
    const severity = spotCount === 0 ? 0 : errors.length / spotCount;
    byWeakness[id] = { errorCount: errors.length, spotCount, severity, errors };
  }

  const top3: WeaknessSummary[] = ids
    .filter(id => (byWeakness[id]?.errorCount ?? 0) >= 2)
    .sort((a, b) => {
      const ea = byWeakness[a]!.errorCount;
      const eb = byWeakness[b]!.errorCount;
      if (ea !== eb) return eb - ea;
      return CAT_ORDER[WEAKNESS_MAP[a].category] - CAT_ORDER[WEAKNESS_MAP[b].category];
    })
    .slice(0, 3)
    .map((id, idx) => ({
      rank: idx + 1,
      weaknessId: id,
      errorCount: byWeakness[id]!.errorCount,
      spotCount: byWeakness[id]!.spotCount,
      severity: byWeakness[id]!.severity,
      meta: WEAKNESS_MAP[id],
    }));

  return { byWeakness, top3, stackInconsistencies };
}
