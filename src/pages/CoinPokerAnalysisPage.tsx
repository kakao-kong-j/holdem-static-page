import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { RangeGrid } from '../components/RangeGrid';
import {
  COINPOKER_COMPARE_COLORS,
  buildCoinPokerGrid,
  compareCoinPokerRfi,
  summarizeCoinPokerComparison,
  type CoinPokerComparisonItem,
} from '../utils/coinpokerCompare';
import { parseCoinPokerHands } from '../utils/coinpokerParser';
import type { StackData, StackSize } from '../types';

interface Props {
  stack: StackSize;
  stackData: StackData;
}

const TABLE_LIMIT = 250;

export function CoinPokerAnalysisPage({ stack, stackData }: Props) {
  const [rawText, setRawText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputVersionRef = useRef(0);

  const parsedHands = useMemo(() => parseCoinPokerHands(rawText), [rawText]);
  const comparison = useMemo(() => compareCoinPokerRfi(parsedHands, stackData), [parsedHands, stackData]);
  const summary = useMemo(() => summarizeCoinPokerComparison(comparison), [comparison]);
  const comparisonGrid = useMemo(() => buildCoinPokerGrid(comparison), [comparison]);
  const tableRows = useMemo(() => comparison.slice(0, TABLE_LIMIT), [comparison]);

  const isEmpty = rawText.trim().length === 0;
  const hasUnparsedText = !isEmpty && parsedHands.length === 0;

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const version = inputVersionRef.current + 1;
    inputVersionRef.current = version;
    setFileError(null);

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      if (inputVersionRef.current === version) {
        setRawText(text);
      }
    } catch {
      if (inputVersionRef.current === version) {
        setFileError('파일을 읽지 못했습니다. 다시 선택해 주세요.');
      }
    }
  };

  const handleClear = () => {
    inputVersionRef.current += 1;
    setRawText('');
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleManualEdit = (event: ChangeEvent<HTMLTextAreaElement>) => {
    inputVersionRef.current += 1;
    setRawText(event.target.value);
    setFileError(null);
  };

  const summaryItems = [
    { label: 'Hero 핸드', value: summary.parsedHands, tone: 'text-white' },
    { label: '비교 가능', value: summary.comparableHands, tone: 'text-sky-300' },
    { label: '일치 오픈', value: summary.matches, tone: 'text-emerald-300' },
    { label: '누락 오픈', value: summary.missedOpens, tone: 'text-amber-300' },
    { label: '과잉 오픈', value: summary.extraOpens, tone: 'text-red-300' },
    { label: '제외', value: summary.excluded, tone: 'text-gray-400' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 border border-gray-800 bg-gray-950/30 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">CoinPoker RFI 분석</h2>
              <p className="mt-1 text-xs text-gray-500">
                {stack} 차트 기준으로 Hero 프리플랍 로그를 비교합니다
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                onChange={handleFileSelect}
                className="block w-full max-w-full text-xs text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 sm:w-64"
              />
              <button
                type="button"
                onClick={handleClear}
                className="rounded bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isEmpty}
              >
                Clear
              </button>
            </div>
          </div>

          {fileError && (
            <div className="rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              {fileError}
            </div>
          )}

          <textarea
            value={rawText}
            onChange={handleManualEdit}
            spellCheck={false}
            placeholder="CoinPoker hand history 텍스트를 붙여넣으세요"
            className="min-h-44 w-full resize-y rounded-md border border-gray-800 bg-gray-900/70 p-3 font-mono text-xs leading-relaxed text-gray-200 outline-none placeholder:text-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {isEmpty ? (
          <div className="rounded-lg border border-dashed border-gray-800 bg-gray-950/30 px-4 py-8 text-center text-sm text-gray-500">
            txt 파일을 선택하거나 로그를 붙여넣으면 분석이 시작됩니다.
          </div>
        ) : (
          <>
            {hasUnparsedText && (
              <div className="rounded-md border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                Dealt to Hero [...] entries were not found. CoinPoker 핸드 히스토리 형식을 확인해 주세요.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {summaryItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                  <div className="text-[11px] font-medium text-gray-500">{item.label}</div>
                  <div className={`mt-1 text-xl font-bold leading-tight ${item.tone}`}>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-gray-800 bg-gray-950/20 p-3">
                <div className="min-w-max text-center">
                  <RangeGrid handAction={comparisonGrid} colorMap={COINPOKER_COMPARE_COLORS} />
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-gray-400">
                  {Object.entries(COINPOKER_COMPARE_COLORS).map(([status, color]) => (
                    <span key={status} className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color.bg }} />
                      {color.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-gray-800 bg-gray-950/20">
                <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-3 py-2">
                  <h3 className="text-sm font-semibold text-gray-200">비교 결과</h3>
                  <span className="text-xs text-gray-500">
                    {tableRows.length}
                    {comparison.length > TABLE_LIMIT ? ` / ${comparison.length}` : ''} hands
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-left text-xs">
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
                        tableRows.map((item) => (
                          <tr key={item.hand.handId} className="text-gray-300 hover:bg-gray-900/50">
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
                            <td className="whitespace-nowrap px-3 py-2 text-gray-400">{formatStack(item, stack)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function statusLabel(item: CoinPokerComparisonItem): string {
  if (item.status === 'match-open') return '일치: 오픈';
  if (item.status === 'match-fold') return '일치: 폴드';
  if (item.status === 'missed-open') return '누락 오픈';
  if (item.status === 'extra-open') return '과잉 오픈';
  return item.exclusionReason ?? '제외';
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

function formatStack(item: CoinPokerComparisonItem, fallbackStack: StackSize): string {
  if (item.hand.heroStackBb === null) return fallbackStack;
  return `${item.hand.heroStackBb.toFixed(2)}BB`;
}
