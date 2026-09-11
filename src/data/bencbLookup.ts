import type { BencbChart } from './bencb';

export const LOOKUP_FIELDS = ['strategy', 'hero', 'opponent', 'stack', 'condition'] as const;
export type LookupField = typeof LOOKUP_FIELDS[number];
export type BencbFilters = Partial<Record<LookupField, string>>;
export interface BencbDescription {
  strategy: string;
  hero: string;
  opponent: string;
  stack: string;
  condition: string;
  stackDetail?: string;
  note?: string;
}
export interface BencbEntry extends BencbDescription { chart: BencbChart }
const positions = ['UTG', 'UTG1', 'UTG2', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const strategies = ['오픈 레이즈', '콜 / 3벳', '리잼', '리잼 콜', 'BB 디펜스', 'BB vs SB 림프', '스퀴즈', '헤즈업'];
const position = (value: string) => value === 'BU' ? 'BTN' : value;
function stackLabel(value: string): string {
  const match = value.match(/(\d+)(?:-(\d+))?bb(\+)?/i);
  return match ? `${match[1]}${match[2] ? `–${match[2]}` : ''} BB${match[3] ?? ''}` : '스택 미표기';
}
function multiStack(chart: BencbChart): string {
  const values = chart.legend.flatMap(entry => {
    const match = entry.label?.match(/^(\d+)b{1,2}$/i);
    return match ? [Number(match[1])] : [];
  });
  return [...new Set(values)].sort((a, b) => a - b).join(' / ') + (values.length ? ' BB' : '원문 범례 참조');
}

/** Source-derived lookup only. Original chart data, actions and weights are unchanged. */
export function describeBencbChart(chart: BencbChart): BencbDescription {
  const { category, subcategory, scenario } = chart;
  const meta: BencbDescription = { strategy: category, hero: '원본 참조', opponent: '포지션 미지정', stack: stackLabel(subcategory), condition: '기본' };
  if (category === 'Openraising') {
    meta.strategy = '오픈 레이즈';
    meta.hero = subcategory.includes('SB') ? 'SB' : scenario.match(/^(UTG[12]?|MP|HJ|CO|BTN|SB)/)?.[1] ?? '원본 참조';
    meta.opponent = meta.hero === 'SB' ? 'BB' : '오픈 없음';
    if (scenario === 'SB-mixed') meta.condition = '혼합';
    else if (scenario.includes('AGGR')) { meta.opponent = 'BB / SB'; meta.condition = '공격적인 블라인드'; }
    else if (subcategory.includes('SB')) {
      const style = scenario.startsWith('mixed') ? '혼합' : '레이즈만';
      const opponent = scenario.includes('passive') ? '패시브 상대' : scenario.includes('tight') ? '타이트 상대' : '잘하는 상대';
      meta.condition = `${style} / ${opponent}`;
    }
  } else if (category === 'Flatting _ 3Betting') {
    meta.strategy = '콜 / 3벳';
    const [hero, villain] = scenario.split(' vs ');
    meta.hero = position(hero); meta.opponent = `${position(villain ?? '미지정')} 오픈`;
  } else if (category === 'Rejamming' || category === 'Calling rejams') {
    meta.strategy = category === 'Rejamming' ? '리잼' : '리잼 콜';
    meta.hero = subcategory;
    meta.opponent = `${scenario.replace(/^vs /, '').split(' ').map(position).join(' / ')} ${category === 'Rejamming' ? '오픈' : '리잼'}`;
    meta.stack = '여러 스택 통합'; meta.stackDetail = multiStack(chart);
    meta.note = '스택별 범례를 한 장에 담은 차트입니다. 단일 스택 레인지로 분리하거나 합산하지 않습니다.';
  } else if (category === 'BB Strategy') {
    meta.hero = 'BB';
    if (subcategory === 'Defending') {
      meta.strategy = 'BB 디펜스'; meta.stack = '스택 미표기';
      meta.condition = `상대 오픈 ${scenario.match(/\d+/)?.[0] ?? '?'}%`;
    } else {
      meta.strategy = 'BB vs SB 림프'; meta.opponent = 'SB';
      meta.stack = stackLabel(scenario); meta.condition = '림프 대응';
    }
  } else if (category === 'HU') {
    meta.strategy = '헤즈업';
    meta.hero = subcategory.includes('FROM SB') ? 'SB' : 'BB';
    meta.opponent = meta.hero === 'SB' ? 'BB' : 'SB';
    meta.stack = stackLabel(scenario);
    if (scenario.includes('FISH')) meta.condition = '피시 상대';
    else if (scenario.includes('vs LIMP')) meta.condition = '림프 대응';
    else if (scenario.includes('vs RAISE')) meta.condition = '레이즈 대응';
    else if (scenario.includes('LIMP SHOVE')) meta.condition = '림프 / 셔브';
    else if (scenario.includes('RAISE LIMP')) meta.condition = '레이즈 / 림프';
    // Filename typo: the selected tab in this PNG says LIMPING/SHOVING 10-15BB.
    if (subcategory === '25BB- FROM SB' && scenario === 'LIMP SHOVE 10-25BB') {
      meta.stack = '10–15 BB';
      meta.note = '파일명은 10-25BB이지만 원본 이미지의 선택된 탭은 10–15BB로 표시되어 있습니다.';
    }
  } else if (category === 'Squeezing') {
    meta.strategy = '스퀴즈';
    const [hero, opponents] = scenario.split('vs');
    meta.hero = position(hero);
    const groups: Record<string, string> = { EPMP: 'EP / MP', MPLP: 'MP / LP', COBUSB: 'CO / BTN / SB', JHCO: 'HJ / CO', HJCOBU: 'HJ / CO / BTN', MPMP: 'MP / MP', EPEPorEPMP: 'EP / EP 또는 EP / MP' };
    meta.opponent = groups[opponents] ?? opponents ?? '원본 참조';
    meta.condition = '오픈 + 콜';
    if (scenario === '90BBCOvsUTGopen+Fishcall') {
      meta.hero = 'CO'; meta.stack = '90 BB'; meta.opponent = 'UTG 오픈 + HJ 콜'; meta.condition = '콜러 피시';
      meta.note = '원본 이미지의 “90BB CO VS UTG OPEN + FISH CALL HJ” 탭 기준입니다.';
    } else if (scenario === 'SBvs20BBCOopen+BUflat') {
      meta.hero = 'SB'; meta.stack = 'CO 20 BB'; meta.opponent = 'CO 오픈 + BTN 콜';
      meta.note = '20BB는 원본의 CO 오픈 조건입니다. 모든 참가자의 스택이 같다고 가정하지 않습니다.';
    }
  }
  return meta;
}
function normalize(value: string): string {
  return value.toLowerCase().replace(/utg\s*\+\s*([12])/g, 'utg$1').replace(/\bbu\b/g, 'btn').replace(/(\d)\s*bb/g, '$1bb').replace(/\s*[–-]\s*/g, '-');
}
export function filterBencbCharts(entries: BencbEntry[], filters: BencbFilters, query = ''): BencbEntry[] {
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry => {
    if (LOOKUP_FIELDS.some(field => filters[field] && entry[field] !== filters[field])) return false;
    const stackTokens = entry.stackDetail?.match(/\d+/g)?.map(value => `${value}bb`).join(' ') ?? '';
    const search = normalize([...LOOKUP_FIELDS.map(field => entry[field]), entry.stackDetail ?? '', stackTokens, entry.chart.source].join(' '));
    return tokens.every(token => search.includes(token));
  });
}
export function getBencbOptions(entries: BencbEntry[], filters: BencbFilters, field: LookupField): string[] {
  const remaining = { ...filters, [field]: '' };
  return [...new Set(filterBencbCharts(entries, remaining).map(entry => entry[field]))].sort((a, b) => {
    if (field === 'hero') return positions.indexOf(a) - positions.indexOf(b);
    if (field === 'strategy') return strategies.indexOf(a) - strategies.indexOf(b);
    return a.localeCompare(b, 'ko', { numeric: true });
  });
}
export function bencbEntryTitle(entry: BencbEntry): string {
  return [entry.strategy, entry.hero, entry.opponent, entry.stack, entry.condition === '기본' ? '' : entry.condition].filter(Boolean).join(' · ');
}
