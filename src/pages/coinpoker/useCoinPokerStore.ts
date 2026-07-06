import { useEffect, useState } from 'react';
import { parseCoinPokerHands, type CoinPokerGameType } from '../../utils/coinpokerParser';
import {
  EMPTY_COINPOKER_STORE,
  clearCoinPokerHands,
  fetchCoinPokerHands,
  mergeCoinPokerStore,
  pushCoinPokerHands,
  type CoinPokerStore,
  type LoadProgress,
} from '../../utils/coinpokerSync';

export function useCoinPokerStore() {
  const [store, setStore] = useState<CoinPokerStore>(EMPTY_COINPOKER_STORE);
  const [gameType, setGameType] = useState<CoinPokerGameType>('cash');
  const [chartLimit, setChartLimit] = useState(Number.MAX_SAFE_INTEGER);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Load accumulated hands (both game types) on mount, reporting download progress.
  useEffect(() => {
    let cancelled = false;
    fetchCoinPokerHands(p => {
      if (!cancelled) setProgress(p);
    })
      .then(s => {
        if (!cancelled) setStore(s);
      })
      .catch(() => {
        // offline / no /api — start empty, uploads stay in-memory
        if (!cancelled) setSyncError('서버 동기화에 실패했습니다. 로컬 작업은 계속할 수 있습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    store,
    setStore,
    gameType,
    setGameType,
    chartLimit,
    setChartLimit,
    loading,
    progress,
    syncError,
    setSyncError,
    importMessage,
    setImportMessage,
    mergeCoinPokerStore,
    parseCoinPokerHands,
    clearCoinPokerHands,
    fetchCoinPokerHands,
    pushCoinPokerHands,
  };
}
