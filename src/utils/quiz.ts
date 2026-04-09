import type { AllData, StackSize, QuizQuestion, QuizRecord } from '../types';
import { ACTION_COLORS } from '../constants';
import { buildHandAction, forEachHand } from './hand';

const STORAGE_KEY = 'holdem_quiz_records';

interface ChartScenario {
  chartName: string;
  heroPosition: string;
  villainPosition: string;
  situation: string;
}

function parseChartScenario(chartName: string): ChartScenario | null {
  // 내 오픈 후 대응 — 제외
  if (chartName.match(/RFI vs .+ Allin$/)) return null;
  if (chartName.match(/ vs .+ 3bet$/)) return null;
  if (chartName.match(/^SB Limp vs BB /)) return null;
  if (chartName.match(/^BB vs SB /)) return null;

  // RFI 오픈 레인지: "CO RFI"
  const rfiMatch = chartName.match(/^(.+) RFI$/);
  if (rfiMatch && !chartName.includes('vs') && !chartName.includes('BvB')) {
    const pos = rfiMatch[1];
    return {
      chartName,
      heroPosition: pos,
      villainPosition: '',
      situation: `${pos} 오픈 레인지`,
    };
  }

  // SB 오픈 레인지 (BvB): "SB RFI BvB"
  if (chartName === 'SB RFI BvB') {
    return {
      chartName,
      heroPosition: 'SB',
      villainPosition: 'BB',
      situation: 'SB vs BB 오픈 레인지',
    };
  }

  // Facing RFI: "CO vs UTG RFI"
  const facingRfiMatch = chartName.match(/^(.+) vs (.+) RFI$/);
  if (facingRfiMatch) {
    return {
      chartName,
      heroPosition: facingRfiMatch[1],
      villainPosition: facingRfiMatch[2],
      situation: `${facingRfiMatch[2]} 오픈, ${facingRfiMatch[1]}에서 대응`,
    };
  }

  // Generic "X vs Y" (100BB facing)
  const facingMatch = chartName.match(/^(.+) vs (.+)$/);
  if (facingMatch) {
    return {
      chartName,
      heroPosition: facingMatch[1],
      villainPosition: facingMatch[2],
      situation: `${facingMatch[2]} 오픈, ${facingMatch[1]}에서 대응`,
    };
  }

  return null;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ALL_HANDS: string[] = [];
forEachHand(hand => ALL_HANDS.push(hand));

const scenarioCache = new Map<string, ChartScenario[]>();

function getScenariosForStack(stackData: Record<string, Record<string, string[]>>, stack: string): ChartScenario[] {
  let cached = scenarioCache.get(stack);
  if (!cached) {
    cached = [];
    for (const name of Object.keys(stackData)) {
      const s = parseChartScenario(name);
      if (s) cached.push(s);
    }
    scenarioCache.set(stack, cached);
  }
  return cached;
}

export interface QuizResult {
  question: QuizQuestion;
  choices: string[];
}

export function generateQuizQuestion(
  data: AllData,
  selectedStacks: StackSize[],
): QuizResult | null {
  const stack = pickRandom(selectedStacks);
  const stackData = data[stack];
  if (!stackData) return null;

  const scenarios = getScenariosForStack(stackData, stack);
  if (scenarios.length === 0) return null;

  const scenario = pickRandom(scenarios);
  const chartData = stackData[scenario.chartName];
  if (!chartData) return null;

  const handAction = buildHandAction(chartData);
  const hand = pickRandom(ALL_HANDS);
  const correctAction = handAction[hand] ?? 'fold';

  const actions = Object.keys(chartData);
  if (!actions.includes('fold')) actions.push('fold');

  return {
    question: {
      stackSize: stack,
      chartName: scenario.chartName,
      hand,
      correctAction,
      heroPosition: scenario.heroPosition,
      villainPosition: scenario.villainPosition,
      situation: scenario.situation,
    },
    choices: actions,
  };
}

export function actionLabel(action: string): string {
  const c = ACTION_COLORS[action];
  return c ? `${c.label} ${action}` : action;
}

export function loadQuizRecords(): QuizRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QuizRecord[];
  } catch {
    return [];
  }
}

export function saveQuizRecord(record: QuizRecord): void {
  const records = loadQuizRecords();
  records.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function clearQuizRecords(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportRecords(): void {
  const records = loadQuizRecords();
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gto-quiz-records-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importRecords(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string) as QuizRecord[];
        if (!Array.isArray(imported)) {
          reject(new Error('잘못된 파일 형식입니다'));
          return;
        }
        const existing = loadQuizRecords();
        const existingTimestamps = new Set(existing.map(r => r.timestamp));
        const newRecords = imported.filter(r => !existingTimestamps.has(r.timestamp));
        const merged = [...existing, ...newRecords];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        resolve(newRecords.length);
      } catch {
        reject(new Error('JSON 파싱 실패'));
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsText(file);
  });
}
