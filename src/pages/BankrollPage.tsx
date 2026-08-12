import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  dedupeSessions,
  computeTrend,
  computeTagPerformance,
  computeTournamentMetrics,
  filterByDateRange,
  dateBounds,
  summarize,
  formatUsd,
  isTicketValue,
  recalculateSessionProfit,
  hasMissingTicketPrice,
  extractTicketCandidates,
  findTicketPrize,
  type BankrollSession,
  type RawTournament,
  type TicketCandidate,
} from '../utils/bankroll';
import { fetchUsdKrwRate } from '../utils/fxRate';
import { BankrollTrendChart } from '../components/BankrollTrendChart';
import { TagPerformanceChart } from '../components/TagPerformanceChart';
import { useBankrollStore } from './bankroll/useBankrollStore';

export function BankrollPage() {
  const {
    sessions,
    setSessions,
    loading,
    syncing,
    setSyncing,
    parseBankrollFile,
    clearBankroll,
    pushBankrollSessions,
    replaceBankrollSessions,
    flattenBankrollStore,
  } = useBankrollStore();
  const [rate, setRate] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ticketCandidatesRef = useRef<TicketCandidate[]>([]);

  useEffect(() => {
    fetchUsdKrwRate().then(setRate).catch(() => {});
  }, []);

  const bounds = useMemo(() => dateBounds(sessions), [sessions]);
  const filtered = useMemo(
    () => filterByDateRange(sessions, from, to),
    [sessions, from, to],
  );
  const trend = useMemo(() => computeTrend(filtered), [filtered]);
  const tags = useMemo(() => computeTagPerformance(filtered), [filtered]);
  const mtt = useMemo(() => computeTournamentMetrics(filtered), [filtered]);
  const sum = useMemo(() => summarize(filtered), [filtered]);
  const listedSessions = useMemo(
    () => [...filtered].sort((a, b) => b.datetime.localeCompare(a.datetime)),
    [filtered],
  );

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setFileError(null);
    setSyncing(true);
    const added: BankrollSession[] = [];
    const errors: string[] = [];
    const parsedFiles: Array<{ name: string; parsed: unknown }> = [];
    for (const f of files) {
      try {
        parsedFiles.push({ name: f.name, parsed: JSON.parse(await f.text()) });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'JSON 파싱 실패';
        errors.push(`${f.name}: ${message}`);
      }
    }

    const importedTicketCandidates = mergeTicketCandidates(
      ticketCandidatesRef.current,
      parsedFiles.flatMap(({ parsed }) => extractTicketCandidates(parsed)),
    );
    ticketCandidatesRef.current = importedTicketCandidates;
    const editingSession = sessions.find(
      (session) => session.id === editingId && session.isTicket,
    );
    const importedEditingTicketPrice = editingSession
      ? findTicketPrize(
          editingSession.id,
          editingSession.name ?? '',
          importedTicketCandidates,
        )
      : null;
    const ticketUpdates = sessions.flatMap((session) => {
      if (!session.isTicket) return [];
      const ticketPrice = findTicketPrize(
        session.id,
        session.name ?? '',
        importedTicketCandidates,
      );
      if (ticketPrice === null || ticketPrice === session.ticketPrice) return [];
      return [recalculateSessionProfit({ ...session, ticketPrice })];
    });
    for (const { name, parsed } of parsedFiles) {
      try {
        if (isTicketExport(parsed)) continue;
        const manualTicketPrices = collectTicketPrices(
          parsed,
          importedTicketCandidates,
        );
        const got = parseBankrollFile(parsed, {
          ticketCandidates: importedTicketCandidates,
          ticketPrices: manualTicketPrices,
        });
        if (got.length === 0) errors.push(`${name}: 인식 가능한 항목 없음`);
        added.push(...got);
      } catch (err) {
        const message = err instanceof Error ? err.message : '처리 실패';
        errors.push(`${name}: ${message}`);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
    if (errors.length) setFileError(errors.join(' / '));
    const updates = dedupeSessions([...ticketUpdates, ...added]);
    const editingUpdate = updates.find(
      (session) => session.id === editingId && session.isTicket,
    );
    const editingTicketPrice = importedEditingTicketPrice ?? editingUpdate?.ticketPrice;
    if (editingTicketPrice !== undefined && editingTicketPrice !== null) {
      setDraft((current) => current
        ? { ...current, ticketPrice: String(editingTicketPrice) }
        : current);
    }
    if (updates.length === 0) {
      setSyncing(false);
      return;
    }

    // Optimistic local merge for instant feedback.
    setSessions((prev) => dedupeSessions([...prev, ...updates]));
    // Persist to Vercel Blob; adopt the server-merged union (dedupe by id).
    try {
      const store = await pushBankrollSessions(updates);
      setSessions(flattenBankrollStore(store));
    } catch {
      /* offline / no /api — keep the optimistic local state */
    } finally {
      setSyncing(false);
    }
  }

  async function onClearAll() {
    if (!confirm('저장된 모든 뱅크롤 데이터를 삭제할까요?')) return;
    setSessions([]);
    ticketCandidatesRef.current = [];
    setFrom('');
    setTo('');
    setSyncing(true);
    try {
      await clearBankroll('all');
    } catch {
      /* offline / no /api — local state already cleared */
    } finally {
      setSyncing(false);
    }
  }

  function startEdit(session: BankrollSession) {
    setEditingId(session.id);
    setDraft(sessionToDraft(session));
    setFileError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit(original: BankrollSession) {
    if (!draft) return;
    const parsed = draftToSession(original, draft);
    if (!parsed.ok) {
      setFileError(parsed.error);
      return;
    }

    const updated = recalculateSessionProfit(parsed.session);
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingId(null);
    setDraft(null);
    setSyncing(true);
    try {
      const store = await pushBankrollSessions([updated]);
      setSessions(flattenBankrollStore(store));
    } catch {
      /* offline / no /api — keep the optimistic local state */
    } finally {
      setSyncing(false);
    }
  }

  async function deleteSession(session: BankrollSession) {
    if (!confirm(`이 기록을 삭제할까요?\n${session.name || session.id}`)) return;
    const remaining = sessions.filter((s) => s.id !== session.id);
    const remainingKind = remaining.filter((s) => s.kind === session.kind);
    setSessions(remaining);
    if (editingId === session.id) cancelEdit();
    setSyncing(true);
    try {
      const store = await replaceBankrollSessions(session.kind, remainingKind);
      setSessions(flattenBankrollStore(store));
    } catch {
      /* offline / no /api — keep the optimistic local state */
    } finally {
      setSyncing(false);
    }
  }

  const hasData = sessions.length > 0;

  if (loading) {
    return (
      <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-4 rounded-xl border border-gray-800 bg-gray-950/30 p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
        <div className="text-sm font-medium text-gray-200">저장된 뱅크롤 불러오는 중...</div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* import + chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={syncing}
          className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          JSON 추가
        </button>
        <input ref={inputRef} type="file" accept=".json,application/json" multiple
          onChange={onFiles} className="hidden" />
        {hasData && (
          <button
            onClick={onClearAll}
            disabled={syncing}
            className="px-3 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            전체 삭제
          </button>
        )}
        {syncing && <span className="text-xs text-indigo-300">동기화 중…</span>}
        {hasData && (
          <>
            <span className="px-3 py-1.5 text-xs bg-gray-800 text-gray-200 rounded-lg border border-gray-700">
              Bankroll: {formatUsd(sum.totalProfit)}
            </span>
            {rate !== null && (
              <span className="px-3 py-1.5 text-xs bg-gray-800 text-gray-200 rounded-lg border border-gray-700">
                USD/KRW: {rate.toLocaleString('en-US', { maximumFractionDigits: 1 })}
              </span>
            )}
            <span className="px-3 py-1.5 text-xs bg-gray-800 text-gray-200 rounded-lg border border-gray-700">
              Sessions: {sum.sessionCount}
            </span>
          </>
        )}
      </div>

      {/* date range filter */}
      {hasData && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
          <span className="text-gray-500">기간</span>
          <input
            type="date"
            value={from}
            min={bounds?.min}
            max={to || bounds?.max}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-200 [color-scheme:dark]"
          />
          <span className="text-gray-500">~</span>
          <input
            type="date"
            value={to}
            min={from || bounds?.min}
            max={bounds?.max}
            onChange={(e) => setTo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-200 [color-scheme:dark]"
          />
          {(from || to) && (
            <button
              onClick={() => { setFrom(''); setTo(''); }}
              className="px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
            >
              초기화
            </button>
          )}
          {(from || to) && (
            <span className="text-gray-500">
              {filtered.length} / {sessions.length} 세션
            </span>
          )}
        </div>
      )}

      {fileError && <p className="text-sm text-red-400">{fileError}</p>}

      {!hasData && (
        <div className="text-center text-gray-500 text-sm py-16 border border-dashed border-gray-700 rounded-xl">
          캐시/토너먼트 history JSON 파일을 추가하세요. (여러 파일 선택 가능)
        </div>
      )}

      {hasData && (
        <>
          <h2 className="text-lg font-bold text-white">Analytics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card label="TOTAL PROFIT" value={formatUsd(sum.totalProfit)} />
            <Card label="CASH" value={formatUsd(sum.cashProfit)} />
            <Card label="TOURNAMENTS" value={formatUsd(sum.tournamentProfit)} />
          </div>

          <Section title="Trend line" right={`${trend.length} points`}>
            <BankrollTrendChart points={trend} />
          </Section>

          <Section title="MTT Metrics" right={`${mtt.games} games`}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              <Card label="ROI" value={formatPercent(mtt.roi)} />
              <Card label="ABI" value={mtt.abi === null ? '-' : formatUsd(mtt.abi)} />
              <Card label="MTT GAMES" value={String(mtt.games)} />
              <Card label="ITM" value={formatPercent(mtt.itmRate)} />
              <Card label="FINAL TABLE" value={formatPercent(mtt.finalTableRate)} />
              <Card label="TOP 3" value={formatPercent(mtt.top3Rate)} />
            </div>
          </Section>

          <Section title="Tag performance" right={`${tags.length} tags`}>
            <TagPerformanceChart rows={tags} />
            <div className="mt-3 divide-y divide-gray-800">
              {tags.map((t) => (
                <div key={t.tag} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-semibold text-white">{t.tag}</span>
                  <span className="text-gray-400">{t.sessions} sessions</span>
                  <span className={t.profit >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {formatUsd(t.profit)}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Records" right={`${listedSessions.length} / ${sessions.length} sessions`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-gray-500">
                  <tr className="border-b border-gray-800">
                    <th className="whitespace-nowrap px-2 py-2 font-semibold">Date</th>
                    <th className="whitespace-nowrap px-2 py-2 font-semibold">Type</th>
                    <th className="min-w-52 px-2 py-2 font-semibold">Name</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Win/Loss</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Cost</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Entries</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Rank</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Profit</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {listedSessions.map((session) => {
                    const isEditing = editingId === session.id && draft;
                    const missingTicketPrice = hasMissingTicketPrice(session);
                    const editingMissingTicketPrice = Boolean(isEditing && session.isTicket && draft.ticketPrice.trim() === '');
                    return (
                      <tr
                        key={`${session.kind}-${session.id}`}
                        className={`text-gray-300 ${missingTicketPrice ? 'bg-red-950/25' : ''}`}
                      >
                        <td className="whitespace-nowrap px-2 py-2 align-top">
                          {isEditing ? (
                            <input
                              type="datetime-local"
                              value={draft.datetime}
                              onChange={(e) => setDraft({ ...draft, datetime: e.target.value })}
                              className="w-44 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-gray-200 [color-scheme:dark]"
                            />
                          ) : (
                            session.datetime
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 align-top">
                          <span className={`rounded px-2 py-1 text-[11px] uppercase ${missingTicketPrice ? 'bg-red-900/70 text-red-100 ring-1 ring-red-500/70' : 'bg-gray-800 text-gray-300'}`}>
                            {session.isTicket ? 'ticket prize' : session.kind}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top">
                          {isEditing ? (
                            <input
                              value={draft.name}
                              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                              className="w-full min-w-52 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-gray-200"
                            />
                          ) : (
                            <div className="max-w-80 truncate text-gray-200" title={session.name || session.id}>
                              {session.name || session.id}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                          {isEditing ? (
                            <NumberInput value={draft.winLoss} onChange={(value) => setDraft({ ...draft, winLoss: value })} />
                          ) : (
                            formatUsd(session.winLoss)
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                          {session.kind === 'tournament' ? (
                            isEditing ? (
                              <div className="flex flex-col items-end gap-1">
                                {session.isTicket ? (
                                  <>
                                    <label className="flex items-center justify-end gap-2">
                                      <span className="text-[11px] text-gray-500">Cost</span>
                                      <NumberInput
                                        value={draft.buyIn}
                                        onChange={(value) => setDraft({ ...draft, buyIn: value })}
                                        min={0}
                                      />
                                    </label>
                                    <label className="flex items-center justify-end gap-2">
                                      <span className="text-[11px] text-gray-500">Ticket</span>
                                      <NumberInput
                                        value={draft.ticketPrice}
                                        onChange={(value) => setDraft({ ...draft, ticketPrice: value })}
                                        min={0}
                                        invalid={editingMissingTicketPrice}
                                      />
                                    </label>
                                  </>
                                ) : (
                                  <NumberInput
                                    value={draft.buyIn}
                                    onChange={(value) => setDraft({ ...draft, buyIn: value })}
                                    min={0}
                                  />
                                )}
                                {editingMissingTicketPrice && <span className="text-[11px] font-semibold text-red-300">티켓 가격 필요</span>}
                              </div>
                            ) : (
                              <span className={missingTicketPrice ? 'font-semibold text-red-300' : undefined}>
                                {missingTicketPrice ? '티켓 가격 필요' : session.isTicket ? (
                                  <span className="flex flex-col items-end gap-0.5">
                                    <span>Cost {formatUsd(session.buyIn ?? 0)}</span>
                                    <span className="text-green-300">Ticket +{formatUsd(session.ticketPrice ?? 0)}</span>
                                  </span>
                                ) : formatUsd(session.buyIn ?? 0)}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                          {session.kind === 'tournament' ? (
                            isEditing ? (
                              <NumberInput value={draft.entries} onChange={(value) => setDraft({ ...draft, entries: value })} integer min={1} />
                            ) : (
                              session.entries ?? 1
                            )
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                          {session.kind === 'tournament' ? (
                            isEditing ? (
                              <NumberInput value={draft.rank} onChange={(value) => setDraft({ ...draft, rank: value })} integer allowBlank min={1} />
                            ) : (
                              session.rank ?? '-'
                            )
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className={`whitespace-nowrap px-2 py-2 text-right align-top font-semibold ${session.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatUsd(session.profit)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => saveEdit(session)} disabled={syncing} className="rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-500 disabled:opacity-50">
                                저장
                              </button>
                              <button onClick={cancelEdit} disabled={syncing} className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-gray-300 hover:text-white disabled:opacity-50">
                                취소
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => startEdit(session)} disabled={syncing} className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-gray-300 hover:text-white disabled:opacity-50">
                                수정
                              </button>
                              <button onClick={() => deleteSession(session)} disabled={syncing} className="rounded border border-red-900/70 bg-red-950/40 px-2 py-1 text-red-300 hover:text-red-200 disabled:opacity-50">
                                삭제
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function collectTicketPrices(
  parsed: unknown,
  ticketCandidates: TicketCandidate[] = [],
): Record<string, number> {
  if (!Array.isArray(parsed) || parsed.length === 0) return {};
  const first = parsed[0] as Record<string, unknown>;
  if (!first || !('tournament_id' in first)) return {};

  const ticketRows = new Map<string, RawTournament>();
  for (const row of parsed as RawTournament[]) {
    if (
      typeof row?.tournament_id === 'string' &&
      row.tournament_id.length > 0 &&
      isTicketValue(row.is_ticket) &&
      findTicketPrize(row.tournament_id, row.tournament_name, ticketCandidates) === null &&
      !ticketRows.has(row.tournament_id)
    ) {
      ticketRows.set(row.tournament_id, row);
    }
  }
  if (ticketRows.size === 0) return {};

  const prices: Record<string, number> = {};
  for (const [id, row] of ticketRows) {
    const label = row.tournament_name || id;
    const promptText = `${label}\n티켓으로 상금을 받은 토너먼트입니다. 획득한 티켓 가격(USD)을 입력하세요. 비워두면 기록만 저장되고 강조 표시됩니다.`;
    const input = window.prompt(promptText, '');
    if (input === null || input.trim() === '') continue;
    const parsedPrice = Number.parseFloat(input.replace(/,/g, '').trim());
    if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
      prices[id] = parsedPrice;
    } else {
      window.alert('0 이상의 숫자로 입력해주세요. 이 기록은 티켓 가격 없이 저장됩니다.');
    }
  }

  return prices;
}

function mergeTicketCandidates(
  existing: TicketCandidate[],
  imported: TicketCandidate[],
): TicketCandidate[] {
  const byTournamentId = new Map<string, TicketCandidate>();
  for (const candidate of [...existing, ...imported]) {
    byTournamentId.set(candidate.tourneyId, candidate);
  }
  return [...byTournamentId.values()];
}

function isTicketExport(parsed: unknown): boolean {
  if (!Array.isArray(parsed) || parsed.length === 0) return false;
  return parsed.some((row) => {
    const candidate = row as Record<string, unknown>;
    return (
      candidate &&
      'ticketAmount' in candidate &&
      (
        'selectedEligibleTournamentId' in candidate ||
        'eligibleTournaments' in candidate ||
        'ticketList' in candidate
      )
    );
  });
}

interface SessionDraft {
  datetime: string;
  name: string;
  winLoss: string;
  buyIn: string;
  ticketPrice: string;
  entries: string;
  rank: string;
}

function sessionToDraft(session: BankrollSession): SessionDraft {
  return {
    datetime: toDateTimeInput(session.datetime),
    name: session.name ?? '',
    winLoss: String(session.winLoss),
    buyIn: String(session.buyIn ?? 0),
    ticketPrice: session.isTicket ? String(session.ticketPrice ?? '') : '',
    entries: String(session.entries ?? 1),
    rank: session.rank === undefined ? '' : String(session.rank),
  };
}

function draftToSession(
  original: BankrollSession,
  draft: SessionDraft,
): { ok: true; session: BankrollSession } | { ok: false; error: string } {
  const winLoss = parseDraftNumber(draft.winLoss);
  if (winLoss === null) return { ok: false, error: 'Win/Loss는 숫자로 입력해주세요.' };

  const datetime = fromDateTimeInput(draft.datetime);
  if (!datetime) return { ok: false, error: '날짜를 입력해주세요.' };

  if (original.kind === 'cash') {
    return {
      ok: true,
      session: {
        ...original,
        datetime,
        name: draft.name.trim() || original.name,
        winLoss,
      },
    };
  }

  const buyIn = parseDraftNumber(draft.buyIn);
  const ticketPrice = parseDraftNumber(draft.ticketPrice);
  const entries = parseDraftInteger(draft.entries);
  const rank = draft.rank.trim() === '' ? undefined : parseDraftInteger(draft.rank);
  if (buyIn === null || buyIn < 0) return { ok: false, error: 'Cost는 0 이상의 숫자로 입력해주세요.' };
  if (ticketPrice !== null && ticketPrice < 0) return { ok: false, error: 'Cost는 0 이상의 숫자로 입력해주세요.' };
  if (entries === null || entries < 1) return { ok: false, error: 'Entries는 1 이상의 정수로 입력해주세요.' };
  if (rank === null || (rank !== undefined && rank < 1)) return { ok: false, error: 'Rank는 비워두거나 1 이상의 정수로 입력해주세요.' };
  const resolvedTicketPrice = original.isTicket ? (ticketPrice ?? undefined) : original.ticketPrice;

  return {
    ok: true,
    session: {
      ...original,
      datetime,
      name: draft.name.trim() || original.name,
      winLoss,
      buyIn,
      ticketPrice: resolvedTicketPrice,
      entries,
      rank,
    },
  };
}

function parseDraftNumber(value: string): number | null {
  const n = Number.parseFloat(value.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function parseDraftInteger(value: string): number | null {
  const n = Number.parseInt(value.replace(/,/g, '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function toDateTimeInput(datetime: string): string {
  return datetime.includes(' ') ? datetime.replace(' ', 'T').slice(0, 16) : datetime.slice(0, 16);
}

function fromDateTimeInput(datetime: string): string {
  const trimmed = datetime.trim();
  if (!trimmed) return '';
  return trimmed.includes('T') ? `${trimmed.replace('T', ' ')}:00`.slice(0, 19) : trimmed;
}

function NumberInput({
  value,
  onChange,
  integer = false,
  allowBlank = false,
  min,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  integer?: boolean;
  allowBlank?: boolean;
  min?: number;
  invalid?: boolean;
}) {
  return (
    <input
      type="number"
      step={integer ? 1 : 0.01}
      min={allowBlank && value === '' ? undefined : min}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-24 rounded border bg-gray-950 px-2 py-1 text-right text-gray-200 ${invalid ? 'border-red-500 ring-1 ring-red-500/60' : 'border-gray-700'}`}
    />
  );
}

function formatPercent(value: number | null): string {
  return value === null ? '-' : `${(value * 100).toFixed(1)}%`;
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-[11px] font-semibold text-gray-500 tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: string; children: ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {right && <span className="text-xs text-gray-500">{right}</span>}
      </div>
      {children}
    </div>
  );
}
