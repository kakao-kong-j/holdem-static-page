import { useEffect, useId, useRef } from 'react';
import { betSizeLabel, formatFrequency, type FlopCbetRecord } from '../data/flopCbet';

export function FlopSourceModal({ record, cards, onClose }: {
  record: FlopCbetRecord;
  cards: string[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const source = record.source.url ? new URL(record.source.url) : null;
  const fileId = source?.pathname.match(/^\/file\/d\/([\w-]+)\/(?:view|preview)\/?$/)?.[1];
  if (source && fileId) {
    source.pathname = `/file/d/${fileId}/preview`;
    source.searchParams.delete('usp');
  }

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-auto h-[90dvh] max-h-[960px] w-[calc(100%-1.5rem)] max-w-6xl overflow-hidden rounded-xl border border-gray-700 bg-gray-950 p-0 text-gray-100 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-800 p-4">
          <div className="min-w-0">
            <h3 id={titleId} className="font-semibold">{cards.join(' ')} · 원본 이미지</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              {record.hero} vs {record.villain} · {record.stack_bb} BB · {record.profile}
              {' · '}{record.action === 'stab' ? 'Stab' : 'C-bet'} {betSizeLabel(record.size)} / {formatFrequency(record.frequency_pct)}
            </p>
          </div>
          <button ref={closeRef} type="button" aria-label="이미지 닫기" onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-700 text-lg text-gray-300 hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-indigo-400">×</button>
        </header>
        {source && fileId ? <iframe src={source.href} title={`${cards.join(' ')} 원본 이미지 미리보기`}
          sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"
          className="min-h-0 w-full flex-1 border-0 bg-gray-900" />
          : <p role="alert" className="flex-1 p-6 text-sm text-gray-400">이 원본 링크는 미리보기를 지원하지 않습니다.</p>}
        <p className="shrink-0 border-t border-gray-800 px-4 py-2.5 text-xs text-gray-500">이미지가 보이지 않으면 원본 Google Drive 공유 권한을 확인해 주세요.</p>
      </div>
    </dialog>
  );
}
