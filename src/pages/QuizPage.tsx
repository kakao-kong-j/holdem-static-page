import { useState, useCallback, useEffect } from 'react';
import { ACTION_COLORS, POSITION_COLORS, STACK_SIZES } from '../constants';
import { generateQuizQuestion, saveQuizRecord, actionLabel, loadQuizRecords } from '../utils/quiz';
import type { QuizChartFilter } from '../utils/quiz';
import type { AllData, StackSize, QuizQuestion, QuizRecord } from '../types';

const CHART_FILTER_OPTIONS: { value: QuizChartFilter; label: string }[] = [
  { value: 'open-range', label: '오픈 레인지' },
  { value: 'facing', label: 'Facing' },
  { value: 'both', label: '모두' },
];

type Phase = 'settings' | 'question' | 'result';

interface Props {
  data: AllData;
}

export function QuizPage({ data }: Props) {
  const [phase, setPhase] = useState<Phase>('settings');
  const [selectedStacks, setSelectedStacks] = useState<StackSize[]>([...STACK_SIZES]);
  const [chartFilter, setChartFilter] = useState<QuizChartFilter>('both');
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);

  const toggleStack = (s: StackSize) => {
    setSelectedStacks(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s],
    );
  };

  const nextQuestion = useCallback(() => {
    const result = generateQuizQuestion(data, selectedStacks, chartFilter, loadQuizRecords());
    if (!result) return;
    setQuestion(result.question);
    setChoices(result.choices);
    setUserAnswer('');
    setPhase('question');
  }, [data, selectedStacks, chartFilter]);

  // pendingReview: 통계 페이지에서 "복습" 버튼으로 넘어왔을 때 해당 문제 즉시 출제
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingReview');
    if (!pending) return;
    sessionStorage.removeItem('pendingReview');
    try {
      const q = JSON.parse(pending) as QuizQuestion;
      const chart = data[q.stackSize]?.[q.chartName];
      if (!chart) return;
      const actions = Object.keys(chart);
      if (!actions.includes('fold')) actions.push('fold');
      setQuestion(q);
      setChoices(actions);
      setUserAnswer('');
      setPhase('question');
    } catch {
      /* ignore malformed */
    }
  }, [data]);

  const handleAnswer = (action: string) => {
    if (!question) return;
    const isCorrect = action === question.correctAction;
    setUserAnswer(action);
    if (isCorrect) setCorrect(c => c + 1);
    setTotal(t => t + 1);

    const record: QuizRecord = {
      question,
      userAnswer: action,
      correct: isCorrect,
      timestamp: Date.now(),
    };
    saveQuizRecord(record);
    setPhase('result');
  };

  if (phase === 'settings') {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-lg font-bold text-white">퀴즈 설정</h2>

        <div>
          <p className="text-sm text-gray-400 mb-2">스택 사이즈 선택</p>
          <div className="flex gap-2">
            {STACK_SIZES.map(s => (
              <button
                key={s}
                onClick={() => toggleStack(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStacks.includes(s)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-400 mb-2">차트 타입 선택</p>
          <div className="flex gap-2">
            {CHART_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setChartFilter(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  chartFilter === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={nextQuestion}
          disabled={selectedStacks.length === 0}
          className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold text-lg
            hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          시작
        </button>
      </div>
    );
  }

  if (phase === 'question' && question) {
    return (
      <div className="flex flex-col items-center gap-5">
<div className="flex flex-col items-center gap-1">
          <span className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg font-mono text-xl font-bold">
            {question.stackSize}
          </span>
          <span className="text-gray-200 text-lg font-semibold">{question.situation}</span>
        </div>

<div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">나</span>
            <span
              className="px-4 py-2 rounded-lg text-lg font-bold"
              style={{
                backgroundColor: POSITION_COLORS[question.heroPosition] || '#374151',
                color: '#fff',
              }}
            >
              {question.heroPosition}
            </span>
          </div>
          {question.villainPosition && (
            <>
              <span className="text-gray-600 font-bold text-lg">vs</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">상대</span>
                <span
                  className="px-4 py-2 rounded-lg text-lg font-bold"
                  style={{
                    backgroundColor: POSITION_COLORS[question.villainPosition] || '#374151',
                    color: '#fff',
                  }}
                >
                  {question.villainPosition}
                </span>
              </div>
            </>
          )}
        </div>

<div className="text-5xl font-bold text-white tracking-wider">
          {question.hand}
        </div>

<div className="flex flex-wrap justify-center gap-2 max-w-md">
          {choices.map(action => {
            const color = ACTION_COLORS[action];
            return (
              <button
                key={action}
                onClick={() => handleAnswer(action)}
                className="px-5 py-3 rounded-lg font-medium text-sm transition-all
                  hover:scale-105 active:scale-95 min-w-[80px]"
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
          정답: {correct}/{total}
        </div>
      </div>
    );
  }

  if (phase === 'result' && question) {
    const isCorrect = userAnswer === question.correctAction;
    return (
      <div className="flex flex-col items-center gap-5">
<div
          className={`text-2xl font-bold px-6 py-2 rounded-lg ${
            isCorrect
              ? 'bg-green-900/50 text-green-400'
              : 'bg-red-900/50 text-red-400'
          }`}
        >
          {isCorrect ? '정답!' : '오답'}
        </div>

<div className="flex items-center gap-3">
          <span className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg font-mono text-lg font-bold">
            {question.stackSize}
          </span>
          <span
            className="px-3 py-2 rounded-lg text-lg font-bold"
            style={{
              backgroundColor: POSITION_COLORS[question.heroPosition] || '#374151',
              color: '#fff',
            }}
          >
            {question.heroPosition}
          </span>
          {question.villainPosition && (
            <>
              <span className="text-gray-600 font-bold text-lg">vs</span>
              <span
                className="px-3 py-2 rounded-lg text-lg font-bold"
                style={{
                  backgroundColor: POSITION_COLORS[question.villainPosition] || '#374151',
                  color: '#fff',
                }}
              >
                {question.villainPosition}
              </span>
            </>
          )}
        </div>

<div className="text-4xl font-bold text-white">{question.hand}</div>

{!isCorrect ? (
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">내 답</span>
              <span
                className="px-4 py-2 rounded-lg text-lg font-bold line-through opacity-60"
                style={{
                  backgroundColor: ACTION_COLORS[userAnswer]?.bg || '#374151',
                  color: ACTION_COLORS[userAnswer]?.text || '#d1d5db',
                }}
              >
                {actionLabel(userAnswer)}
              </span>
            </div>
            <span className="text-red-400 text-2xl font-bold">→</span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">정답</span>
              <span
                className="px-4 py-2 rounded-lg text-lg font-bold ring-2 ring-green-500"
                style={{
                  backgroundColor: ACTION_COLORS[question.correctAction]?.bg || '#374151',
                  color: ACTION_COLORS[question.correctAction]?.text || '#d1d5db',
                }}
              >
                {actionLabel(question.correctAction)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span
              className="px-6 py-3 rounded-lg text-xl font-bold ring-2 ring-green-500"
              style={{
                backgroundColor: ACTION_COLORS[question.correctAction]?.bg || '#374151',
                color: ACTION_COLORS[question.correctAction]?.text || '#d1d5db',
              }}
            >
              {actionLabel(question.correctAction)}
            </span>
          </div>
        )}

<div className="text-sm text-gray-500">
          정답: {correct}/{total}
        </div>

<button
          onClick={nextQuestion}
          className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold
            hover:bg-indigo-500 transition-colors"
        >
          다음 문제
        </button>
      </div>
    );
  }

  return null;
}
