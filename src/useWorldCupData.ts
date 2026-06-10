import { useEffect, useState } from 'react';
import type { WorldCupData } from './shared/types';

interface WorldCupDataState {
  data: WorldCupData | null;
  loading: boolean;
  error: string | null;
}

interface ErrorResponse {
  error?: string;
}

export function useWorldCupData() {
  const [state, setState] = useState<WorldCupDataState>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function load() {
      try {
        const response = await fetch('/api/world-cup', { cache: 'no-store' });
        const body = await response.json() as WorldCupData & ErrorResponse;
        if (!response.ok) throw new Error(body.error || 'Could not load tournament data');
        if (cancelled) return;
        setState({ data: body, loading: false, error: body.lastError || null });
        const deadline = new Date(body.schedule?.nextRefreshAt || Date.now() + 15 * 60_000).getTime();
        const delay = Math.max(60_000, deadline - Date.now() + 5_000);
        timer = window.setTimeout(load, delay);
      } catch (error) {
        if (cancelled) return;
        setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Unknown data error' }));
        timer = window.setTimeout(load, 5 * 60_000);
      }
    }

    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return state;
}
