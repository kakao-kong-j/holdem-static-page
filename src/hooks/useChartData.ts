import { useState, useEffect } from 'react';
import type { AllData } from '../types';

export function useChartData(enabled: boolean) {
  const [data, setData] = useState<AllData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const base = import.meta.env.BASE_URL;
    fetch(`${base}gto-preflop-charts-all.json`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        setData(json.data as AllData);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [enabled]);

  return { data, loading, error };
}
