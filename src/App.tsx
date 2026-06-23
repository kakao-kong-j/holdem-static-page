import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useChartData } from './hooks/useChartData';
import { syncQuizRecords } from './utils/recordsSync';
import { LoginGate } from './components/LoginGate';
import { AppShell } from './components/AppShell';
import {
  SB_OPEN_DISABLED_STACKS,
  getViewMeta,
  renderView,
  type NavigateIntent,
  type View,
} from './app/viewRegistry';
import type { StackSize } from './types';

function App() {
  const { user, isAuthenticated, checking, logout } = useAuth();
  const { data, loading, error } = useChartData(isAuthenticated);
  const [stack, setStack] = useState<StackSize>('100BB');
  const [view, setView] = useState<View>('open-range');

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
    return <div className="min-h-screen flex items-center justify-center text-gray-400">로그인 확인 중...</div>;
  }

  if (!isAuthenticated) return <LoginGate />;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">데이터 로딩 중...</div>;
  }

  if (error || !data) {
    return <div className="min-h-screen flex items-center justify-center text-red-400">데이터 로드 실패: {error}</div>;
  }

  const viewMeta = getViewMeta(view);

  return (
    <AppShell
      user={user}
      view={view}
      viewMeta={viewMeta}
      stack={stack}
      onStackChange={setStack}
      onViewChange={setView}
      onLogout={logout}
    >
      {renderView({ view, stack, data, onNavigate: navigate })}
    </AppShell>
  );
}

export default App;
