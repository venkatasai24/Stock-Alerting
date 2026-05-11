import { useEffect, useRef, useState } from "react";

export function useAutoRefresh(fn, intervalMs = 60000) {
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);
  const timerRef = useRef(null);

  async function runFn() {
    setRefreshing(true);
    try { await fn(); } finally {
      setRefreshing(false);
      setLastUpdated(new Date());
    }
  }

  useEffect(() => {
    runFn();
    timerRef.current = setInterval(runFn, intervalMs);
    return () => clearInterval(timerRef.current);
  }, []);

  return { lastUpdated, refreshing, refresh: runFn };
}
