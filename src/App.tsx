import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useChartData } from './hooks/useChartData';
import { syncQuizRecords } from './utils/recordsSync';
import { LoginGate } from './components/LoginGate';
import { StackTabs } from './components/StackTabs';
import { OpenRangePage } from './pages/OpenRangePage';
import { SbOpenPage } from './pages/SbOpenPage';
import { FacingPage } from './pages/FacingPage';
import { QuizPage } from './pages/QuizPage';
import { QuizStatsPage } from './pages/QuizStatsPage';
import { CoinPokerAnalysisPage } from './pages/CoinPokerAnalysisPage';
import type { StackSize, QuizQuestion } from './types';

type View = 'open-range' | 'sb-open' | 'facing' | 'quiz' | 'quiz-stats' | 'coinpoker';

export type NavigateIntent =
  | { kind: 'chart'; stack: StackSize; chartName: string; viewType: 'open-range' | 'sb-open' | 'facing' }
  | { kind: 'review'; question: QuizQuestion }
  | { kind: 'quiz' };

const VIEWS: { value: View; label: string }[] = [
  { value: 'open-range', label: 'Open Range' },
  { value: 'sb-open', label: 'SB Open' },
  { value: 'facing', label: 'Facing Charts' },
  { value: 'quiz', label: '퀴즈' },
  { value: 'quiz-stats', label: '통계' },
  { value: 'coinpoker', label: 'CoinPoker 분석' },
];

const SB_OPEN_DISABLED_STACKS: StackSize[] = [];

function App() {
  const { user, isAuthenticated, checking, login, logout } = useAuth();
  const { data, loading, error } = useChartData(isAuthenticated);
  const [stack, setStack] = useState<StackSize>('100BB');
  const [view, setView] = useState<View>('open-range');

  useEffect(() => {
    if (view === 'sb-open' && SB_OPEN_DISABLED_STACKS.includes(stack)) {
      setStack('100BB');
    }
  }, [view, stack]);

  // On login, reconcile local quiz records with the server-side store.
  useEffect(() => {
    if (!isAuthenticated) return;
    syncQuizRecords().catch(() => {
      /* offline or /api unavailable (e.g. plain vite dev) — keep working locally */
    });
  }, [isAuthenticated]);

  const navigate = (intent: NavigateIntent) => {
    if (intent.kind === 'chart') {
      sessionStorage.setItem('pendingChart', JSON.stringify({
        stack: intent.stack,
        chartName: intent.chartName,
        viewType: intent.viewType,
      }));
      const targetView: View =
        intent.viewType === 'sb-open' && SB_OPEN_DISABLED_STACKS.includes(intent.stack)
          ? 'open-range'
          : intent.viewType;
      setStack(intent.stack);
      setView(targetView);
    } else if (intent.kind === 'review') {
      sessionStorage.setItem('pendingReview', JSON.stringify(intent.question));
      setView('quiz');
    } else if (intent.kind === 'quiz') {
      setView('quiz');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        로그인 확인 중...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginGate onLogin={login} />;
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
    <div className={`min-h-screen p-4 mx-auto ${view === 'coinpoker' ? 'max-w-7xl' : 'max-w-4xl'}`}>
      <div className="relative mb-4">
        <h1 className="text-xl font-bold text-center text-white">
          GTO Preflop Charts
        </h1>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {user?.name && (
            <span className="hidden sm:inline text-xs text-gray-400 max-w-[120px] truncate">
              {user.name}
            </span>
          )}
          <button
            onClick={logout}
            className="px-2.5 py-1 text-xs bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-4">
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

      {view !== 'quiz' && view !== 'quiz-stats' && view !== 'coinpoker' && (
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
      {view === 'coinpoker' && <CoinPokerAnalysisPage fallbackStack={stack} data={data} />}
    </div>
  );
}

export default App;
