import { useEffect, useId, useRef, useState } from 'react';
import { betSizeLabel, formatFrequency, type FlopCbetRecord } from '../data/flopCbet';

export function FlopSourceModal({ record, cards, onClose }: {
  record: FlopCbetRecord;
  cards: string[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

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
        <SourceImage key={record.source.url} source={record.source.url} alt={`${cards.join(' ')} 원본 이미지`} />
      </div>
    </dialog>
  );
}

function SourceImage({ source, alt }: { source: string | null; alt: string }) {
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const fileId = source && new URL(source).pathname.match(/^\/file\/d\/([\w-]+)\/(?:view|preview)\/?$/)?.[1];
        if (!fileId) throw new Error('Missing source');
        const response = await fetch(`${import.meta.env.BASE_URL}flop-cbet-images.json`, { signal: controller.signal });
        if (!response.ok) throw new Error('Image index unavailable');
        const manifest = await response.json();
        const image = manifest?.schema_version === 1 && manifest.images?.[fileId];
        if (typeof image !== 'string') throw new Error('Image unavailable');
        const parsed = new URL(image);
        if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(parsed.hostname)
          || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash
          || parsed.pathname !== `/flop-cbet/${fileId}`) throw new Error('Invalid image URL');
        if (!controller.signal.aborted) setUrl(image);
      } catch {
        if (!controller.signal.aborted) setStatus('error');
      }
    }
    void load();
    return () => controller.abort();
  }, [source, attempt]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto bg-gray-900 p-2 sm:p-4">
      {status === 'loading' && <p role="status" className="p-4 text-sm text-gray-400">이미지 로딩 중...</p>}
      {status === 'error' ? <div role="alert" className="space-y-3 p-6 text-center text-sm text-gray-300">
        <p>이미지를 불러오지 못했습니다.</p>
        <button type="button" className="rounded-lg bg-gray-800 px-4 py-2 text-white" onClick={() => {
          setUrl(null); setStatus('loading'); setAttempt(value => value + 1);
        }}>다시 시도</button>
      </div> : url && <img key={attempt} src={url} alt={alt}
        onLoad={() => setStatus('ready')} onError={() => setStatus('error')}
        className="min-h-0 max-w-full flex-1 object-contain" />}
    </div>
  );
}
