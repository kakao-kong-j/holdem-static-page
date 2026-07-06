import { OpenRangePage } from '../pages/OpenRangePage';
import { SbOpenPage } from '../pages/SbOpenPage';
import { FacingPage } from '../pages/FacingPage';
import { QuizPage } from '../pages/QuizPage';
import { QuizStatsPage } from '../pages/QuizStatsPage';
import { CoinPokerAnalysisPage } from '../pages/CoinPokerAnalysisPage';
import { BankrollPage } from '../pages/BankrollPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { EquityCalculatorPage } from '../pages/EquityCalculatorPage';
import type { AllData, QuizQuestion, StackSize } from '../types';

export type View = 'open-range' | 'sb-open' | 'facing' | 'quiz' | 'quiz-stats' | 'coinpoker' | 'bankroll' | 'transactions' | 'equity';

export type NavigateIntent =
  | { kind: 'chart'; stack: StackSize; chartName: string; viewType: 'open-range' | 'sb-open' | 'facing' }
  | { kind: 'review'; question: QuizQuestion }
  | { kind: 'quiz' };

export interface ViewMeta {
  value: View;
  label: string;
  maxWidth: 'normal' | 'wide';
  showStackTabs: boolean;
}

export const SB_OPEN_DISABLED_STACKS: StackSize[] = [];

export const VIEWS: ViewMeta[] = [
  { value: 'open-range', label: 'Open Range', maxWidth: 'normal', showStackTabs: true },
  { value: 'sb-open', label: 'SB Open', maxWidth: 'normal', showStackTabs: true },
  { value: 'facing', label: 'Facing Charts', maxWidth: 'normal', showStackTabs: true },
  { value: 'quiz', label: '퀴즈', maxWidth: 'normal', showStackTabs: false },
  { value: 'quiz-stats', label: '통계', maxWidth: 'normal', showStackTabs: false },
  { value: 'coinpoker', label: 'CoinPoker 분석', maxWidth: 'wide', showStackTabs: false },
  { value: 'bankroll', label: '뱅크롤', maxWidth: 'wide', showStackTabs: false },
  { value: 'transactions', label: '거래내역', maxWidth: 'wide', showStackTabs: false },
  { value: 'equity', label: '에쿼티 계산기', maxWidth: 'normal', showStackTabs: false },
];

export function getViewMeta(view: View): ViewMeta {
  return VIEWS.find(v => v.value === view) ?? VIEWS[0];
}

export function renderView(args: {
  view: View;
  stack: StackSize;
  data: AllData;
  onNavigate: (intent: NavigateIntent) => void;
}) {
  const stackData = args.data[args.stack];

  switch (args.view) {
    case 'open-range':
      return <OpenRangePage stackData={stackData} />;
    case 'sb-open':
      return <SbOpenPage stackData={stackData} />;
    case 'facing':
      return <FacingPage stackData={stackData} />;
    case 'quiz':
      return <QuizPage data={args.data} />;
    case 'quiz-stats':
      return <QuizStatsPage data={args.data} onNavigate={args.onNavigate} />;
    case 'coinpoker':
      return <CoinPokerAnalysisPage fallbackStack={args.stack} data={args.data} />;
    case 'bankroll':
      return <BankrollPage />;
    case 'transactions':
      return <TransactionsPage />;
    case 'equity':
      return <EquityCalculatorPage />;
  }
}
