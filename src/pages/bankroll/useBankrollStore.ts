import { useEffect, useState } from 'react';
import { dedupeSessions, parseBankrollFile, type BankrollSession } from '../../utils/bankroll';
import {
  clearBankroll,
  fetchBankrollSessions,
  flattenStore,
  pushBankrollSessions,
  replaceBankrollSessions,
  type BankrollStore,
} from '../../utils/bankrollSync';

export function flattenBankrollStore(store: BankrollStore): BankrollSession[] {
  return dedupeSessions(flattenStore(store));
}

export function useBankrollStore() {
  const [sessions, setSessions] = useState<BankrollSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchBankrollSessions()
      .then((store) => {
        if (!cancelled) setSessions(flattenBankrollStore(store));
      })
      .catch(() => {
        /* offline / no /api — start empty */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    sessions,
    setSessions,
    loading,
    syncing,
    setSyncing,
    parseBankrollFile,
    clearBankroll,
    pushBankrollSessions,
    replaceBankrollSessions,
    flattenBankrollStore,
  };
}
