import { useEffect, useMemo, useState } from 'react';
import { CashRangeGrid } from '../components/CashRangeGrid';
import {
  findCashScenario,
  getAvailableCashOpeners,
  getAvailableCashPositions,
  getAvailableCashSituations,
  getCashActionColor,
  getCashActionLabel,
  getCashActions,
  getPrimaryCashActions,
  normalizeCashHand,
  parseCashRangeData,
  type CashPosition,
  type CashRangeData,
  type CashSituation,
} from '../utils/cashRange';

const SITUATION_LABELS: Record<CashSituation, string> = {
  unopened: '오픈 없음',
  opened: '오픈 있음',
  'sb-limp': 'SB 림프',
  'sb-raise': 'SB 레이즈',
  'bb-raise-after-limp': 'SB 림프 후 BB 레이즈',
};

const controlClass = 'rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white';

export function CashHandRangePage() {
  const [data, setData] = useState<CashRangeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hero, setHero] = useState<CashPosition>('UTG');
  const [situation, setSituation] = useState<CashSituation>('unopened');
  const [opener, setOpener] = useState<CashPosition>();
  const [handInput, setHandInput] = useState('');
  const [showChart, setShowChart] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}gto-cache-preflop-chart.json`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(value => {
        const parsed = parseCashRangeData(value);
        const initialHero = getAvailableCashPositions(parsed)[0];
        const initialSituation = initialHero && getAvailableCashSituations(parsed, initialHero)[0];
        if (!initialHero || !initialSituation) throw new Error('사용 가능한 캐시 시나리오가 없습니다.');
        setData(parsed);
        setHero(initialHero);
        setSituation(initialSituation);
        setOpener(initialSituation === 'opened' ? getAvailableCashOpeners(parsed, initialHero)[0] : undefined);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      });
    return () => controller.abort();
  }, []);

  const positions = useMemo(() => data ? getAvailableCashPositions(data) : [], [data]);
  const situations = useMemo(() => data ? getAvailableCashSituations(data, hero) : [], [data, hero]);
  const openers = useMemo(() => data ? getAvailableCashOpeners(data, hero) : [], [data, hero]);
  const scenario = useMemo(
    () => data ? findCashScenario(data, hero, situation, opener) : null,
    [data, hero, situation, opener],
  );
  const hand = normalizeCashHand(handInput);
  const frequencies = hand && scenario ? scenario.hands[hand] : undefined;
  const actions = frequencies ? getCashActions(frequencies) : [];
  const primaryActions = getPrimaryCashActions(actions);

  function changeHero(nextHero: CashPosition) {
    if (!data) return;
    const nextSituations = getAvailableCashSituations(data, nextHero);
    const nextSituation = nextSituations[0];
    setHero(nextHero);
    setSituation(nextSituation);
    setOpener(nextSituation === 'opened' ? getAvailableCashOpeners(data, nextHero)[0] : undefined);
  }

  function changeSituation(nextSituation: CashSituation) {
    setSituation(nextSituation);
    setOpener(nextSituation === 'opened' ? openers[0] : undefined);
  }

  if (error) {
    return <div className="py-16 text-center text-red-400">캐시 데이터 로드 실패: {error}</div>;
  }
  if (!data) {
    return <div className="py-16 text-center text-gray-400">캐시 데이터 로딩 중...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="w-full rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            내 포지션
            <select className={controlClass} value={hero} onChange={event => changeHero(event.target.value as CashPosition)}>
              {positions.map(position => <option key={position}>{position}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-gray-400">
            앞선 액션
            <select className={controlClass} value={situation} onChange={event => changeSituation(event.target.value as CashSituation)}>
              {situations.map(value => <option key={value} value={value}>{SITUATION_LABELS[value]}</option>)}
            </select>
          </label>

          {situation === 'opened' && (
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              오픈 포지션
              <select className={controlClass} value={opener ?? ''} onChange={event => setOpener(event.target.value as CashPosition)}>
                {openers.map(position => <option key={position}>{position}</option>)}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-xs text-gray-400">
            내 핸드
            <input
              className={controlClass}
              value={handInput}
              onChange={event => setHandInput(event.target.value)}
              placeholder="예: AKs, QJo, TT"
              autoCapitalize="characters"
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={showChart} onChange={event => setShowChart(event.target.checked)} />
          차트 표시
        </label>

        {handInput.trim() && !hand && (
          <p className="mt-2 text-sm text-amber-400">AA, AKs, AKo 형식으로 입력하세요.</p>
        )}
      </div>

      {!scenario ? (
        <p className="text-gray-400">선택한 상황의 차트가 없습니다.</p>
      ) : showChart ? (
        <>
          <div className="max-w-full overflow-x-auto pb-2">
            <CashRangeGrid scenario={scenario} highlightedHand={hand} />
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-300">
            {scenario.availableActions.map(action => (
              <span key={action} className="flex items-center gap-1.5">
                <i className="h-3 w-3 rounded-sm" style={{ backgroundColor: getCashActionColor(action) }} />
                {getCashActionLabel(action)}
              </span>
            ))}
          </div>
        </>
      ) : hand ? (
        <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <h2 className="mb-4 text-center text-xl font-bold text-white">{hand}</h2>
          {frequencies && actions.length > 0 ? (
            <div className="space-y-2">
              {actions.map(({ action, frequency }) => {
                const primary = primaryActions.some(item => item.action === action);
                return (
                  <div key={action} className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
                    <span className="flex items-center gap-2 text-gray-200">
                      <i className="h-3 w-3 rounded-sm" style={{ backgroundColor: getCashActionColor(action) }} />
                      {getCashActionLabel(action)}
                      {primary && <b className="text-xs text-amber-400">주 액션</b>}
                    </span>
                    <strong className="text-white">{frequency}%</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-amber-400">데이터 없음</p>
          )}
        </div>
      ) : (
        <p className="text-gray-400">핸드를 입력하면 액션별 빈도를 보여드립니다.</p>
      )}
    </div>
  );
}
