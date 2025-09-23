import { useEffect, useRef, useState } from "react";

export function useElapsedTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [active]);

  const formatted = seconds >= 60
    ? `${Math.floor(seconds / 60)}m ${(seconds % 60).toString().padStart(2, '0')}s`
    : `${seconds}s`;

  return { seconds, formatted };
}


