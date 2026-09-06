import { useState } from 'react';
import { reviewKey, type HandReview, type HandSnapshot } from '../../../shared/handReviews';
import type { ReviewStore } from './useHandReviews';
const button = 'rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 hover:bg-gray-700 disabled:opacity-50';
export function SaveHandReviewButton({ store, snapshot }: { store: ReviewStore; snapshot: HandSnapshot }) {
  const saved = store.reviews.some(r => r.key === reviewKey(snapshot));
  return <div>
    <button type="button" className={button} disabled={store.busy || !store.ready || saved} onClick={() => void store.request({ action: 'save', snapshot })}>{saved ? '노트에 저장됨' : '복기 노트에 저장'}</button>
    {store.error && <p role="alert" className="mt-2 text-sm text-red-300">{store.error}</p>}
    {!store.ready && !store.busy && <button className={button} onClick={() => void store.request()}>다시 불러오기</button>}
  </div>;
}
export function HandReviewNotebook({ store }: { store: ReviewStore }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'completed'>('pending');
  return <section className="mb-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
    <button className={button} aria-expanded={open} onClick={() => setOpen(!open)}>복기 노트 ({store.reviews.length})</button>
    {open && <div className="mt-3 space-y-3">
      <p className="text-sm text-gray-400">저장한 핸드 원문은 업로드 내역을 지워도 유지됩니다. 핸드 상세에서 복기할 핸드를 저장하세요. 메모는 자동 저장되지 않습니다. 필터 변경·노트 닫기 전에 메모를 저장하세요.</p>
      <div className="flex flex-wrap gap-2">
        <button className={button} aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>미완료</button>
        <button className={button} aria-pressed={filter === 'completed'} onClick={() => setFilter('completed')}>완료</button>
      </div>
      {store.busy && <p role="status" className="text-sm text-gray-400">서버와 동기화 중…</p>}
      {store.error && <p role="alert" className="text-red-300">{store.error}</p>}
      {!store.ready && !store.busy && <button className={button} onClick={() => void store.request()}>다시 불러오기</button>}
      {store.ready && store.reviews.filter(r => r.status === filter).length === 0 && <p className="text-sm text-gray-400">{filter === 'pending' ? '미완료' : '완료'} 노트가 없습니다.</p>}
      {store.reviews.filter(r => r.status === filter).map(review => <ReviewEditor key={review.key} review={review} store={store} />)}
    </div>}
  </section>;
}
function ReviewEditor({ review, store }: { review: HandReview; store: ReviewStore }) {
  const [thoughts, setThoughts] = useState(review.thoughts);
  const [conclusion, setConclusion] = useState(review.conclusion);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async (status: HandReview['status']) => { setSaved(false); if (await store.request({ action: 'update', key: review.key, thoughts, conclusion, status })) setSaved(true); };
  return <article className="space-y-3 rounded border border-gray-700 p-3">
    <h3 className="font-semibold text-white">Hand #{review.snapshot.handId} · {review.snapshot.gameType === 'cash' ? 'Cash' : 'Tournament'} · {review.snapshot.heroHand} · {review.snapshot.heroPosition}</h3>
    {review.snapshot.startedAt && <p className="text-xs text-gray-400">{review.snapshot.startedAt}</p>}
    <details><summary className="cursor-pointer text-sm text-gray-300">저장한 핸드 원문</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-300">{review.snapshot.rawText || '원문이 없는 핸드입니다.'}</pre></details>
    <label className="block text-sm text-gray-300">당시 생각<textarea disabled={store.busy} maxLength={10000} className="mt-1 block min-h-24 w-full rounded border border-gray-600 bg-gray-950 p-2" value={thoughts} onChange={e => { setThoughts(e.target.value); setSaved(false); }} /></label>
    <label className="block text-sm text-gray-300">복기 결론<textarea disabled={store.busy} maxLength={10000} className="mt-1 block min-h-24 w-full rounded border border-gray-600 bg-gray-950 p-2" value={conclusion} onChange={e => { setConclusion(e.target.value); setSaved(false); }} /></label>
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={store.busy} onClick={() => void save(review.status)}>메모 저장</button>
      <button className={button} disabled={store.busy} onClick={() => void save(review.status === 'pending' ? 'completed' : 'pending')}>{review.status === 'pending' ? '완료로 저장' : '미완료로 되돌리기'}</button>
      <button className={button} disabled={store.busy} onClick={() => setConfirmDelete(true)}>노트 삭제</button>
    </div>
    {confirmDelete && <div className="flex flex-wrap items-center gap-2 text-sm text-red-200">메모와 저장한 원문을 삭제합니다.
      <button className={button} disabled={store.busy} onClick={async () => { await store.request({ action: 'delete', key: review.key }); setConfirmDelete(false); }}>삭제 확인</button>
      <button className={button} onClick={() => setConfirmDelete(false)}>취소</button>
    </div>}
    {saved && <p role="status" className="text-sm text-green-300">메모를 저장했습니다.</p>}
  </article>;
}
