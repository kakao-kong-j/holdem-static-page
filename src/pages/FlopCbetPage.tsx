import { useEffect, useMemo, useState } from 'react';
import { FlopBoardLookup } from '../components/FlopBoardLookup';
import { FlopSourceModal } from '../components/FlopSourceModal';
import {
  FLOP_CBET_URL, FLOP_SPOTS, betSizeLabel, filterFlopCbetRecords, formatFrequency,
  getFlopCbetSelection, summarizeFlopCbet, validateFlopCbetData,
  type FlopCbetData, type FlopCbetRecord, type FlopCbetSelection, type FlopSort, type FlopSpot, type FlopProfile, type FlopStack,
} from '../data/flopCbet';

const controlClass = 'w-full min-w-0 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400';
const sizeColors: Record<string, string> = {
  '10%': '#38bdf8', '25%': '#818cf8', '50%': '#a78bfa',
  '75%': '#f59e0b', '100%': '#fb7185', 'ALL-IN': '#f43f5e',
};
const suits: Record<string, { symbol: string; color: string }> = {
  s: { symbol: '♠', color: 'text-gray-900' }, h: { symbol: '♥', color: 'text-red-600' },
  d: { symbol: '♦', color: 'text-blue-600' }, c: { symbol: '♣', color: 'text-emerald-700' },
};

export function FlopCbetPage() {
  const [data, setData] = useState<FlopCbetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(FLOP_CBET_URL, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(value => {
        if (!controller.signal.aborted) setData(validateFlopCbetData(value));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '알 수 없는 오류');
      });
    return () => controller.abort();
  }, [attempt]);

  if (error) return (
    <div role="alert" className="space-y-4 rounded-xl border border-red-900 bg-red-950/20 p-8 text-center text-red-200">
      <p>플랍 차트를 불러오지 못했습니다. {error}</p>
      <button type="button" className="rounded-lg bg-gray-800 px-4 py-2 text-white"
        onClick={() => { setError(null); setAttempt(value => value + 1); }}>다시 시도</button>
    </div>
  );
  if (!data) return <p role="status" className="py-16 text-center text-gray-400">플랍 C-bet 데이터 로딩 중...</p>;
  return <FlopBrowser data={data} />;
}

function FlopBrowser({ data }: { data: FlopCbetData }) {
  const [requested, setRequested] = useState<Partial<FlopCbetSelection>>({});
  const [query, setQuery] = useState('');
  const [lookupReset, setLookupReset] = useState(0);
  const [sort, setSort] = useState<FlopSort>('source');
  const [preview, setPreview] = useState<FlopCbetRecord | null>(null);
  const { selection, options } = useMemo(() => getFlopCbetSelection(data, requested), [data, requested]);
  const rows = useMemo(() => filterFlopCbetRecords(data, selection, query, sort), [data, selection, query, sort]);
  const summary = useMemo(() => summarizeFlopCbet(rows), [rows]);
  const boardMap = useMemo(() => new Map(data.boards.map(board => [board.id, board])), [data]);
  const contextRows = useMemo(() => filterFlopCbetRecords(data, selection, '', 'source'), [data, selection]);
  const contextCount = contextRows.length;
  const isStab = selection.spot === 'blind-war' && selection.position === 'BBvsSB';
  const action = isStab ? 'Stab' : 'C-bet';
  const update = (patch: Partial<FlopCbetSelection>) => setRequested({ ...selection, ...patch });
  const reset = () => { setRequested({}); setQuery(''); setSort('source'); setLookupReset(value => value + 1); };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 py-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">Tournament · Flop study</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">플랍 C-bet</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">같은 보드도 상황에 따라 다르게. 베팅 사이즈와 빈도를 함께 확인하세요.</p>
        </div>
        <a href={FLOP_CBET_URL} download="tournament-flop-cbet.json"
          className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 transition-colors hover:border-indigo-400 hover:text-white">JSON 다운로드 ↓</a>
      </header>

      <section aria-label="조회 조건" className="rounded-xl border border-gray-700/70 bg-gray-900/80 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">상황 선택</h3>
          <button type="button" onClick={reset} className="rounded px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-500/10">초기화</button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className="space-y-1.5 text-xs text-gray-400">상황
            <select aria-label="상황" className={controlClass} value={selection.spot} onChange={e => update({ spot: e.target.value as FlopSpot })}>
              {options.spots.map(spot => <option key={spot} value={spot}>{FLOP_SPOTS[spot]}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs text-gray-400">상대 유형
            <select aria-label="상대 유형" className={controlClass} value={selection.profile} onChange={e => update({ profile: e.target.value as FlopProfile })}>
              {options.profiles.map(profile => <option key={profile}>{profile}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs text-gray-400">스택
            <select aria-label="스택" className={controlClass} value={selection.stack_bb} onChange={e => update({ stack_bb: Number(e.target.value) as FlopStack })}>
              {options.stacks.map(stack => <option key={stack} value={stack}>{stack} BB</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs text-gray-400">포지션
            <select aria-label="포지션" className={controlClass} value={selection.position} onChange={e => update({ position: e.target.value })}>
              {options.positions.map(position => <option key={position} value={position}>{position.replace('vs', ' vs ')}{selection.spot === 'blind-war' ? (position === 'BBvsSB' ? ' · Stab' : ' · C-bet') : ''}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          {selection.spot.startsWith('4bp') ? '4벳 팟은 원본에 수록된 50BB만 제공합니다. ' : ''}
          {isStab ? 'BB가 SB의 체크를 받은 뒤 베팅하는 Stab 빈도입니다.' : '선택한 상황에서 플랍 C-bet을 하는 빈도입니다.'}
        </p>
      </section>

      <FlopBoardLookup key={lookupReset} boards={data.boards} records={contextRows} onPreview={setPreview} />

      <section aria-label="빈도 요약" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-5">
          <p className="text-xs text-indigo-200">조회 보드 평균 {action} 빈도</p>
          <p aria-label="조회 보드 평균 빈도" className="mt-2 text-3xl font-bold tabular-nums text-white">
            {summary.mean === null ? '—' : formatFrequency(summary.mean)}
          </p>
          <p className="mt-2 text-xs text-gray-400">현재 조회한 {summary.count}개 보드의 단순 평균</p>
        </div>
        <div className="rounded-xl border border-gray-700/70 bg-gray-900/50 p-5">
          <h3 className="text-xs text-gray-400">사이즈별 빈도 · 해당 사이즈가 지정된 보드 기준</h3>
          <div className="mt-4 flex flex-wrap gap-x-7 gap-y-4">
            {summary.sizes.length ? summary.sizes.map(group => <div key={group.label}>
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sizeColors[group.label] }} />{group.label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-gray-100">{formatFrequency(group.mean)}</p>
              <p className="mt-0.5 text-xs text-gray-500">{group.count}개 보드</p>
            </div>) : <p className="text-sm text-gray-500">조회할 보드를 선택하세요.</p>}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-700/70 bg-gray-900/50">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{selection.position.replace('vs', ' vs ')} <span className="ml-2 font-normal text-gray-400">{selection.stack_bb} BB · {selection.profile}</span></h3>
            <p role="status" className="text-xs tabular-nums text-gray-400">{rows.length} / {contextCount}개 보드</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-[2_1_180px] space-y-1.5 text-xs text-gray-400">보드 검색
              <input type="search" aria-label="보드 검색" className={controlClass} placeholder="예: AK3, AsKs3h" value={query} onChange={e => setQuery(e.target.value)} />
            </label>
            <label className="min-w-0 flex-[1_1_130px] space-y-1.5 text-xs text-gray-400">정렬
              <select aria-label="정렬" className={controlClass} value={sort} onChange={e => setSort(e.target.value as FlopSort)}>
                <option value="source">원본 보드 순서</option>
                <option value="frequency-desc">빈도 높은 순</option>
                <option value="frequency-asc">빈도 낮은 순</option>
              </select>
            </label>
          </div>
        </div>
        {rows.length ? <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">보드별 {action} 베팅 사이즈와 빈도</caption>
            <thead className="border-y border-gray-800 bg-gray-950/70 text-[11px] font-medium text-gray-500">
              <tr><th scope="col" className="px-3 py-3 sm:px-5">플랍</th><th scope="col" className="px-2 py-3">사이즈</th><th scope="col" className="px-2 py-3">{action} 빈도</th><th scope="col" className="px-3 py-3 text-right sm:px-5">원본</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-800/80">
              {rows.map(row => {
                const label = betSizeLabel(row.size);
                const board = boardMap.get(row.board_id)!;
                const cards = board.cards;
                return <tr key={row.board_id} className="transition-colors hover:bg-gray-800/50">
                  <th scope="row" className="w-32 px-3 py-3 sm:w-44 sm:px-5">
                    <div className="flex gap-1" aria-label={cards.join(' ')}>
                      {cards.map(card => <span key={card} className={`flex h-9 w-7 shrink-0 flex-col items-center justify-center rounded bg-gray-100 text-sm font-bold leading-none shadow-sm sm:h-10 sm:w-8 ${suits[card[1]].color}`}>
                        <span>{card[0]}</span><span className="mt-0.5 text-xs">{suits[card[1]].symbol}</span>
                      </span>)}
                    </div>
                    {!!board.textures?.length && <div aria-label="Board Texture" className="mt-2 flex flex-wrap gap-1">
                      {board.textures.map(texture => <span key={texture} className="rounded border border-indigo-400/20 bg-indigo-400/10 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-indigo-200">{texture}</span>)}
                    </div>}
                  </th>
                  <td className="w-16 px-2 py-3 sm:w-24"><span className="whitespace-nowrap text-xs font-semibold" style={{ color: sizeColors[label] }}>{label}</span></td>
                  <td className="min-w-24 px-2 py-3">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                      <div role="meter" aria-label={`${cards.join(' ')} ${action} 빈도`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.frequency_pct}
                        className="h-2.5 w-full overflow-hidden rounded-full bg-gray-700/60 sm:h-3">
                        <div className="h-full rounded-full" style={{ width: `${row.frequency_pct}%`, backgroundColor: sizeColors[label] }} />
                      </div>
                      <span className="text-right text-xs font-semibold tabular-nums text-gray-200 sm:w-14 sm:shrink-0">{formatFrequency(row.frequency_pct)}</span>
                    </div>
                  </td>
                  <td className="w-12 px-3 py-3 text-right sm:w-20 sm:px-5">
                    {row.source.url ? <button type="button" aria-haspopup="dialog" onClick={() => setPreview(row)} aria-label={`${cards.join(' ')} 원본 이미지 보기`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 text-gray-400 hover:border-indigo-400 hover:text-indigo-200" title="원본 이미지 보기">⊕</button> : <span className="text-gray-600">—</span>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div> : <p className="border-t border-gray-800 px-4 py-14 text-center text-sm text-gray-400">조건에 맞는 보드가 없습니다. 검색어를 바꾸거나 초기화하세요.</p>}
        <p className="border-t border-gray-800 px-4 py-3 text-xs leading-relaxed text-gray-500 sm:px-5">사이즈는 팟 대비 베팅 금액, 막대와 숫자는 베팅 빈도입니다. ALL-IN은 올인을 뜻합니다.</p>
      </section>

      <details className="rounded-xl border border-gray-800 p-4 text-xs leading-relaxed text-gray-400">
        <summary className="cursor-pointer text-gray-300">데이터 안내 · {data.records.length.toLocaleString('ko-KR')}개 전략 / {data.boards.length}개 보드</summary>
        <div className="mt-3 space-y-2">
          <p>원본: {data.source.workbook}</p>
          <p>원본에 수록된 각 보드의 사이즈 1개와 빈도를 그대로 조회합니다. 평균은 조회 보드들의 단순 평균이며, 전체 가능한 플랍의 발생 확률로 가중한 값이 아닙니다.</p>
          <p>Calling Station / Maniac은 원본의 노드락 프로필입니다. 구체적인 노드락 가정은 이 파일에 포함되어 있지 않습니다.</p>
          <p>Board Texture 태그는 30bb BTN vs BB 시트의 분류입니다. 숫자와 무늬 관계가 같은 보드에 적용하며, 베팅 빈도는 기존 원본 값을 유지합니다.</p>
          <p>원본 이미지는 모달의 Google Drive 미리보기로 표시합니다. 원본 공유 권한에 따라 표시가 제한될 수 있습니다.</p>
          {data.corrections.length > 0 && <div>
            <p>숫자 표기 정규화 {data.corrections.length}건:</p>
            <ul className="mt-1 list-inside list-disc">
              {data.corrections.map(correction => <li key={`${correction.sheet}:${correction.cell}`}>{correction.sheet}!{correction.cell}: {correction.original} → {correction.normalized}</li>)}
            </ul>
          </div>}
        </div>
      </details>
      {preview && <FlopSourceModal record={preview} cards={boardMap.get(preview.board_id)!.cards} onClose={() => setPreview(null)} />}
    </div>
  );
}
