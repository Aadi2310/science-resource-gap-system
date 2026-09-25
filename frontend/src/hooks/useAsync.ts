import { useCallback, useEffect, useState } from 'react';

export function useAsync<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = useCallback(() => setRefreshKey((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    loader().then((result) => { if (active) setData(result); }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'The request could not be completed.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Callers pass stable dependencies for the data request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, refreshKey]);
  return { data, error, loading, reload, setData };
}
