import { useCallback, useEffect, useRef, useState } from "react";

const BG_COLOR_KEY = "presenter.backgroundColor";
const ALWAYS_SHOW_CONTROLS_KEY = "presenter.alwaysShowFloatingControls";
const CONTROLS_TIMEOUT_KEY = "presenter.floatingControlsTimeout";
const DEFAULT_BG_COLOR = "#000000";
const DEFAULT_CONTROLS_TIMEOUT = 5;

export interface Settings {
  backgroundColor: string;
  alwaysShowFloatingControls: boolean;
  floatingControlsTimeout: number;
}

export function useSettings() {
  const [backgroundColor, setBackgroundColorState] = useState<string>(() => {
    const saved = localStorage.getItem(BG_COLOR_KEY);
    return saved ?? DEFAULT_BG_COLOR;
  });
  const bgRef = useRef(backgroundColor);
  bgRef.current = backgroundColor;

  const [alwaysShowFloatingControls, setAlwaysShowFloatingControls] = useState<boolean>(() => {
    const saved = localStorage.getItem(ALWAYS_SHOW_CONTROLS_KEY);
    return saved === "true";
  });

  const [floatingControlsTimeout, setFloatingControlsTimeoutState] = useState<number>(() => {
    const saved = Number(localStorage.getItem(CONTROLS_TIMEOUT_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_CONTROLS_TIMEOUT;
  });

  useEffect(() => {
    localStorage.setItem(BG_COLOR_KEY, backgroundColor);
  }, [backgroundColor]);

  useEffect(() => {
    localStorage.setItem(ALWAYS_SHOW_CONTROLS_KEY, String(alwaysShowFloatingControls));
  }, [alwaysShowFloatingControls]);

  useEffect(() => {
    localStorage.setItem(CONTROLS_TIMEOUT_KEY, String(floatingControlsTimeout));
  }, [floatingControlsTimeout]);

  const setBackgroundColor = useCallback((color: string) => {
    setBackgroundColorState(color);
  }, []);

  const setAlwaysShowFloatingControlsValue = useCallback((value: boolean) => {
    setAlwaysShowFloatingControls(value);
  }, []);

  const setFloatingControlsTimeout = useCallback((value: number) => {
    setFloatingControlsTimeoutState(value);
  }, []);

  return {
    backgroundColor,
    setBackgroundColor,
    alwaysShowFloatingControls,
    setAlwaysShowFloatingControls: setAlwaysShowFloatingControlsValue,
    floatingControlsTimeout,
    setFloatingControlsTimeout,
  };
}
