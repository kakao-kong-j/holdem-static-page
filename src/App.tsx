import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useChartData } from './hooks/useChartData';
import { PasswordGate } from './components/PasswordGate';
import { StackTabs } from './components/StackTabs';
import { OpenRangePage } from './pages/OpenRangePage';
import { SbOpenPage } from './pages/SbOpenPage';
import { FacingPage } from './pages/FacingPage';
import type { StackSize } from './types';

type View = 'open-range' | 'sb-open' | 'facing';

const VIEWS: { value: View; label: string }[] = [
  { value: 'open-range', label: 'Open Range' },
  { value: 'sb-open', label: 'SB Open' },
  { value: 'facing', label: 'Facing Charts' },
];

function App() {
  const { isAuthenticated, login } = useAuth();
  const { data, loading, error } = useChartData(isAuthenticated);
  const [stack, setStack] = useState<StackSize>('100BB');
  const [view, setView] = useState<View>('open-range');

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

      <div className="flex justify-center mb-4">
        <StackTabs selected={stack} onChange={setStack} />
      </div>

      {view === 'open-range' && <OpenRangePage stackData={stackData} />}
      {view === 'sb-open' && <SbOpenPage stackData={stackData} />}
      {view === 'facing' && <FacingPage stackData={stackData} />}
    </div>
  );
}

export default App;
