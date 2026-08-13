import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { RangeGrid } from '../components/RangeGrid';
import {
  COINPOKER_COMPARE_COLORS,
  buildCoinPokerGrid,
  compareCoinPokerAutoStack,
  groupCoinPokerItemsByHand,
  summarizeCoinPokerComparison,
  type CoinPokerComparisonItem,
} from '../utils/coinpokerCompare';
import type { CoinPokerGameType } from '../utils/coinpokerParser';
import type { AllData, StackSize } from '../types';
import { useCoinPokerStore } from './coinpoker/useCoinPokerStore';

const GAME_TYPE_TABS: { value: CoinPokerGameType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'tournament', label: 'Tournament' },
];

interface Props {
  fallbackStack: StackSize;
  data: AllData;
}

const TABLE_LIMIT = 250;
const TOP_MISTAKE_HAND_LIMIT = 12;

interface MistakeHandSummary {
  hand: string;
  count: number;
  missedOpenCount: number;
  extraOpenCount: number;
}

export function CoinPokerAnalysisPage({ fallbackStack, data }: Props) {
  const {
    store,
    setStore,
    gameType,
    setGameType,
    chartLimit,
    setChartLimit,
    loading,
    progress,
    mergeCoinPokerStore,
    parseCoinPokerHands,
    clearCoinPokerHands,
    fetchCoinPokerHands,
    pushCoinPokerHands,
  } = useCoinPokerStore();
  const [excludeShortStack, setExcludeShortStack] = useState(false); // tournament: drop effective ≤ 10BB
  const [draftText, setDraftText] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [hoveredHand, setHoveredHand] = useState<string | null>(null);
  const [pinnedHand, setPinnedHand] = useState<string | null>(null);
  const [selectedHandHistory, setSelectedHandHistory] = useState<CoinPokerComparisonItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsedHands = gameType === 'cash' ? store.cash : store.tournament;

  // Tournament-only: exclude short-stack (effective ≤ 10BB) push/fold spots.
  // effectiveStackBb is set by the current parser; legacy stored hands lack it,
  // so we re-derive from rawText (only when the filter is active, memoized).
  const SHORT_STACK_BB = 10;
  const shortStackActive = gameType === 'tournament' && excludeShortStack;
  const effectiveByHandId = useMemo(() => {
    if (!shortStackActive) return null;
    const map = new Map<string, number>();
    for (const h of parsedHands) {
      let eff = typeof h.effectiveStackBb === 'number' ? h.effectiveStackBb : undefined;
      if (eff === undefined) {
        const reparsed = parseCoinPokerHands(h.rawText)[0];
        eff = typeof reparsed?.effectiveStackBb === 'number' ? reparsed.effectiveStackBb : (h.heroStackBb ?? Infinity);
      }
      map.set(h.handId, eff);
    }
    return map;
  }, [shortStackActive, parsedHands, parseCoinPokerHands]);

  const filteredHands = useMemo(() => {
    if (!shortStackActive || !effectiveByHandId) return parsedHands;
    return parsedHands.filter(h => (effectiveByHandId.get(h.handId) ?? Infinity) > SHORT_STACK_BB);
  }, [parsedHands, shortStackActive, effectiveByHandId]);

  const shortStackExcludedCount = parsedHands.length - filteredHands.length;

  // Newest-first by numeric handId (CoinPoker hand numbers increase over time),
  // so the limit charts the most recent N hands.
  const sortedHands = useMemo(
    () => [...filteredHands].sort((a, b) => Number(b.handId) - Number(a.handId)),
    [filteredHands],
  );
  const totalHands = sortedHands.length;
  const effectiveLimit = totalHands === 0 ? 0 : Math.max(1, Math.min(chartLimit, totalHands));
  const chartedHands = useMemo(() => sortedHands.slice(0, effectiveLimit), [sortedHands, effectiveLimit]);

  const comparison = useMemo(() => compareCoinPokerAutoStack(chartedHands, data, fallbackStack), [chartedHands, data, fallbackStack]);
  const summary = useMemo(() => summarizeCoinPokerComparison(comparison), [comparison]);
  const comparisonGrid = useMemo(() => buildCoinPokerGrid(comparison), [comparison]);
  const gridMistakeLabels = useMemo(() => buildGridMistakeLabels(comparison), [comparison]);
  const comparisonByHand = useMemo(() => groupCoinPokerItemsByHand(comparison), [comparison]);
  const tableRows = useMemo(() => comparison.slice(0, TABLE_LIMIT), [comparison]);
  const topMistakeHands = useMemo(() => buildTopMistakeHands(comparison), [comparison]);
  const activeHand = pinnedHand ?? hoveredHand;
  const activeItems = useMemo(() => {
    const items = activeHand ? comparisonByHand[activeHand] ?? [] : [];
    return pinnedHand === activeHand ? sortPinnedSelectionItems(items) : items;
  }, [activeHand, comparisonByHand, pinnedHand]);

  const isEmpty = parsedHands.length === 0;
  const counts = { cash: store.cash.length, tournament: store.tournament.length };

  const resetSelection = () => {
    setHoveredHand(null);
    setPinnedHand(null);
    setSelectedHandHistory(null);
  };

  // Parse text, merge into the store (deduped by handId), and persist to the server.
  const ingest = async (text: string) => {
    const parsed = parseCoinPokerHands(text);
    if (parsed.length === 0) {
      setFileError('CoinPoker 핸드를 찾지 못했습니다. 핸드 히스토리 형식을 확인해 주세요.');
      return;
    }
    setFileError(null);
    resetSelection();

    // Optimistic local merge so it shows immediately even without /api.
    setStore(prev => mergeCoinPokerStore(prev, parsed));

    // Switch to the tab that received the most new hands.
    const tournamentCount = parsed.filter(h => h.gameType === 'tournament').length;
    setGameType(tournamentCount > parsed.length - tournamentCount ? 'tournament' : 'cash');

    setBusy(true);
    setUploadProgress({ completed: 0, total: parsed.length });
    try {
      await pushCoinPokerHands(parsed, setUploadProgress);
    } catch (err) {
      // HTTP error (e.g. expired session) → the optimistic state was NOT saved.
      // Surface it and reconcile with the server so we don't show ghost hands.
      if (err instanceof Error && err.message.includes('too large')) {
        setFileError('핸드 기록 하나가 너무 커서 저장할 수 없습니다. 해당 핸드를 제외한 뒤 다시 시도해 주세요.');
      } else if (err instanceof Error && err.message.startsWith('push failed:')) {
        setFileError('일부 핸드가 서버에 저장되지 않았습니다. 다시 시도해 주세요.');
        try {
          setStore(await fetchCoinPokerHands());
        } catch {
          /* reconcile failed too — keep optimistic so data isn't lost mid-session */
        }
      }
      // Network/offline error → keep the optimistic local merge.
    } finally {
      setBusy(false);
      setUploadProgress(null);
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    try {
      await ingest(await file.text());
    } catch {
      setFileError('파일을 읽지 못했습니다. 다시 선택해 주세요.');
    }
  };

  const handleAddDraft = async () => {
    if (!draftText.trim()) return;
    await ingest(draftText);
    setDraftText('');
  };

  const handleClearType = async () => {
    if (!confirm(`${gameType === 'cash' ? 'Cash' : 'Tournament'} 누적 기록을 모두 삭제하시겠습니까?`)) return;
    resetSelection();
    setStore(prev => ({ ...prev, [gameType]: [] }));
    try {
      const next = await clearCoinPokerHands(gameType);
      setStore(next);
    } catch {
      /* offline — local cleared regardless */
    }
  };

  const handleGridClick = (hand: string) => {
    setPinnedHand(current => current === hand ? null : hand);
    setHoveredHand(null);
  };

  const summaryItems = [
    { label: 'Hero 핸드', value: summary.parsedHands, tone: 'text-white' },
    { label: '비교 가능', value: summary.comparableHands, tone: 'text-sky-300' },
    { label: '일치', value: summary.matches, tone: 'text-emerald-300' },
    { label: '오버 폴드', value: summary.missedOpens, tone: 'text-amber-300' },
    { label: '루즈 오픈', value: summary.extraOpens, tone: 'text-red-300' },
    { label: '제외', value: summary.excluded, tone: 'text-gray-400' },
  ];

  if (loading) {
    const received = progress?.received ?? 0;
    const pct = progress?.total ? Math.round((received / progress.total) * 100) : null;
    const size = received < 1024 * 1024
      ? `${(received / 1024).toFixed(1)} KB`
      : `${(received / (1024 * 1024)).toFixed(1)} MB`;
    return (
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4">
        <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-4 rounded-lg border border-gray-800 bg-gray-950/30 p-8 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
          <div className="text-sm font-medium text-gray-200">CoinPoker 기록 불러오는 중...</div>
          <div className="w-full">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className={`h-full rounded-full bg-indigo-500 transition-[width] duration-150 ${pct === null ? 'w-1/3 animate-pulse' : ''}`}
                style={pct === null ? undefined : { width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {pct === null ? `${size} 불러옴...` : `${pct}% · ${size}`}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 border border-gray-800 bg-gray-950/30 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">CoinPoker RFI 분석</h2>
              <p className="mt-1 text-xs text-gray-500">
                업로드한 핸드는 계정에 누적 저장됩니다 (Cash / Tournament 분리, handId 기준 중복 제거)
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                onChange={handleFileSelect}
                disabled={busy}
                className="block w-full max-w-full text-xs text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 disabled:opacity-50 sm:w-64"
              />
              <button
                type="button"
                onClick={handleClearType}
                className="rounded bg-red-900/50 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-900/70 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={busy || counts[gameType] === 0}
              >
                {gameType === 'cash' ? 'Cash' : 'Tournament'} 비우기
              </button>
            </div>
          </div>

          {/* Game type tabs */}
          <div className="flex gap-1 rounded-lg bg-gray-900/60 p-1">
            {GAME_TYPE_TABS.map(tab => (
              <button
                key={tab.value}
                type="button"
                onClick={() => { setGameType(tab.value); resetSelection(); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  gameType === tab.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-70">{counts[tab.value]}</span>
              </button>
            ))}
          </div>

          {fileError && (
            <div className="rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              {fileError}
            </div>
          )}

          {busy && uploadProgress && (
            <div className="rounded-md border border-indigo-500/30 bg-indigo-950/30 px-3 py-2 text-xs text-indigo-200">
              서버에 저장 중: {uploadProgress.completed}/{uploadProgress.total} 핸드
            </div>
          )}

          <div className="flex flex-col gap-2">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              spellCheck={false}
              placeholder="CoinPoker hand history 텍스트를 붙여넣고 '추가'를 누르면 누적됩니다"
              className="min-h-32 w-full resize-y rounded-md border border-gray-800 bg-gray-900/70 p-3 font-mono text-xs leading-relaxed text-gray-200 outline-none placeholder:text-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddDraft}
                disabled={busy || !draftText.trim()}
                className="rounded bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>

        {isEmpty ? (
          <div className="rounded-lg border border-dashed border-gray-800 bg-gray-950/30 px-4 py-8 text-center text-sm text-gray-500">
            {`${gameType === 'cash' ? 'Cash' : 'Tournament'} 누적 기록이 없습니다. txt 파일을 올리거나 로그를 붙여넣어 추가하세요.`}
          </div>
        ) : (
          <>
            {gameType === 'tournament' && (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/20 p-3 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={excludeShortStack}
                  onChange={(e) => setExcludeShortStack(e.target.checked)}
                  className="h-4 w-4 accent-indigo-500"
                />
                <span>유효스택 10BB 이하 제외</span>
                <span className="text-gray-500">
                  (상대·나 중 짧은 스택 기준
                  {excludeShortStack && shortStackExcludedCount > 0 ? ` · ${shortStackExcludedCount}핸드 제외됨` : ''})
                </span>
              </label>
            )}

            <div className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-950/20 p-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2 whitespace-nowrap text-xs text-gray-400">
                <span>차트에 그릴 핸드 (최신순)</span>
                <input
                  type="number"
                  min={1}
                  max={totalHands}
                  value={effectiveLimit}
                  onChange={(e) =>
                    setChartLimit(Math.max(1, Math.min(totalHands, Number(e.target.value) || 1)))
                  }
                  className="w-20 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-gray-200 outline-none focus:border-indigo-500"
                />
                <span className="text-gray-500">/ 전체 {totalHands}</span>
              </div>
              <input
                type="range"
                min={1}
                max={Math.max(1, totalHands)}
                value={effectiveLimit}
                onChange={(e) => setChartLimit(Number(e.target.value))}
                className="w-full flex-1 accent-indigo-500"
                aria-label="차트에 그릴 최신 핸드 수"
              />
              <button
                type="button"
                onClick={() => setChartLimit(Number.MAX_SAFE_INTEGER)}
                disabled={effectiveLimit >= totalHands}
                className="shrink-0 rounded bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                전체
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {summaryItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                  <div className="text-[11px] font-medium text-gray-500">{item.label}</div>
                  <div className={`mt-1 text-xl font-bold leading-tight ${item.tone}`}>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(720px,1fr)_minmax(320px,420px)] xl:items-start">
              <div className="min-w-0 rounded-lg border border-gray-800 bg-gray-950/20 p-3">
                <div className="overflow-x-auto">
                  <div className="min-w-max text-center">
                    <RangeGrid
                      handAction={comparisonGrid}
                      colorMap={COINPOKER_COMPARE_COLORS}
                      highlightedHand={activeHand}
                      labelByHand={gridMistakeLabels}
                      onHoverHand={setHoveredHand}
                      onClickHand={handleGridClick}
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-gray-400">
                  {Object.entries(COINPOKER_COMPARE_COLORS).map(([status, color]) => (
                    <span key={status} className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color.bg }} />
                      {color.label}
                    </span>
                  ))}
                </div>
                <HoverSelectionPanel
                  activeHand={activeHand}
                  pinnedHand={pinnedHand}
                  items={activeItems}
                  topMistakeHands={topMistakeHands}
                  onOpenHandHistory={setSelectedHandHistory}
                  onPinHand={(hand) => {
                    setPinnedHand(hand);
                    setHoveredHand(null);
                  }}
                />
              </div>

              <div className="min-w-0 overflow-hidden rounded-lg border border-gray-800 bg-gray-950/20">
                <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-3 py-2">
                  <h3 className="text-sm font-semibold text-gray-200">비교 결과</h3>
                  <span className="text-xs text-gray-500">
                    {tableRows.length}
                    {comparison.length > TABLE_LIMIT ? ` / ${comparison.length}` : ''} hands
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="bg-gray-900/80 text-[11px] uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Hand</th>
                        <th className="px-3 py-2 font-semibold">Pos</th>
                        <th className="px-3 py-2 font-semibold">Cards</th>
                        <th className="px-3 py-2 font-semibold">Hero</th>
                        <th className="px-3 py-2 font-semibold">GTO</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Reason</th>
                        <th className="px-3 py-2 font-semibold">Stack</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/80">
                      {tableRows.length === 0 ? (
                        <tr>
                          <td className="px-3 py-6 text-center text-gray-500" colSpan={8}>
                            비교할 핸드가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        tableRows.map((item) => {
                          const outcome = outcomeTone(item);
                          return (
                            <tr
                              key={item.hand.handId}
                              className={`${OUTCOME_STYLES[outcome].tableRow} cursor-pointer text-gray-300`}
                              tabIndex={0}
                              onClick={() => setSelectedHandHistory(item)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setSelectedHandHistory(item);
                                }
                              }}
                            >
                              <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-200">{item.hand.handId}</td>
                              <td className="whitespace-nowrap px-3 py-2">{item.hand.heroPosition}</td>
                              <td className="whitespace-nowrap px-3 py-2 font-mono">{formatCards(item)}</td>
                              <td className="whitespace-nowrap px-3 py-2">{heroDecisionLabel(item.heroDecision)}</td>
                              <td className="whitespace-nowrap px-3 py-2">{gtoActionLabel(item.gtoAction)}</td>
                              <td className="px-3 py-2">
                                <span
                                  className="inline-flex max-w-48 items-center rounded px-2 py-0.5 text-[11px] font-semibold"
                                  style={{
                                    backgroundColor: COINPOKER_COMPARE_COLORS[item.status].bg,
                                    color: COINPOKER_COMPARE_COLORS[item.status].text,
                                  }}
                                >
                                  {statusLabel(item)}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-gray-500">{item.exclusionReason ?? '-'}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-gray-400">{formatStack(item)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            {selectedHandHistory && (
              <HandHistoryModal item={selectedHandHistory} onClose={() => setSelectedHandHistory(null)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function statusLabel(item: CoinPokerComparisonItem): string {
  if (item.status === 'match-open') return '일치: 플레이';
  if (item.status === 'match-fold') return '일치: 폴드';
  if (item.status === 'missed-open') return '오버 폴드';
  if (item.status === 'extra-open') return '루즈 오픈';
  return item.exclusionReason ?? '제외';
}

type OutcomeTone = 'correct' | 'incorrect' | 'unknown';

const OUTCOME_STYLES: Record<OutcomeTone, { tableRow: string; panelRow: string; badge: string; text: string; label: string }> = {
  incorrect: {
    tableRow: 'bg-red-950/20 hover:bg-red-950/35',
    panelRow: 'bg-red-950/20',
    badge: 'bg-red-500/15 text-red-200 ring-1 ring-red-500/30',
    text: 'text-red-200',
    label: '오답',
  },
  correct: {
    tableRow: 'bg-emerald-950/15 hover:bg-emerald-950/30',
    panelRow: 'bg-emerald-950/15',
    badge: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30',
    text: 'text-emerald-200',
    label: '정답',
  },
  unknown: {
    tableRow: 'bg-gray-950/30 hover:bg-gray-900/50',
    panelRow: 'bg-gray-950/30',
    badge: 'bg-gray-700/50 text-gray-300 ring-1 ring-gray-600/50',
    text: 'text-gray-300',
    label: '알수없음',
  },
};

const PINNED_OUTCOME_ORDER: Record<OutcomeTone, number> = {
  incorrect: 0,
  unknown: 1,
  correct: 2,
};

function outcomeTone(item: CoinPokerComparisonItem): OutcomeTone {
  if (item.status === 'excluded' || item.gtoAction === 'unknown') return 'unknown';
  if (item.status === 'match-open' || item.status === 'match-fold') return 'correct';
  return 'incorrect';
}

function sortPinnedSelectionItems(items: CoinPokerComparisonItem[]): CoinPokerComparisonItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftOrder = PINNED_OUTCOME_ORDER[outcomeTone(left.item)];
      const rightOrder = PINNED_OUTCOME_ORDER[outcomeTone(right.item)];
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function buildTopMistakeHands(items: CoinPokerComparisonItem[]): MistakeHandSummary[] {
  const summaryByHand: Record<string, MistakeHandSummary> = {};

  for (const item of items) {
    const hand = item.hand.heroHand;
    if (!hand || outcomeTone(item) !== 'incorrect') continue;

    const summary = summaryByHand[hand] ?? {
      hand,
      count: 0,
      missedOpenCount: 0,
      extraOpenCount: 0,
    };

    summary.count += 1;
    if (item.status === 'missed-open') summary.missedOpenCount += 1;
    if (item.status === 'extra-open') summary.extraOpenCount += 1;
    summaryByHand[hand] = summary;
  }

  return Object.values(summaryByHand)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      const leftSevere = left.extraOpenCount + left.missedOpenCount;
      const rightSevere = right.extraOpenCount + right.missedOpenCount;
      if (rightSevere !== leftSevere) return rightSevere - leftSevere;
      return left.hand.localeCompare(right.hand);
    })
    .slice(0, TOP_MISTAKE_HAND_LIMIT);
}

function buildGridMistakeLabels(items: CoinPokerComparisonItem[]): Record<string, string> {
  const countsByHand: Record<string, { total: number; mistakes: number }> = {};

  for (const item of items) {
    const hand = item.hand.heroHand;
    if (!hand) continue;

    const counts = countsByHand[hand] ?? { total: 0, mistakes: 0 };
    counts.total += 1;
    if (outcomeTone(item) === 'incorrect') counts.mistakes += 1;
    countsByHand[hand] = counts;
  }

  return Object.fromEntries(
    Object.entries(countsByHand).map(([hand, counts]) => [
      hand,
      `${Math.round((counts.mistakes / counts.total) * 100)}%`,
    ]),
  );
}

function HoverSelectionPanel({
  activeHand,
  pinnedHand,
  items,
  topMistakeHands,
  onOpenHandHistory,
  onPinHand,
}: {
  activeHand: string | null;
  pinnedHand: string | null;
  items: CoinPokerComparisonItem[];
  topMistakeHands: MistakeHandSummary[];
  onOpenHandHistory: (item: CoinPokerComparisonItem) => void;
  onPinHand: (hand: string) => void;
}) {
  if (!activeHand) {
    return (
      <div className="mt-3 rounded-md border border-gray-800 bg-gray-900/60 px-3 py-3 text-xs text-gray-500">
        그리드의 핸드에 마우스를 올리면 Hero의 실제 선택들이 표시됩니다. 클릭하면 고정됩니다.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-gray-800 bg-gray-900/60">
      <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-white">{activeHand}</div>
          {pinnedHand === activeHand && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
              고정됨
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {items.length} hands
          {pinnedHand === activeHand ? ' · 다시 클릭하면 해제' : ''}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-3 text-xs text-gray-500">
          이 핸드로 기록된 Hero 선택이 없습니다.
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          {items.slice(0, 12).map((item) => {
            const outcome = outcomeTone(item);
            return (
              <div
                key={`${item.hand.handId}-${item.chartName ?? 'none'}`}
                className={`grid cursor-pointer grid-cols-[minmax(72px,1fr)_auto] gap-2 border-b border-gray-800/70 px-3 py-2 text-xs last:border-b-0 hover:bg-gray-800/50 ${OUTCOME_STYLES[outcome].panelRow}`}
                role="button"
                tabIndex={0}
                onClick={() => onOpenHandHistory(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenHandHistory(item);
                  }
                }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-mono text-gray-300">{item.hand.handId}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${OUTCOME_STYLES[outcome].badge}`}>
                      {OUTCOME_STYLES[outcome].label}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-gray-500">
                    {item.hand.heroPosition} · {item.stackSize} · {item.chartName ?? item.exclusionReason ?? '-'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-200">{heroDecisionLabel(item.heroDecision)}</div>
                  <div className="mt-0.5 text-gray-500">{gtoActionLabel(item.gtoAction)} · {statusLabel(item)}</div>
                </div>
              </div>
            );
          })}
          {items.length > 12 && (
            <div className="px-3 py-2 text-xs text-gray-500">
              외 {items.length - 12}개 더 있음
            </div>
          )}
        </div>
      )}
      {pinnedHand && topMistakeHands.length > 0 && (
        <div className="border-t border-gray-800 px-3 py-3">
          <div className="mb-2 text-xs font-semibold text-gray-300">자주 틀린 핸드</div>
          <div className="flex flex-wrap gap-1.5">
            {topMistakeHands.map((summary) => {
              const isActive = summary.hand === pinnedHand;
              return (
                <button
                  key={summary.hand}
                  type="button"
                  onClick={() => onPinHand(summary.hand)}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? 'bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/40'
                      : 'bg-red-500/15 text-red-100 hover:bg-red-500/25'
                  }`}
                  title={`오버 폴드 ${summary.missedOpenCount} / 루즈 오픈 ${summary.extraOpenCount}`}
                >
                  <span>{summary.hand}</span>
                  <span className="text-red-200/80">{summary.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function HandHistoryModal({ item, onClose }: { item: CoinPokerComparisonItem; onClose: () => void }) {
  const parsedDetails = parseHandHistoryDisplay(item);
  const outcome = outcomeTone(item);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-6">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">
              Hand #{item.hand.handId}
            </div>
            <div className="mt-1 truncate text-xs text-gray-500">
              {formatCards(item)} · {item.hand.heroPosition} · {item.stackSize} · {statusLabel(item)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-700"
          >
            닫기
          </button>
        </div>
        <div className="max-h-[75vh] overflow-auto p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <InfoTile label="Hero" value={`${formatCards(item)} / ${item.hand.heroPosition}`} />
            <InfoTile label="Stack" value={formatStack(item)} />
            <InfoTile label="Chart" value={item.chartName ?? item.exclusionReason ?? '-'} />
            <InfoTile
              label="Result"
              value={statusLabel(item)}
              valueClassName={OUTCOME_STYLES[outcome].text}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
            <section className="rounded-md border border-gray-800 bg-gray-900/40">
              <div className="border-b border-gray-800 px-3 py-2 text-xs font-semibold text-gray-300">
                Preflop action
              </div>
              {item.hand.preflopActions.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-500">프리플랍 액션을 찾지 못했습니다.</div>
              ) : (
                <div className="divide-y divide-gray-800/70">
                  {item.hand.preflopActions.map((action, index) => {
                    const isHero = action.player === 'Hero';
                    return (
                      <div
                        key={`${action.player}-${index}-${action.line}`}
                        className={`grid grid-cols-[34px_64px_1fr] gap-2 px-3 py-2 text-xs ${
                          isHero ? 'bg-indigo-500/10' : ''
                        }`}
                      >
                        <div className="text-gray-500">#{index + 1}</div>
                        <div className={isHero ? 'font-semibold text-indigo-200' : 'text-gray-400'}>
                          {action.position ?? '-'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={isHero ? 'font-semibold text-white' : 'text-gray-200'}>{action.player}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${actionBadgeClass(action.action)}`}>
                              {actionLabel(action.action)}
                            </span>
                          </div>
                          <div className="mt-0.5 break-words font-mono text-[11px] text-gray-500">{action.line}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="space-y-3">
              <section className="rounded-md border border-gray-800 bg-gray-900/40">
                <div className="border-b border-gray-800 px-3 py-2 text-xs font-semibold text-gray-300">
                  Board
                </div>
                {parsedDetails.board.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-gray-500">보드 없음</div>
                ) : (
                  <div className="space-y-2 px-3 py-3">
                    {parsedDetails.board.map((street) => (
                      <div key={street.street} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-500">{street.street}</span>
                        <span className="font-mono text-gray-200">{street.cards.join(' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-md border border-gray-800 bg-gray-900/40">
                <div className="border-b border-gray-800 px-3 py-2 text-xs font-semibold text-gray-300">
                  Summary
                </div>
                {parsedDetails.summary.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-gray-500">요약 없음</div>
                ) : (
                  <div className="max-h-44 overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed text-gray-400">
                    {parsedDetails.summary.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>

          <details className="mt-4 rounded-md border border-gray-800 bg-gray-900/40">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-300">
              Raw hand history
            </summary>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-gray-800 p-3 font-mono text-xs leading-relaxed text-gray-300">
              {item.hand.rawText}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value, valueClassName = 'text-white' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-gray-500">{label}</div>
      <div className={`mt-1 truncate text-xs font-semibold ${valueClassName}`}>{value}</div>
    </div>
  );
}

function parseHandHistoryDisplay(item: CoinPokerComparisonItem): {
  board: Array<{ street: string; cards: string[] }>;
  summary: string[];
} {
  const lines = item.hand.rawText.split(/\r?\n/);
  const board = lines.flatMap((line) => {
    const match = line.match(/^\*\*\* (FLOP|TURN|RIVER) \*\*\* \[([^\]]*)\](?: \[([^\]]*)\])?/);
    if (!match) return [];
    const cards = `${match[2]} ${match[3] ?? ''}`.trim().split(/\s+/).filter(Boolean);
    return [{ street: match[1], cards }];
  });

  const summaryIndex = lines.findIndex((line) => line.trim() === '*** SUMMARY ***');
  const summary = summaryIndex === -1
    ? []
    : lines.slice(summaryIndex + 1)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 12);

  return { board, summary };
}

function actionLabel(action: string): string {
  if (action === 'folds') return 'Fold';
  if (action === 'calls') return 'Call';
  if (action === 'checks') return 'Check';
  if (action === 'raises') return 'Raise';
  if (action === 'bets') return 'Bet';
  if (action === 'ALLIN') return 'All-in';
  return action;
}

function actionBadgeClass(action: string): string {
  if (action === 'folds') return 'bg-gray-700/70 text-gray-300';
  if (action === 'calls' || action === 'checks') return 'bg-emerald-500/15 text-emerald-200';
  if (action === 'raises' || action === 'bets') return 'bg-red-500/15 text-red-200';
  if (action === 'ALLIN') return 'bg-purple-500/20 text-purple-200';
  return 'bg-gray-700/70 text-gray-300';
}

function heroDecisionLabel(decision: CoinPokerComparisonItem['heroDecision']): string {
  if (decision === 'open') return '오픈';
  if (decision === 'fold') return '폴드';
  if (decision === 'passive') return '콜/체크';
  return '-';
}

function gtoActionLabel(action: CoinPokerComparisonItem['gtoAction']): string {
  if (action === 'open') return '오픈';
  if (action === 'fold') return '폴드';
  return '-';
}

function formatCards(item: CoinPokerComparisonItem): string {
  const rawCards = item.hand.heroCards.length > 0 ? item.hand.heroCards.join(' ') : '-';
  return item.hand.heroHand ? `${item.hand.heroHand} (${rawCards})` : rawCards;
}

function formatStack(item: CoinPokerComparisonItem): string {
  if (item.hand.heroStackBb === null) return item.stackSize;
  return `${item.hand.heroStackBb.toFixed(2)}BB -> ${item.stackSize}`;
}
