import { useState, useCallback } from 'react';
import { ACTION_COLORS, POSITION_COLORS, STACK_SIZES } from '../constants';
import { generateQuizQuestion, saveQuizRecord, actionLabel } from '../utils/quiz';
import type { AllData, StackSize, QuizQuestion, QuizRecord } from '../types';

type Phase = 'settings' | 'question' | 'result';

interface Props {
  data: AllData;
}

export function QuizPage({ data }: Props) {
  const [phase, setPhase] = useState<Phase>('settings');
  const [selectedStacks, setSelectedStacks] = useState<StackSize[]>([...STACK_SIZES]);
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
    const result = generateQuizQuestion(data, selectedStacks);
    if (!result) return;
    setQuestion(result.question);
    setChoices(result.choices);
    setUserAnswer('');
    setPhase('question');
  }, [data, selectedStacks]);

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

<div className="flex flex-col items-center gap-2">
          {!isCorrect && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">내 답:</span>
              <span
                className="px-3 py-1 rounded font-medium"
                style={{
                  backgroundColor: ACTION_COLORS[userAnswer]?.bg || '#374151',
                  color: ACTION_COLORS[userAnswer]?.text || '#d1d5db',
                }}
              >
                {actionLabel(userAnswer)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">정답:</span>
            <span
              className="px-3 py-1 rounded font-medium"
              style={{
                backgroundColor: ACTION_COLORS[question.correctAction]?.bg || '#374151',
                color: ACTION_COLORS[question.correctAction]?.text || '#d1d5db',
              }}
            >
              {actionLabel(question.correctAction)}
            </span>
          </div>
        </div>

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
