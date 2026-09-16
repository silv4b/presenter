import { useCallback, useEffect, useRef, useState } from "react";

export function useAutoHide(delay = 3000) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    setVisible(true);
    clear();
    timerRef.current = setTimeout(() => setVisible(false), delay);
  }, [delay, clear]);

  useEffect(() => {
    return () => clear();
  }, [clear]);

  return { visible, show, setVisible, clear };
}
