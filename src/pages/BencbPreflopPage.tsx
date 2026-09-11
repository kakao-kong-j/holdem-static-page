import { useEffect, useMemo, useState } from 'react';
import { RANKS } from '../constants';
import { getHandName } from '../utils/hand';
import { describeBencbChart, filterBencbCharts, getBencbOptions, bencbEntryTitle, LOOKUP_FIELDS, type BencbFilters, type BencbEntry } from '../data/bencbLookup';
import { BENCB_DATA_URL, handBackground, legendLabel, percent, type BencbChart, type BencbData } from '../data/bencb';

const controlClass = 'w-full min-w-0 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white';
const filterLabels = { strategy: '전략', hero: '내 포지션', opponent: '상대 / 구도', stack: '스택', condition: '추가 조건' };


export function BencbPreflopPage() {
  const [data, setData] = useState<BencbData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(BENCB_DATA_URL, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((value: BencbData) => {
        if (value.schema_version !== 1 || !Array.isArray(value.charts) || !value.charts.length
          || !Array.isArray(value.incomplete_sources)
          || value.charts.some(chart => !chart.hands || Object.keys(chart.hands).length !== 169 || !Array.isArray(chart.legend))) {
          throw new Error('지원하지 않는 차트 데이터 형식입니다.');
        }
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '알 수 없는 오류');
      });
    return () => controller.abort();
  }, [attempt]);

  if (error) return (
    <div role="alert" className="space-y-3 py-12 text-center text-red-300">
      <p>차트를 불러오지 못했습니다. {error}</p>
      <button className="rounded-lg bg-gray-800 px-4 py-2 text-white" onClick={() => { setError(null); setAttempt(value => value + 1); }}>다시 시도</button>
    </div>
  );
  if (!data) return <p role="status" className="py-12 text-center text-gray-400">Bencb 차트 로딩 중...</p>;
  return <ChartBrowser data={data} />;
}

function ChartBrowser({ data }: { data: BencbData }) {
  const [filters, setFilters] = useState<BencbFilters>({});
  const [query, setQuery] = useState('');
  const [chartId, setChartId] = useState('');
  const [hideGrid, setHideGrid] = useState(false);
  const entries = useMemo(() => {
    const indexed = data.charts.map(chart => ({ chart, ...describeBencbChart(chart) }));
    const order = getBencbOptions(indexed, {}, 'strategy');
    return indexed.sort((a, b) => order.indexOf(a.strategy) - order.indexOf(b.strategy)
      || bencbEntryTitle(a).localeCompare(bencbEntryTitle(b), 'ko', { numeric: true }));
  }, [data]);
  const matches = filterBencbCharts(entries, filters, query);
  const selected = matches.find(entry => entry.chart.id === chartId) ?? matches[0];
  const selectedIndex = selected ? matches.indexOf(selected) : -1;
  const reset = () => { setFilters({}); setQuery(''); setChartId(''); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">Bencb tournament Masterclass</p>
          <h2 className="mt-1 text-xl font-bold text-white">프리플랍 차트</h2>
          <p className="mt-1 text-sm text-gray-400">{data.charts.length}개 차트 · 상황을 선택하고 핸드를 눌러 확인하세요.</p>
        </div>
        <a className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800" href={BENCB_DATA_URL} download="bencb-preflop-charts.json">전체 JSON 다운로드</a>
      </div>
      <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <label className="block space-y-1 text-xs text-gray-400">차트 검색 · 선택한 필터 안에서 검색
          <input aria-label="차트 검색" type="search" className={controlClass} value={query}
            onChange={event => setQuery(event.target.value)} placeholder="예: BTN CO 50bb, 헤즈업 림프, 오픈 12%" />
        </label>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {LOOKUP_FIELDS.map(field => <label key={field} className={`space-y-1 text-xs text-gray-400 ${field === 'condition' ? 'col-span-2 lg:col-span-1' : ''}`}>{filterLabels[field]}
            <select aria-label={filterLabels[field]} className={controlClass} value={filters[field] ?? ''}
              onChange={event => setFilters(previous => ({ ...previous, [field]: event.target.value }))}>
              <option value="">전체</option>
              {getBencbOptions(entries, filters, field).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <p role="status" className="text-gray-400">{matches.length} / {entries.length}개 차트</p>
          <label className="flex cursor-pointer items-center gap-2 text-gray-300">
            <input type="checkbox" checked={hideGrid} onChange={event => setHideGrid(event.target.checked)} className="h-4 w-4 accent-indigo-500" />
            13×13 차트 숨기기
          </label>
          <button type="button" onClick={reset} className="rounded border border-gray-700 px-3 py-1.5 text-gray-300 hover:bg-gray-800">필터 초기화</button>
        </div>
        {filters.stack === '여러 스택 통합' && <p className="text-xs text-amber-200">스택별 조건이 원문 범례에 함께 표시된 차트입니다. 선택한 스택의 단독 레인지가 아닙니다.</p>}
      </div>
      {selected ? <>
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 space-y-1 text-xs text-gray-400">조회 결과 · {selectedIndex + 1} / {matches.length}
            <select aria-label="차트" className={controlClass} value={selected.chart.id} onChange={event => setChartId(event.target.value)}>
              {matches.map(entry => <option key={entry.chart.id} value={entry.chart.id}>{bencbEntryTitle(entry)}</option>)}
            </select>
          </label>
          <button type="button" aria-label="이전 차트" disabled={selectedIndex <= 0} onClick={() => setChartId(matches[selectedIndex - 1].chart.id)} className="rounded-lg border border-gray-700 px-3 py-2.5 text-sm text-gray-300 disabled:opacity-30">이전</button>
          <button type="button" aria-label="다음 차트" disabled={selectedIndex >= matches.length - 1} onClick={() => setChartId(matches[selectedIndex + 1].chart.id)} className="rounded-lg border border-gray-700 px-3 py-2.5 text-sm text-gray-300 disabled:opacity-30">다음</button>
        </div>
        <ChartDetail key={selected.chart.id} chart={selected.chart} entry={selected} hideGrid={hideGrid} />
      </> : <p className="rounded-xl border border-gray-800 p-8 text-center text-sm text-gray-400">조건에 맞는 차트가 없습니다. 검색어를 바꾸거나 필터를 초기화하세요.</p>}
      <details className="rounded-xl border border-gray-800 p-4 text-sm text-gray-400">
        <summary className="cursor-pointer text-gray-300">데이터 안내 · 불완전 원본 {data.incomplete_sources.length}개</summary>
        <p className="mt-3">흰색은 원본의 미표시 영역입니다. 액션을 임의로 폴드로 해석하지 않습니다. 범례의 스택 조건은 원문 그대로이며, 누적 레인지로 확장하지 않았습니다.</p>
        <p className="mt-2">혼합 비율은 색상 폭으로 추정했습니다. 범례가 없는 색상은 의미를 확정할 수 없습니다.</p>
        {data.incomplete_sources.map(source => <p key={source.source} className="mt-2 break-words">잘린 이미지로 변환 제외: {source.source}</p>)}
      </details>
    </div>
  );
}

function ChartDetail({ chart, entry, hideGrid }: { chart: BencbChart; entry: BencbEntry; hideGrid: boolean }) {
  const [hand, setHand] = useState('AA');
  const [showJson, setShowJson] = useState(false);
  const missingLegend = chart.legend.some(entry => entry.label === null);
  const description = (value: string) => Object.entries(chart.hands[value]).map(([id, weight]) => `${legendLabel(chart, id)} ${percent(weight)}`).join(', ');

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">{bencbEntryTitle(entry)}</h3>
        <p className="mt-1 text-sm text-gray-400">표시 레인지 {chart.total_marked_combos.toLocaleString('ko-KR')} / 1,326 콤보 · {percent(chart.total_marked_combos / 1326)}</p>
      </div>
      {entry.stackDetail && <p className="text-sm text-gray-300">원문 스택: {entry.stackDetail} · 통합 차트</p>}
      {entry.note && <p className="text-xs leading-relaxed text-amber-200">{entry.note}</p>}
      {missingLegend && <p className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">원본에 일부 색상의 범례가 없습니다. 해당 핸드의 액션은 ‘범례 없음’으로 표시합니다.</p>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          {!hideGrid && <div className="grid gap-px rounded-lg bg-gray-700 p-1" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }} aria-label="Bencb 핸드 차트">
            {RANKS.flatMap((_, row) => RANKS.map((__, column) => {
              const value = getHandName(row, column);
              return <button
                key={value}
                type="button"
                data-hand={value}
                aria-label={`${value}: ${description(value)}`}
                aria-pressed={value === hand}
                title={`${value}: ${description(value)}`}
                onClick={() => setHand(value)}
                className="relative flex aspect-square min-w-0 items-center justify-center text-[clamp(8px,2vw,14px)] font-bold text-gray-950 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-white"
                style={{ background: handBackground(chart, value), boxShadow: value === hand ? 'inset 0 0 0 3px #111827, inset 0 0 0 5px #fff' : undefined }}
              ><span className="rounded-sm bg-white/80 px-px leading-tight">{value}</span></button>;
            }))}
          </div>}
          <div aria-label="선택한 핸드 상세" aria-live="polite" className="rounded-xl border border-gray-700 bg-gray-900 p-4">
            <h4 className="text-lg font-bold text-white">{hand}</h4>
            {Object.entries(chart.hands[hand]).map(([id, weight]) => (
              <p key={id} className="mt-1 flex justify-between gap-3 text-sm text-gray-200"><span>{legendLabel(chart, id)}</span><strong className="shrink-0">{percent(weight)}</strong></p>
            ))}
            {chart.mixed_hands.includes(hand) && <p className="mt-2 text-xs text-amber-300">혼합 비율 · 이미지 색상 폭에서 추정</p>}
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-300">원문 범례</h4>
          {chart.legend.map(entry => <div key={entry.id} className="flex gap-3 rounded-lg border border-gray-800 bg-gray-900/60 p-3">
            <span className="mt-1 h-4 w-4 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-white">{entry.label ?? '범례 없음'}</p>
              <p className="mt-1 text-xs text-gray-400">{entry.combo_count.toLocaleString('ko-KR')} 콤보{entry.source_percent !== undefined && ` · 원본 레인지 내 ${entry.source_percent}%`}</p>
            </div>
          </div>)}
          <p className="pt-1 text-xs leading-relaxed text-gray-500">범례의 퍼센트는 레인지 안의 비중입니다. 핸드별 액션 비율은 핸드를 눌러 확인하세요.</p>
        </div>
      </div>
      <p className="break-words text-xs text-gray-500">원본: {chart.source}</p>
      <details className="rounded-xl border border-gray-800 p-4" onToggle={event => setShowJson(event.currentTarget.open)}>
        <summary className="cursor-pointer text-sm text-gray-300">선택한 차트 JSON 보기</summary>
        {showJson && <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-300">{JSON.stringify(chart, null, 2)}</pre>}
      </details>
    </section>
  );
}
