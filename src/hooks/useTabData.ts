"use client";

import { useState, useEffect, useCallback } from "react";

const cache = new Map<string, { data: unknown; timestamp: number }>();

export function useTabData<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(
    cache.has(key) ? (cache.get(key)!.data as T) : null
  );
  const [loading, setLoading] = useState(!cache.has(key));

  useEffect(() => {
    // Already have cached data (applied via useState initializer)
    if (cache.has(key)) return;

    let cancelled = false;

    fetcher().then((result) => {
      if (cancelled) return;
      cache.set(key, { data: result, timestamp: Date.now() });
      setData(result);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [key, fetcher]);

  const refetch = useCallback(() => {
    cache.delete(key);
    setLoading(true);
    fetcher().then((result) => {
      cache.set(key, { data: result, timestamp: Date.now() });
      setData(result);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [key, fetcher]);

  return { data, loading, refetch };
}

/** Clear all cached tab data for a specific client */
export function clearTabCache(clientId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${clientId}:`)) {
      cache.delete(key);
    }
  }
}
