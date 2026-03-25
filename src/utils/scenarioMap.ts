import { POSITIONS } from '../constants';
import type { StackData } from '../types';

export interface Scenario {
  chartName: string;
  label: string;
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
}

function parseChartName(name: string): ParsedChart | null {
  const rfiMatch = name.match(/^(.+) RFI$/);
  if (rfiMatch && !name.includes('vs') && !name.includes('BvB')) {
    return { heroes: expandPositions(rfiMatch[1]), villains: [], label: '오픈 (RFI)' };
  }

  if (name === 'SB RFI BvB') {
    return { heroes: ['SB'], villains: ['BB'], label: 'SB 오픈 BvB' };
  }

  const allinMatch = name.match(/^(.+) RFI vs (.+) Allin$/);
  if (allinMatch) {
    return {
      heroes: expandPositions(allinMatch[1]),
      villains: expandPositions(allinMatch[2]),
      label: '오픈 후 올인 대응',
    };
  }

  const threebetMatch = name.match(/^(.+) vs (.+) 3bet$/);
  if (threebetMatch) {
    const openerRaw = threebetMatch[1].replace(' RFI', '');
    return {
      heroes: expandPositions(openerRaw),
      villains: expandPositions(threebetMatch[2]),
      label: '오픈 후 3bet 대응',
    };
  }

  const sbLimpMatch = name.match(/^SB Limp vs BB (.+)$/);
  if (sbLimpMatch) {
    return { heroes: ['SB'], villains: ['BB'], label: `SB 림프 후 BB ${sbLimpMatch[1]} 대응` };
  }

  const bbVsSbMatch = name.match(/^BB vs SB (.+)$/);
  if (bbVsSbMatch) {
    return { heroes: ['BB'], villains: ['SB'], label: `SB ${bbVsSbMatch[1]} 대응` };
  }

  const facingRfiMatch = name.match(/^(.+) vs (.+) RFI$/);
  if (facingRfiMatch) {
    return {
      heroes: expandPositions(facingRfiMatch[1]),
      villains: expandPositions(facingRfiMatch[2]),
      label: '상대 오픈 대응',
    };
  }

  const facingMatch = name.match(/^(.+) vs (.+)$/);
  if (facingMatch) {
    return {
      heroes: expandPositions(facingMatch[1]),
      villains: expandPositions(facingMatch[2]),
      label: '상대 오픈 대응',
    };
  }

  return null;
}

export interface PositionScenarios {
  map: Map<string, Map<string, Scenario[]>>;
  heroPositions: string[];
}

export function buildScenarioMap(stackData: StackData): PositionScenarios {
  const map = new Map<string, Map<string, Scenario[]>>();

  for (const chartName of Object.keys(stackData)) {
    const parsed = parseChartName(chartName);
    if (!parsed) continue;

    for (const hero of parsed.heroes) {
      if (!map.has(hero)) map.set(hero, new Map());
      const villainMap = map.get(hero)!;

      if (parsed.villains.length === 0) {
        const key = '-';
        if (!villainMap.has(key)) villainMap.set(key, []);
        villainMap.get(key)!.push({ chartName, label: parsed.label });
      } else {
        for (const villain of parsed.villains) {
          if (!villainMap.has(villain)) villainMap.set(villain, []);
          villainMap.get(villain)!.push({ chartName, label: parsed.label });
        }
      }
    }
  }

  const heroPositions = (ALL_POS_ORDER as readonly string[]).filter(p => map.has(p));
  return { map, heroPositions };
}

export function getVillainOptions(scenarioMap: PositionScenarios, hero: string): string[] {
  const villainMap = scenarioMap.map.get(hero);
  if (!villainMap) return [];
  return (ALL_POS_ORDER as readonly string[]).filter(p => p !== '-' && villainMap.has(p));
}

export function getScenarios(scenarioMap: PositionScenarios, hero: string, villain: string): Scenario[] {
  return scenarioMap.map.get(hero)?.get(villain) || [];
}

export function getRfiScenarios(scenarioMap: PositionScenarios, hero: string): Scenario[] {
  return scenarioMap.map.get(hero)?.get('-') || [];
}
