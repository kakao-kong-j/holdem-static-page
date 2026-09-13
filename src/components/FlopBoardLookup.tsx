import { useMemo, useState } from 'react';
import { betSizeLabel, formatFrequency, type FlopCbetData, type FlopCbetRecord } from '../data/flopCbet';
import { displayBoard, matchFlopBoard } from '../data/flopBoardMatch';

export function FlopBoardLookup({ boards, records, onPreview }: {
  boards: FlopCbetData['boards']; records: FlopCbetRecord[]; onPreview: (record: FlopCbetRecord) => void;
}) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const result = useMemo(() => {
    if (submitted === null) return null;
    const available = new Set(records.map(row => row.board_id));
    return matchFlopBoard(submitted, boards.filter(board => available.has(board.id)));
  }, [submitted, boards, records]);
  const matched = result?.kind === 'exact' || result?.kind === 'inferred' ? result : null;
  const reference = matched ? records.find(row => row.board_id === matched.board.id) : undefined;

  return <section aria-label="플랍 직접 입력" className="rounded-xl border border-gray-700/70 bg-gray-900/50 p-4 sm:p-5">
    <h3 className="text-sm font-semibold text-white">플랍 직접 입력</h3>
    <p className="mt-2 text-xs leading-relaxed text-gray-400">목록에 없는 보드는 같은 Board Texture 안에서 가장 가까운 참고 보드를 찾습니다.</p>
    <form className="mt-3 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setSubmitted(input); }}>
      <input aria-label="플랍 보드 입력" autoComplete="off" spellCheck={false} placeholder="asjs7s 또는 ts9h2d"
        value={input} onChange={event => { setInput(event.target.value); setSubmitted(null); }}
        className="min-w-0 flex-[1_1_180px] rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none" />
      <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500">보드 조회</button>
    </form>
    {result?.kind === 'invalid' && <p role="alert" className="mt-3 text-sm text-red-300">서로 다른 카드 3장을 입력하세요. 예: asjs7s · ts9h2d (무늬: s/h/d/c)</p>}
    {result?.kind === 'unmatched' && <div role="status" className="mt-4 space-y-2 rounded-lg border border-gray-700 p-3 text-sm text-gray-300">
      <p className="font-semibold">{displayBoard(result.cards)} · 참고 보드 없음</p>
      <p className="text-xs leading-relaxed text-gray-400">입력 텍스처(규칙 분류): {result.texture}. 현재 상황에 같은 텍스처의 등록 보드가 없습니다. 다른 텍스처로 대체하지 않았습니다.</p>
    </div>}
    {matched && <div role="status" className={`mt-4 space-y-3 rounded-lg border p-3 ${matched.kind === 'exact' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-1 text-xs font-semibold ${matched.kind === 'exact' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>
          {matched.kind === 'exact' ? '실제 목록' : '추측 기반'}
        </span>
        <span className="text-sm font-semibold text-white">입력: {displayBoard(matched.cards)}</span>
      </div>
      {matched.kind === 'inferred' && <div className="space-y-1 text-xs leading-relaxed text-gray-300">
        <p>입력 텍스처(규칙 분류): <strong>{matched.texture}</strong></p>
        <p>참고 보드: <strong>{displayBoard(matched.board.cards)}</strong> ({matched.board.id})</p>
        <p>적용 규칙: {matched.rule === 'suits' ? '1. 무늬 변경' : matched.rule === 'low-card' ? '2. 연결되지 않은 가장 낮은 카드 변경 (필요 시 무늬 변경 포함)' : '3. 같은 텍스처에서 가장 가까운 보드'}</p>
        <p>변경: {matched.changes.join(', ')}</p>
      </div>}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
        <span>{matched.kind === 'inferred' ? '참고 보드의 Board Texture' : 'Board Texture'}</span>
        {matched.board.textures?.length ? matched.board.textures.map(texture => <span key={texture} className="rounded border border-indigo-400/20 bg-indigo-400/10 px-2 py-1 text-indigo-200">{texture}</span>) : <span>미등록</span>}
      </div>
      {reference && <p className="text-xs leading-relaxed text-gray-300">
        {matched.kind === 'inferred' ? '참고 보드의' : '실제 목록의'} {reference.action === 'stab' ? 'Stab' : 'C-bet'}: 사이즈 {betSizeLabel(reference.size)} · 빈도 {formatFrequency(reference.frequency_pct)}
        {matched.kind === 'inferred' && <span className="mt-1 block text-amber-200/80">입력 보드를 계산한 값이 아닙니다. 텍스처와 전략이 달라질 수 있습니다.</span>}
      </p>}
      {reference?.source.url && <button type="button" aria-haspopup="dialog" onClick={() => onPreview(reference)} className="text-xs text-indigo-300 underline underline-offset-4">{matched.kind === 'inferred' ? '참고 보드 원본 이미지' : '원본 이미지'} 보기</button>}
    </div>}
    <p className="mt-3 text-[11px] leading-relaxed text-gray-500">현재 선택한 상황에서 조회합니다. 같은 텍스처 중 무늬 변경 → 두 번째 카드와 5 이상 떨어진 최저 카드 변경을 먼저 시도합니다. 이후 페어 위치, 무늬 관계, 높은 카드, 숫자 간격 순으로 비교합니다. 입력 텍스처는 카드 규칙에 따른 분류이며 원본 시트에서 직접 조회한 값은 아닙니다.</p>
  </section>;
}
