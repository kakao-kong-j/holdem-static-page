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
import { EquityCalculatorPage } from './pages/EquityCalculatorPage';
import type { StackSize, QuizQuestion } from './types';

type View = 'open-range' | 'sb-open' | 'facing' | 'quiz' | 'quiz-stats' | 'coinpoker' | 'equity';

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
  { value: 'equity', label: '에쿼티 계산기' },
];

const SB_OPEN_DISABLED_STACKS: StackSize[] = [];

function App() {
  const { user, isAuthenticated, checking, logout } = useAuth();
  const { data, loading, error } = useChartData(isAuthenticated);
  const [stack, setStack] = useState<StackSize>('100BB');
  const [view, setView] = useState<View>('open-range');
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    return <LoginGate />;
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

  const currentLabel = VIEWS.find(v => v.value === view)?.label ?? '';

  return (
    <div className={`min-h-screen ${view === 'coinpoker' ? 'max-w-7xl' : 'max-w-4xl'} mx-auto`}>
      {/* Sidebar Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 z-50 flex flex-col shadow-2xl transform transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <span className="text-white font-bold text-base">GTO Preflop</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {VIEWS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setView(value); setDrawerOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm mb-1 transition-colors ${
                view === value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-gray-700">
          {user?.name && (
            <p className="text-xs text-gray-400 mb-2 truncate">{user.name}</p>
          )}
          <button
            onClick={logout}
            className="w-full px-3 py-2 text-xs bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-gray-800">
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-gray-400 hover:text-white transition-colors p-1 shrink-0"
          aria-label="메뉴 열기"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-sm font-bold text-white truncate">
          GTO Preflop Charts
        </h1>
        <span className="text-xs text-indigo-400 font-medium truncate">
          {currentLabel}
        </span>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {view !== 'quiz' && view !== 'quiz-stats' && view !== 'coinpoker' && view !== 'equity' && (
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
        {view === 'equity' && <EquityCalculatorPage />}
      </div>
    </div>
  );
}

export default App;
