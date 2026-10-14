import { useCallback, useEffect, useState } from "react";
import { readBoolean, readEnum, readHexColor, readNumber, writeStorage } from "@/lib/storage";

export const BG_COLOR_KEY = "presenter.backgroundColor";
const ALWAYS_SHOW_CONTROLS_KEY = "presenter.alwaysShowFloatingControls";
const CONTROLS_TIMEOUT_KEY = "presenter.floatingControlsTimeout";
export const THEME_KEY = "presenter.theme";

export const DEFAULT_BG_COLOR = "#000000";
export const DEFAULT_CONTROLS_TIMEOUT = 5;
export const DEFAULT_THEME = "light";

// O mesmo intervalo do diálogo de configurações. Sem o teto aqui, um valor
// corrompido no localStorage manteria os controles flutuantes visíveis para sempre.
export const MIN_CONTROLS_TIMEOUT = 1;
export const MAX_CONTROLS_TIMEOUT = 30;

export type Theme = "light" | "dark";

const THEMES = [DEFAULT_THEME, "dark"] as const;

export function useSettings() {
  // A cor vai direto para o style do palco, então só aceita hex de 6 dígitos.
  const [backgroundColor, setBackgroundColorState] = useState<string>(() =>
    readHexColor(BG_COLOR_KEY, DEFAULT_BG_COLOR),
  );

  const [alwaysShowFloatingControls, setAlwaysShowFloatingControls] = useState<boolean>(() =>
    readBoolean(ALWAYS_SHOW_CONTROLS_KEY, false),
  );

  const [floatingControlsTimeout, setFloatingControlsTimeoutState] = useState<number>(() =>
    readNumber(
      CONTROLS_TIMEOUT_KEY,
      MIN_CONTROLS_TIMEOUT,
      MAX_CONTROLS_TIMEOUT,
      DEFAULT_CONTROLS_TIMEOUT,
    ),
  );

  const [theme, setThemeState] = useState<Theme>(() =>
    readEnum(THEME_KEY, THEMES, DEFAULT_THEME),
  );

  useEffect(() => {
    writeStorage(BG_COLOR_KEY, backgroundColor);
  }, [backgroundColor]);

  useEffect(() => {
    writeStorage(ALWAYS_SHOW_CONTROLS_KEY, String(alwaysShowFloatingControls));
  }, [alwaysShowFloatingControls]);

  useEffect(() => {
    writeStorage(CONTROLS_TIMEOUT_KEY, String(floatingControlsTimeout));
  }, [floatingControlsTimeout]);

  useEffect(() => {
    writeStorage(THEME_KEY, theme);
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [theme]);

  const setBackgroundColor = useCallback((color: string) => {
    setBackgroundColorState(color);
  }, []);

  const setAlwaysShowFloatingControlsValue = useCallback((value: boolean) => {
    setAlwaysShowFloatingControls(value);
  }, []);

  const setFloatingControlsTimeout = useCallback((value: number) => {
    setFloatingControlsTimeoutState(value);
  }, []);

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value);
  }, []);

  return {
    backgroundColor,
    setBackgroundColor,
    alwaysShowFloatingControls,
    setAlwaysShowFloatingControls: setAlwaysShowFloatingControlsValue,
    floatingControlsTimeout,
    setFloatingControlsTimeout,
    theme,
    setTheme,
  };
}