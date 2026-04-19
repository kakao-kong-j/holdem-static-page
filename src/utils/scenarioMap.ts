import { POSITIONS } from '../constants';
import type { StackData } from '../types';

export type ScenarioCategory = '상대 오픈 대응' | '내 오픈 후 대응';

export interface Scenario {
  chartName: string;
  label: string;
  category: ScenarioCategory;
}

const ALL_POS_ORDER = [...POSITIONS, 'BB'] as const;

function normalizePos(s: string): string {
  return s.replace('UTG1', 'UTG+1').replace('UTG2', 'UTG+2');
}

function expandPositions(raw: string): string[] {
  if (raw.includes('-')) {
    const [from, to] = raw.split('-').map(normalizePos);
    const fi = ALL_POS_ORDER.indexOf(from as typeof ALL_POS_ORDER[number]);
    const ti = ALL_POS_ORDER.indexOf(to as typeof ALL_POS_ORDER[number]);
    if (fi >= 0 && ti >= 0) return ALL_POS_ORDER.slice(fi, ti + 1) as unknown as string[];
  }
  if (raw.includes('/')) {
    const parts = raw.split('/');
    if (parts[0].startsWith('UTG') && /^\d$/.test(parts[1])) {
      return parts.map(p => (/^\d$/.test(p) ? `UTG+${p}` : normalizePos(p)));
    }
    return parts.map(normalizePos);
  }
  return [normalizePos(raw)];
}

interface ParsedChart {
  heroes: string[];
  villains: string[];
  label: string;
  category: ScenarioCategory;
}

function parseChartName(name: string): ParsedChart | null {
  // Solo RFI — skip (Open Range 뷰에서 처리)
  const rfiMatch = name.match(/^(.+) RFI$/);
  if (rfiMatch && !name.includes('vs') && !name.includes('BvB')) {
    return null;
  }

  // BvB — 데이터 검증 필요, 현재 제외
  if (name === 'SB RFI BvB') return null;

  // RFI vs Allin: 내가 오픈 후 상대 올인
  const allinMatch = name.match(/^(.+) RFI vs (.+) Allin$/);
  if (allinMatch) {
    return {
      heroes: expandPositions(allinMatch[1]),
      villains: expandPositions(allinMatch[2]),
      label: '올인 대응',
      category: '내 오픈 후 대응',
    };
  }

  // RFI vs Allin (no explicit villain): 내가 오픈 후 누구든 올인
  // 데이터 상 "X RFI vs Allin" 형태로 존재 (예: LJ RFI vs Allin, CO RFI vs Allin)
  const genericAllinMatch = name.match(/^(.+) RFI vs Allin$/);
  if (genericAllinMatch) {
    const heroes = expandPositions(genericAllinMatch[1]);
    const heroIdx = heroes[0] ? ALL_POS_ORDER.indexOf(heroes[0] as typeof ALL_POS_ORDER[number]) : -1;
    const villains = heroIdx >= 0 ? ALL_POS_ORDER.slice(heroIdx + 1) : [];
    return {
      heroes,
      villains: [...villains],
      label: '올인 대응',
      category: '내 오픈 후 대응',
    };
  }

  if (name === 'SB RFI vs BB 3bet') return null;

  // RFI vs 3bet: 내가 오픈 후 상대 3bet (100BB)
  const threebetMatch = name.match(/^(.+) vs (.+) 3bet$/);
  if (threebetMatch) {
    const openerRaw = threebetMatch[1].replace(' RFI', '');
    return {
      heroes: expandPositions(openerRaw),
      villains: expandPositions(threebetMatch[2]),
      label: '3bet 대응',
      category: '내 오픈 후 대응',
    };
  }

  const sbLimpMatch = name.match(/^SB Limp vs BB (.+)$/);
  if (sbLimpMatch) return null;

  const bbVsSbMatch = name.match(/^BB vs SB (.+)$/);
  if (bbVsSbMatch) return null;

  // Facing RFI (15/25/40BB): 상대가 오픈, 내가 대응
  const facingRfiMatch = name.match(/^(.+) vs (.+) RFI$/);
  if (facingRfiMatch) {
    return {
      heroes: expandPositions(facingRfiMatch[1]),
      villains: expandPositions(facingRfiMatch[2]),
      label: '오픈 대응',
      category: '상대 오픈 대응',
    };
  }

  // Facing RFI (100BB): 상대가 오픈, 내가 대응
  const facingMatch = name.match(/^(.+) vs (.+)$/);
  if (facingMatch) {
    return {
      heroes: expandPositions(facingMatch[1]),
      villains: expandPositions(facingMatch[2]),
      label: '오픈 대응',
      category: '상대 오픈 대응',
    };
  }

  return null;
}

export interface PositionScenarios {
  map: Map<string, Map<string, Scenario[]>>;
  categories: ScenarioCategory[];
}

export function buildScenarioMap(stackData: StackData): PositionScenarios {
  const map = new Map<string, Map<string, Scenario[]>>();
  const categorySet = new Set<ScenarioCategory>();

  for (const chartName of Object.keys(stackData)) {
    const parsed = parseChartName(chartName);
    if (!parsed) continue;

    categorySet.add(parsed.category);

    for (const hero of parsed.heroes) {
      if (!map.has(hero)) map.set(hero, new Map());
      const villainMap = map.get(hero)!;

      for (const villain of parsed.villains) {
        if (!villainMap.has(villain)) villainMap.set(villain, []);
        villainMap.get(villain)!.push({ chartName, label: parsed.label, category: parsed.category });
      }
    }
  }

  const CATEGORY_ORDER: ScenarioCategory[] = ['상대 오픈 대응', '내 오픈 후 대응'];
  const categories = CATEGORY_ORDER.filter(c => categorySet.has(c));

  return { map, categories };
}

export function getHeroPositions(
  scenarioMap: PositionScenarios,
  category: ScenarioCategory,
): string[] {
  return (ALL_POS_ORDER as readonly string[]).filter(p => {
    const villainMap = scenarioMap.map.get(p);
    if (!villainMap) return false;
    for (const scenarios of villainMap.values()) {
      if (scenarios.some(s => s.category === category)) return true;
    }
    return false;
  });
}

export function getVillainOptions(
  scenarioMap: PositionScenarios,
  hero: string,
  category: ScenarioCategory,
): string[] {
  const villainMap = scenarioMap.map.get(hero);
  if (!villainMap) return [];
  return (ALL_POS_ORDER as readonly string[]).filter(p => {
    const scenarios = villainMap.get(p);
    return scenarios?.some(s => s.category === category) ?? false;
  });
}

export function getScenarios(
  scenarioMap: PositionScenarios,
  hero: string,
  villain: string,
  category: ScenarioCategory,
): Scenario[] {
  const all = scenarioMap.map.get(hero)?.get(villain) || [];
  return all.filter(s => s.category === category);
}
