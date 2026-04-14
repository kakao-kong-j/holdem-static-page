import { useCallback, useEffect, useMemo, useState } from 'react';
import { ACTION_COLORS, POSITION_COLORS, STACK_SIZES } from '../constants';
import { RangeGrid } from '../components/RangeGrid';
import { Legend } from '../components/Legend';
import { buildActionStats, buildHandAction, forEachHand } from '../utils/hand';
import { actionLabel, loadQuizRecords, saveQuizRecord } from '../utils/quiz';
import {
  USER_COLOR_MAP,
  buildUserHandAction,
  filterRecordsForSpot,
  getAnsweredHands,
  getSpotOptions,
  groupSpotsByCategory,
  resetSpotRecords,
  type SpotOption,
} from '../utils/chartQuiz';
import type { AllData, QuizQuestion, QuizRecord, StackSize } from '../types';

type Phase = 'settings' | 'question' | 'result';

interface Props {
  data: AllData;
}

const TOTAL_HANDS = 169;

const ALL_HANDS: string[] = [];
forEachHand(hand => ALL_HANDS.push(hand));

function pickUnansweredHand(answered: Set<string>): string | null {
  const remaining = ALL_HANDS.filter(h => !answered.has(h));
  if (remaining.length === 0) return null;
  return remaining[Math.floor(Math.random() * remaining.length)];
}

export function ChartQuizPage({ data }: Props) {
  const [phase, setPhase] = useState<Phase>('settings');
  const [stack, setStack] = useState<StackSize>('100BB');
  const [chartName, setChartName] = useState<string>('');
  const [records, setRecords] = useState<QuizRecord[]>(() => loadQuizRecords());
  const [currentHand, setCurrentHand] = useState<string | null>(null);

  const spotOptions = useMemo<SpotOption[]>(
    () => (data[stack] ? getSpotOptions(data[stack]) : []),
    [data, stack],
  );

  const groupedSpots = useMemo(() => groupSpotsByCategory(spotOptions), [spotOptions]);

  // When the stack changes, reset the selected chart to the first available.
  useEffect(() => {
    if (spotOptions.length === 0) {
      setChartName('');
      return;
    }
    if (!spotOptions.some(s => s.chartName === chartName)) {
      setChartName(spotOptions[0].chartName);
    }
  }, [spotOptions, chartName]);

  const spot = useMemo(
    () => spotOptions.find(s => s.chartName === chartName) ?? null,
    [spotOptions, chartName],
  );
  const chartData = spot ? data[stack]?.[spot.chartName] ?? null : null;

  const correctHandAction = useMemo(
    () => (chartData ? buildHandAction(chartData) : {}),
    [chartData],
  );

  const choices = useMemo(() => {
    if (!chartData) return [];
    const actions = Object.keys(chartData);
    if (!actions.includes('fold')) actions.push('fold');
    return actions;
  }, [chartData]);

  const spotRecords = useMemo(
    () => (spot ? filterRecordsForSpot(records, stack, spot.chartName) : []),
    [records, stack, spot],
  );

  const answeredHands = useMemo(() => getAnsweredHands(spotRecords), [spotRecords]);
  const answeredCount = answeredHands.size;

  const userHandAction = useMemo(
    () => buildUserHandAction(spotRecords),
    [spotRecords],
  );

  // Start the quiz: pick the first unanswered hand.
  const startQuiz = useCallback(() => {
    if (!spot || !chartData) return;
    const hand = pickUnansweredHand(answeredHands);
    if (!hand) {
      setPhase('result');
      return;
    }
    setCurrentHand(hand);
    setPhase('question');
  }, [spot, chartData, answeredHands]);

  const handleAnswer = useCallback(
    (action: string) => {
      if (!spot || !chartData || !currentHand) return;
      const correctAction = correctHandAction[currentHand] ?? 'fold';
      const question: QuizQuestion = {
        stackSize: stack,
        chartName: spot.chartName,
        hand: currentHand,
        correctAction,
        heroPosition: spot.heroPosition,
        villainPosition: spot.villainPosition,
        situation: spot.situation,
      };
      const record: QuizRecord = {
        question,
        userAnswer: action,
        correct: action === correctAction,
        timestamp: Date.now(),
      };
      saveQuizRecord(record);

      const nextAnswered = new Set(answeredHands);
      nextAnswered.add(currentHand);
      setRecords(prev => [...prev, record]);

      const nextHand = pickUnansweredHand(nextAnswered);
      if (!nextHand) {
        setCurrentHand(null);
        setPhase('result');
      } else {
        setCurrentHand(nextHand);
      }
    },
    [spot, chartData, currentHand, correctHandAction, stack, answeredHands],
  );

  const handleResetSpot = useCallback(() => {
    if (!spot) return;
    const kept = resetSpotRecords(stack, spot.chartName);
    setRecords(kept);
    setCurrentHand(null);
    setPhase('settings');
  }, [spot, stack]);

  const handleContinue = useCallback(() => {
    const hand = pickUnansweredHand(answeredHands);
    if (!hand) return;
    setCurrentHand(hand);
    setPhase('question');
  }, [answeredHands]);

  // ----- settings -----
  if (phase === 'settings') {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-lg font-bold text-white">차트 퀴즈 설정</h2>

        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-gray-400">스택 사이즈</p>
          <div className="flex gap-2">
            {STACK_SIZES.map(s => (
              <button
                key={s}
                onClick={() => setStack(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  stack === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <p className="text-sm text-gray-400">차트 선택</p>
          <select
            value={chartName}
            onChange={e => setChartName(e.target.value)}
            className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {groupedSpots.map(group => (
              <optgroup key={group.category} label={group.label}>
                {group.items.map(item => (
                  <option key={item.chartName} value={item.chartName}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {spot && (
            <div className="text-xs text-gray-500 text-center">
              {spot.chartName}
              {answeredCount > 0 && (
                <span className="ml-2 text-indigo-400">
                  이미 답한 핸드 {answeredCount}/{TOTAL_HANDS}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={startQuiz}
            disabled={!spot}
            className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            시작
          </button>
          {answeredCount > 0 && (
            <>
              <button
                onClick={() => setPhase('result')}
                className="px-5 py-3 bg-gray-700 text-gray-100 rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                결과 보기
              </button>
              <button
                onClick={handleResetSpot}
                className="px-5 py-3 bg-red-900/60 text-red-200 rounded-lg font-medium hover:bg-red-800 transition-colors"
              >
                이 스팟 답변 초기화
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ----- question -----
  if (phase === 'question' && spot && currentHand) {
    return (
      <div className="flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-1">
          <span className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg font-mono text-xl font-bold">
            {stack}
          </span>
          <span className="text-gray-200 text-lg font-semibold">{spot.situation}</span>
        </div>

        <div className="flex items-center gap-3">
          {spot.heroPosition && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">나</span>
              <span
                className="px-4 py-2 rounded-lg text-lg font-bold"
                style={{
                  backgroundColor: POSITION_COLORS[spot.heroPosition] || '#374151',
                  color: '#fff',
                }}
              >
                {spot.heroPosition}
              </span>
            </div>
          )}
          {spot.villainPosition && (
            <>
              <span className="text-gray-600 font-bold text-lg">vs</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">상대</span>
                <span
                  className="px-4 py-2 rounded-lg text-lg font-bold"
                  style={{
                    backgroundColor: POSITION_COLORS[spot.villainPosition] || '#374151',
                    color: '#fff',
                  }}
                >
                  {spot.villainPosition}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="text-5xl font-bold text-white tracking-wider">{currentHand}</div>

        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {choices.map(action => {
            const color = ACTION_COLORS[action];
            return (
              <button
                key={action}
                onClick={() => handleAnswer(action)}
                className="px-5 py-3 rounded-lg font-medium text-sm transition-all hover:scale-105 active:scale-95 min-w-[80px]"
                style={{
                  backgroundColor: color?.bg || '#374151',
                  color: color?.text || '#d1d5db',
                  border: action === 'fold' ? '1px solid #4b5563' : 'none',
                }}
              >
                {actionLabel(action)}
              </button>
            );
          })}
        </div>

        <div className="text-sm text-gray-500">
          답변 {answeredCount}/{TOTAL_HANDS}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setPhase('result')}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 transition-colors"
          >
            결과 보기
          </button>
          <button
            onClick={() => setPhase('settings')}
            className="px-5 py-2 bg-gray-700 text-gray-200 rounded-lg font-medium hover:bg-gray-600 transition-colors"
          >
            설정으로
          </button>
        </div>
      </div>
    );
  }

  // ----- result -----
  if (phase === 'result' && spot && chartData) {
    return (
      <ResultView
        stack={stack}
        spot={spot}
        correctHandAction={correctHandAction}
        userHandAction={userHandAction}
        answeredCount={answeredCount}
        onBackToSettings={() => setPhase('settings')}
        onContinue={handleContinue}
        onReset={handleResetSpot}
      />
    );
  }

  return null;
}

interface ResultViewProps {
  stack: StackSize;
  spot: SpotOption;
  correctHandAction: Record<string, string>;
  userHandAction: Record<string, string>;
  answeredCount: number;
  onBackToSettings: () => void;
  onContinue: () => void;
  onReset: () => void;
}

function ResultView({
  stack,
  spot,
  correctHandAction,
  userHandAction,
  answeredCount,
  onBackToSettings,
  onContinue,
  onReset,
}: ResultViewProps) {
  const correctStats = useMemo(
    () => buildActionStats(correctHandAction),
    [correctHandAction],
  );
  // Reuse buildActionStats on a fold-normalized map so unanswered cells are
  // not counted as fold combos.
  const userForStats = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [hand, action] of Object.entries(userHandAction)) {
      if (action !== 'unanswered') m[hand] = action;
    }
    return m;
  }, [userHandAction]);
  const userStats = useMemo(() => buildActionStats(userForStats), [userForStats]);

  const allAnswered = answeredCount >= TOTAL_HANDS;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <span className="bg-gray-800 text-gray-200 px-3 py-1.5 rounded-lg font-mono text-base font-bold">
          {stack}
        </span>
        <span className="text-gray-200 text-base font-semibold">{spot.situation}</span>
        <span className="text-xs text-gray-500">
          답변 {answeredCount}/{TOTAL_HANDS}
        </span>
      </div>

      <div className="flex flex-wrap justify-center gap-6 w-full">
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-medium text-gray-300">정답 (GTO)</h3>
          <RangeGrid handAction={correctHandAction} colorMap={ACTION_COLORS} />
          <Legend items={correctStats.legendItems} total={correctStats.totalNonFold} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-medium text-gray-300">내 답변</h3>
          <RangeGrid handAction={userHandAction} colorMap={USER_COLOR_MAP} />
          <Legend items={userStats.legendItems} total={userStats.totalNonFold} />
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {!allAnswered && (
          <button
            onClick={onContinue}
            className="px-5 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 transition-colors"
          >
            계속 풀기
          </button>
        )}
        <button
          onClick={onBackToSettings}
          className="px-5 py-2 bg-gray-700 text-gray-200 rounded-lg font-medium hover:bg-gray-600 transition-colors"
        >
          다른 스팟 선택
        </button>
        <button
          onClick={onReset}
          className="px-5 py-2 bg-red-900/60 text-red-200 rounded-lg font-medium hover:bg-red-800 transition-colors"
        >
          이 스팟 답변 초기화
        </button>
      </div>
    </div>
  );
}
