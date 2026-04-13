import type { QuizRecord, StackSize } from '../types';
import { getHandCombos } from './hand';

export interface ActionBuckets {
  vpip: boolean;
  pfr: boolean;
  threebet: boolean;
}

export interface ActionContext {
  isFacingRFI: boolean;
  stack: StackSize;
}

const VPIP_ACTIONS = new Set([
  'raise', 'raise_bluff', 'allIn', 'call', 'limp',
  'threebet', 'threebet_value', 'threebet_bluff',
  'fourbet_value', 'fourbet_bluff',
  'raise_value', 'raise4bet', 'raise_fold', 'raise_call',
  'limp_call', 'limp_raise', 'limp_fold',
]);

const PFR_ACTIONS = new Set([
  'raise', 'raise_bluff', 'allIn',
  'threebet', 'threebet_value', 'threebet_bluff',
  'fourbet_value', 'fourbet_bluff',
  'raise_value', 'raise4bet', 'raise_fold', 'raise_call',
]);

const THREEBET_ACTIONS = new Set(['threebet', 'threebet_value', 'threebet_bluff']);

export function classifyAction(action: string, ctx?: ActionContext): ActionBuckets {
  const vpip = VPIP_ACTIONS.has(action);
  const pfr = PFR_ACTIONS.has(action);
  let threebet = THREEBET_ACTIONS.has(action);
  if (!threebet && action === 'allIn' && ctx?.isFacingRFI && ctx.stack !== '100BB') {
    threebet = true;
  }
  return { vpip, pfr, threebet };
}

export type ChartContext = 'rfi' | 'facing-rfi' | 'facing-3bet' | 'other';

export function getChartContext(chartName: string): ChartContext {
  if (/ 3bet$/.test(chartName)) return 'facing-3bet';
  if (/Allin|Limp/.test(chartName)) return 'other';
  if (chartName === 'SB RFI BvB') return 'rfi';
  if (/ RFI$/.test(chartName) && !chartName.includes(' vs ')) return 'rfi';
  if (chartName.includes(' vs ')) return 'facing-rfi';
  return 'other';
}

export interface DeviationStats {
  vpipDelta: number;
  pfrDelta: number;
  threebetDelta: number | null;
  coldCallDelta: number | null;
  stealDelta: number | null;
  foldToStealDelta: number | null;
  // Absolute percentages (user / GTO) for each axis
  userVpipPct: number;
  gtoVpipPct: number;
  userPfrPct: number;
  gtoPfrPct: number;
  userThreebetPct: number | null;
  gtoThreebetPct: number | null;
  userColdCallPct: number | null;
  gtoColdCallPct: number | null;
  userStealPct: number | null;
  gtoStealPct: number | null;
  userFoldToStealPct: number | null;
  gtoFoldToStealPct: number | null;
  sampleSize: number;
  threebetSampleSize: number;
  coldCallSampleSize: number;
  stealSampleSize: number;
  foldToStealSampleSize: number;
  totalCombos: number;
  threebetTotalCombos: number;
  userVpipCombos: number;
  gtoVpipCombos: number;
  userPfrCombos: number;
  gtoPfrCombos: number;
  userThreebetCombos: number;
  gtoThreebetCombos: number;
}

const STEAL_RFI_CHARTS = new Set(['CO RFI', 'BTN RFI', 'SB RFI', 'SB RFI BvB']);

// Charts where hero (SB/BB) faces a steal from a late-position opener (CO/BTN/SB).
// Matches 15-40BB "... vs ... RFI" and 100BB "... vs ..." naming.
const FOLD_TO_STEAL_RE = /^(SB|BB) vs (CO|BTN|SB)( RFI)?$/;

export function isFoldToStealChart(chartName: string): boolean {
  return FOLD_TO_STEAL_RE.test(chartName);
}

export function computeDeviationStats(records: QuizRecord[]): DeviationStats | null {
  if (records.length === 0) return null;

  let userVpip = 0, gtoVpip = 0;
  let userPfr = 0, gtoPfr = 0;
  let userTb = 0, gtoTb = 0;
  let total = 0;
  let tbTotal = 0;
  let tbSampleSize = 0;

  let userCC = 0, gtoCC = 0, ccTotal = 0, ccSampleSize = 0;
  let userSteal = 0, gtoSteal = 0, stealTotal = 0, stealSampleSize = 0;
  let userFts = 0, gtoFts = 0, ftsTotal = 0, ftsSampleSize = 0;

  for (const r of records) {
    const combos = getHandCombos(r.question.hand);
    const ctx = getChartContext(r.question.chartName);
    const actionCtx: ActionContext = {
      isFacingRFI: ctx === 'facing-rfi',
      stack: r.question.stackSize,
    };
    const userB = classifyAction(r.userAnswer, actionCtx);
    const gtoB = classifyAction(r.question.correctAction, actionCtx);

    total += combos;
    if (userB.vpip) userVpip += combos;
    if (gtoB.vpip) gtoVpip += combos;
    if (userB.pfr) userPfr += combos;
    if (gtoB.pfr) gtoPfr += combos;

    if (ctx === 'facing-rfi') {
      tbTotal += combos;
      tbSampleSize++;
      if (userB.threebet) userTb += combos;
      if (gtoB.threebet) gtoTb += combos;

      ccTotal += combos;
      ccSampleSize++;
      if (r.userAnswer === 'call') userCC += combos;
      if (r.question.correctAction === 'call') gtoCC += combos;
    }

    if (STEAL_RFI_CHARTS.has(r.question.chartName)) {
      stealTotal += combos;
      stealSampleSize++;
      if (userB.pfr) userSteal += combos;
      if (gtoB.pfr) gtoSteal += combos;
    }

    if (isFoldToStealChart(r.question.chartName)) {
      ftsTotal += combos;
      ftsSampleSize++;
      if (r.userAnswer === 'fold') userFts += combos;
      if (r.question.correctAction === 'fold') gtoFts += combos;
    }
  }

  const pct = (u: number, g: number, denom: number) => denom === 0 ? 0 : ((u - g) / denom) * 100;

  const abs = (num: number, denom: number) => denom === 0 ? null : (num / denom) * 100;

  return {
    vpipDelta: pct(userVpip, gtoVpip, total),
    pfrDelta: pct(userPfr, gtoPfr, total),
    threebetDelta: tbTotal === 0 ? null : pct(userTb, gtoTb, tbTotal),
    coldCallDelta: ccTotal === 0 ? null : pct(userCC, gtoCC, ccTotal),
    stealDelta: stealTotal === 0 ? null : pct(userSteal, gtoSteal, stealTotal),
    foldToStealDelta: ftsTotal === 0 ? null : pct(userFts, gtoFts, ftsTotal),
    userVpipPct: abs(userVpip, total) ?? 0,
    gtoVpipPct: abs(gtoVpip, total) ?? 0,
    userPfrPct: abs(userPfr, total) ?? 0,
    gtoPfrPct: abs(gtoPfr, total) ?? 0,
    userThreebetPct: abs(userTb, tbTotal),
    gtoThreebetPct: abs(gtoTb, tbTotal),
    userColdCallPct: abs(userCC, ccTotal),
    gtoColdCallPct: abs(gtoCC, ccTotal),
    userStealPct: abs(userSteal, stealTotal),
    gtoStealPct: abs(gtoSteal, stealTotal),
    userFoldToStealPct: abs(userFts, ftsTotal),
    gtoFoldToStealPct: abs(gtoFts, ftsTotal),
    sampleSize: records.length,
    threebetSampleSize: tbSampleSize,
    coldCallSampleSize: ccSampleSize,
    stealSampleSize,
    foldToStealSampleSize: ftsSampleSize,
    totalCombos: total,
    threebetTotalCombos: tbTotal,
    userVpipCombos: userVpip,
    gtoVpipCombos: gtoVpip,
    userPfrCombos: userPfr,
    gtoPfrCombos: gtoPfr,
    userThreebetCombos: userTb,
    gtoThreebetCombos: gtoTb,
  };
}
