import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useChartData } from './hooks/useChartData';
import { PasswordGate } from './components/PasswordGate';
import { StackTabs } from './components/StackTabs';
import { OpenRangePage } from './pages/OpenRangePage';
import { SbOpenPage } from './pages/SbOpenPage';
import { FacingPage } from './pages/FacingPage';
import { QuizPage } from './pages/QuizPage';
import { QuizStatsPage } from './pages/QuizStatsPage';
import type { StackSize, QuizQuestion } from './types';

type View = 'open-range' | 'sb-open' | 'facing' | 'quiz' | 'quiz-stats';

export type NavigateIntent =
  | { kind: 'chart'; stack: StackSize; chartName: string; type: 'rfi' | 'facing' }
  | { kind: 'review'; question: QuizQuestion }
  | { kind: 'quiz' };

const VIEWS: { value: View; label: string }[] = [
  { value: 'open-range', label: 'Open Range' },
  { value: 'sb-open', label: 'SB Open' },
  { value: 'facing', label: 'Facing Charts' },
  { value: 'quiz', label: '퀴즈' },
  { value: 'quiz-stats', label: '통계' },
];

const SB_OPEN_DISABLED_STACKS: StackSize[] = ['25BB', '40BB'];

function App() {
  const { isAuthenticated, login } = useAuth();
  const { data, loading, error } = useChartData(isAuthenticated);
  const [stack, setStack] = useState<StackSize>('100BB');
  const [view, setView] = useState<View>('open-range');

  useEffect(() => {
    if (view === 'sb-open' && SB_OPEN_DISABLED_STACKS.includes(stack)) {
      setStack('100BB');
    }
  }, [view, stack]);

  const navigate = (intent: NavigateIntent) => {
    if (intent.kind === 'chart') {
      sessionStorage.setItem('pendingChart', JSON.stringify({
        stack: intent.stack,
        chartName: intent.chartName,
        type: intent.type,
      }));
      setStack(intent.stack);
      setView(intent.type === 'rfi' ? 'open-range' : 'facing');
    } else if (intent.kind === 'review') {
      sessionStorage.setItem('pendingReview', JSON.stringify(intent.question));
      setView('quiz');
    } else if (intent.kind === 'quiz') {
      setView('quiz');
    }
  };

  if (!isAuthenticated) {
    return <PasswordGate onLogin={login} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        데이터 로딩 중...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        데이터 로드 실패: {error}
      </div>
    );
  }

  const stackData = data[stack];

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-center mb-4 text-white">
        GTO Preflop Charts
      </h1>

      <div className="flex justify-center gap-2 mb-4">
        {VIEWS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setView(value)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              view === value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view !== 'quiz' && view !== 'quiz-stats' && (
        <div className="flex justify-center mb-4">
          <StackTabs
            selected={stack}
            onChange={setStack}
            disabledStacks={view === 'sb-open' ? SB_OPEN_DISABLED_STACKS : undefined}
          />
        </div>
      )}

      {view === 'open-range' && <OpenRangePage stackData={stackData} />}
      {view === 'sb-open' && <SbOpenPage stackData={stackData} />}
      {view === 'facing' && <FacingPage stackData={stackData} />}
      {view === 'quiz' && <QuizPage data={data} />}
      {view === 'quiz-stats' && <QuizStatsPage data={data} onNavigate={navigate} />}
    </div>
  );
}

export default App;
