import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readPdfAsDataUrl, setDocument, extractNotesFromPdf } from "@/lib/pdf";
import {
  listMonitors,
  getMonitorConfig,
  setMonitorConfig,
  clearDocument,
  openProjections,
  closeProjection,
  type MonitorInfo,
} from "@/lib/monitors";
import {
  EVENT_SLIDE_CHANGE,
  EVENT_BLACK_SCREEN,
  EVENT_WHITE_SCREEN,
  EVENT_VIEWSCREEN_READY,
  emitSafe,
  type SlideChangePayload,
} from "@/lib/shared";
import { clamp, type AnnotationTool } from "@/lib/annotations";
import { addToHistory } from "@/lib/fileHistory";
import { readEnum, readNumber, writeStorage } from "@/lib/storage";

interface PresentationContextValue {
  docPath: string | null;
  docName: string | null;
  docDataUrl: string | null;
  numPages: number;
  currentPage: number;
  error: string | null;
  isPresenting: boolean;
  isSingleMonitor: boolean;
  blackScreen: boolean;
  whiteScreen: boolean;
  monitors: MonitorInfo[];
  selectedMonitors: string[];
  notesByPage: Record<number, string[]>;
  refreshMonitors: () => Promise<void>;
  selectMonitor: (id: string) => void;
  openPdf: () => Promise<void>;
  loadPdfFromPath: (path: string) => Promise<void>;
  closeDocument: () => void;
  setNumPages: (n: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  startPresentation: () => Promise<void>;
  stopPresentation: () => Promise<void>;
  toggleBlackScreen: () => void;
  toggleWhiteScreen: () => void;
  activeTool: AnnotationTool | null;
  toggleTool: (tool: AnnotationTool) => void;
  setError: (error: string | null) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  registerTimerFunctions: (toggle: () => void, reset: () => void) => void;
  registerZoomReset: (reset: () => void) => void;
  resetZoom: () => void;
  timerMode: TimerMode;
  setTimerMode: (mode: TimerMode) => void;
  timerInitialTime: number; // in milliseconds
  setTimerInitialTime: (ms: number) => void;
}

const TIMER_MODE_KEY = "presenter.timerMode";
const TIMER_INITIAL_TIME_KEY = "presenter.timerInitialTime";

const TIMER_MODES = ["stopwatch", "countdown"] as const;
const MIN_TIMER_MS = 0;
const MAX_TIMER_MS = 99 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000 + 990;

export type TimerMode = (typeof TIMER_MODES)[number];

const PresentationContext = createContext<PresentationContextValue | null>(null);

export function PresentationProvider({ children }: { children: ReactNode }) {
  const [docPath, setDocPath] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [docDataUrl, setDocDataUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [blackScreen, setBlackScreen] = useState(false);
  const [whiteScreen, setWhiteScreen] = useState(false);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitors, setSelectedMonitors] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationTool | null>(null);
  const [notesByPage, setNotesByPage] = useState<Record<number, string[]>>({});
  // O tempo inserido é o mesmo nos dois modos: no regressivo é o total a
  // contar, no progressivo o ponto de partida. Por isso fica em um valor só.
  const [timerMode, setTimerMode] = useState<TimerMode>(() =>
    readEnum(TIMER_MODE_KEY, TIMER_MODES, "stopwatch"),
  );
  const [timerInitialTime, setTimerInitialTime] = useState<number>(() =>
    readNumber(TIMER_INITIAL_TIME_KEY, MIN_TIMER_MS, MAX_TIMER_MS, MIN_TIMER_MS),
  );

  useEffect(() => {
    writeStorage(TIMER_MODE_KEY, timerMode);
  }, [timerMode]);

  useEffect(() => {
    writeStorage(TIMER_INITIAL_TIME_KEY, String(timerInitialTime));
  }, [timerInitialTime]);

  const timerToggleRef = useRef<(() => void) | null>(null);
  const timerResetRef = useRef<(() => void) | null>(null);
  const zoomResetRef = useRef<(() => void) | null>(null);

  const registerTimerFunctions = useCallback((toggle: () => void, reset: () => void) => {
    timerToggleRef.current = toggle;
    timerResetRef.current = reset;
  }, []);

  const registerZoomReset = useCallback((reset: () => void) => {
    zoomResetRef.current = reset;
  }, []);

  const toggleTimer = useCallback(() => {
    timerToggleRef.current?.();
  }, []);

  const resetTimer = useCallback(() => {
    timerResetRef.current?.();
  }, []);

  const resetZoom = useCallback(() => {
    zoomResetRef.current?.();
  }, []);

  useEffect(() => {
    let active = true;
    listMonitors()
      .then((list) => {
        if (!active) return;
        setMonitors(list);
      })
      .catch((e) => {
        console.error("Falha ao listar os monitores", e);
      });
    getMonitorConfig()
      .then((ids) => {
        if (active) setSelectedMonitors(ids);
      })
      .catch((e) => {
        console.error("Falha ao ler os monitores marcados", e);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshMonitors = useCallback(async () => {
    const list = await listMonitors();
    setMonitors(list);
  }, []);

  const selectMonitor = useCallback((id: string) => {
    const monitor = monitors.find((m) => m.id === id);
    const prev = selectedMonitors;
    const next: string[] = monitor?.primary && !prev.includes(id)
      ? [id]
      : prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id];
    setSelectedMonitors(next);
    setMonitorConfig(next).catch((e) => {
      console.error("Falha ao salvar os monitores marcados", e);
      setError("Não foi possível salvar a seleção de monitores.");
    });
  }, [monitors, selectedMonitors]);

  // Um único monitor físico (ou nenhum, antes de a lista chegar) sempre vira
  // tela cheia local, mesmo sem seleção explícita. Com vários monitores, lista
  // vazia significa "nenhum marcado", e aí a apresentação abre a projeção no
  // primário — o fallback de startPresentation.
  const isSingleMonitor = useMemo(() => {
    if (monitors.length <= 1) return true;
    if (selectedMonitors.length === 0) return false;
    return selectedMonitors.every((id) => monitors.find((m) => m.id === id)?.primary);
  }, [selectedMonitors, monitors]);

  const loadPdfFromPath = useCallback(async (path: string) => {
    setError(null);
    try {
      const name = path.split(/[\\/]/).pop() ?? path;
      const dataUrl = await readPdfAsDataUrl(path);
      setDocPath(path);
      setDocName(name);
      setDocDataUrl(dataUrl);
      setCurrentPage(1);
      setNumPages(0);
      setNotesByPage({});
      addToHistory(path);
      await setDocument(path, name, 1);
      extractNotesFromPdf(dataUrl)
        .then((n) => setNotesByPage(n))
        .catch((e) => {
          console.error("Falha ao extrair as notas do PDF", e);
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const openPdf = useCallback(async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      title: "Abrir apresentação (PDF)",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (typeof selected === "string") {
      await loadPdfFromPath(selected);
    }
  }, [loadPdfFromPath]);

  const closeDocument = useCallback(() => {
    if (isPresenting) {
      if (isSingleMonitor) {
        getCurrentWindow()
          .setFullscreen(false)
          .catch((e) => {
            console.error("Falha ao sair da tela cheia", e);
          });
      } else {
        closeProjection().catch((e) => {
          console.error("Falha ao encerrar a tela de projeção", e);
        });
      }
      setIsPresenting(false);
    }
    // Sem isso o Rust continua com o PDF anterior no DocState e a próxima
    // projeção abriria mostrando o documento fechado.
    clearDocument().catch((e) => {
      console.error("Falha ao limpar o documento no Rust", e);
    });
    setDocPath(null);
    setDocName(null);
    setDocDataUrl(null);
    setNumPages(0);
    setCurrentPage(1);
    setError(null);
    setNotesByPage({});
    setBlackScreen(false);
    setWhiteScreen(false);
    setActiveTool(null);
  }, [isPresenting, isSingleMonitor]);

  const goToPage = useCallback(
    (page: number) => {
      const clamped = clamp(page, 1, Math.max(numPages, 1));
      setCurrentPage(clamped);
      const payload: SlideChangePayload = { page: clamped };
      void emitSafe(EVENT_SLIDE_CHANGE, payload);
      if (docPath) {
        setDocument(docPath, docName ?? "", clamped).catch((e) => {
          console.error("Falha ao sincronizar o slide com a projeção", e);
        });
      }
      resetZoom();
    },
    [numPages, docPath, docName, resetZoom],
  );

  const nextPage = useCallback(() => {
    if (currentPage < numPages) goToPage(currentPage + 1);
  }, [currentPage, numPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const broadcastPresentationState = useCallback(() => {
    void emitSafe(EVENT_SLIDE_CHANGE, { page: currentPage } satisfies SlideChangePayload);
    void emitSafe(EVENT_BLACK_SCREEN, { black: blackScreen });
    void emitSafe(EVENT_WHITE_SCREEN, { white: whiteScreen });
  }, [currentPage, blackScreen, whiteScreen]);

  // A janela de projeção só registra os listeners depois de montar. Sem
  // esperar o sinal de prontidão, o primeiro estado emitido por
  // startPresentation se perde e a projeção começa no estado inicial.
  useEffect(() => {
    let disposed = false;
    let unlistenFn: (() => void) | null = null;
    listen(EVENT_VIEWSCREEN_READY, () => broadcastPresentationState()).then((fn) => {
      if (disposed) fn();
      else unlistenFn = fn;
    });
    return () => {
      disposed = true;
      unlistenFn?.();
    };
  }, [broadcastPresentationState]);

  const startPresentation = useCallback(async () => {
    if (isSingleMonitor) {
      try {
        await getCurrentWindow().setFullscreen(true);
      } catch (e) {
        console.error("Falha ao entrar em tela cheia", e);
      }
    } else {
      try {
        const ids = selectedMonitors.length > 0
          ? selectedMonitors
          : monitors.filter((m) => m.primary).map((m) => m.id);
        await openProjections(ids);
      } catch (e) {
        console.error("Falha ao abrir a tela de projeção", e);
      }
    }
    setIsPresenting(true);
    broadcastPresentationState();
  }, [selectedMonitors, monitors, isSingleMonitor, broadcastPresentationState]);

  const stopPresentation = useCallback(async () => {
    if (isSingleMonitor) {
      try {
        await getCurrentWindow().setFullscreen(false);
      } catch (e) {
        console.error("Falha ao sair da tela cheia", e);
      }
    } else {
      try {
        await closeProjection();
      } catch (e) {
        console.error("Falha ao encerrar a tela de projeção", e);
      }
    }
    setIsPresenting(false);
    setBlackScreen(false);
    setWhiteScreen(false);
  }, [isSingleMonitor]);

  const toggleBlackScreen = useCallback(() => {
    setBlackScreen((prev) => {
      const next = !prev;
      void emitSafe(EVENT_BLACK_SCREEN, { black: next });
      if (next) {
        setWhiteScreen(false);
        void emitSafe(EVENT_WHITE_SCREEN, { white: false });
      }
      return next;
    });
  }, []);

  const toggleWhiteScreen = useCallback(() => {
    setWhiteScreen((prev) => {
      const next = !prev;
      void emitSafe(EVENT_WHITE_SCREEN, { white: next });
      if (next) {
        setBlackScreen(false);
        void emitSafe(EVENT_BLACK_SCREEN, { black: false });
      }
      return next;
    });
  }, []);

  const toggleTool = useCallback((tool: AnnotationTool) => {
    setActiveTool((prev) => (prev === tool ? null : tool));
  }, []);

  const value = useMemo<PresentationContextValue>(
    () => ({
      docPath,
      docName,
      docDataUrl,
      numPages,
      currentPage,
      error,
      isPresenting,
      isSingleMonitor,
      blackScreen,
      whiteScreen,
      monitors,
      selectedMonitors,
      notesByPage,
      refreshMonitors,
      selectMonitor,
      openPdf,
      loadPdfFromPath,
      closeDocument,
      setNumPages,
      nextPage,
      prevPage,
      goToPage,
      startPresentation,
      stopPresentation,
      toggleBlackScreen,
      toggleWhiteScreen,
      activeTool,
      toggleTool,
      setError,
      registerTimerFunctions,
      toggleTimer,
      resetTimer,
      registerZoomReset,
      resetZoom,
      timerMode,
      setTimerMode,
      timerInitialTime,
      setTimerInitialTime,
    }),
    [
      docPath,
      docName,
      docDataUrl,
      numPages,
      currentPage,
      error,
      isPresenting,
      isSingleMonitor,
      blackScreen,
      whiteScreen,
      monitors,
      selectedMonitors,
      notesByPage,
      refreshMonitors,
      selectMonitor,
      openPdf,
      loadPdfFromPath,
      closeDocument,
      nextPage,
      prevPage,
      goToPage,
      startPresentation,
      stopPresentation,
      toggleBlackScreen,
      toggleWhiteScreen,
      activeTool,
      toggleTool,
      setError,
      registerTimerFunctions,
      toggleTimer,
      resetTimer,
      registerZoomReset,
      resetZoom,
      timerMode,
      setTimerMode,
      timerInitialTime,
      setTimerInitialTime,
    ],
  );

  return (
    <PresentationContext.Provider value={value}>
      {children}
    </PresentationContext.Provider>
  );
}

export function usePresentation(): PresentationContextValue {
  const ctx = useContext(PresentationContext);
  if (!ctx) {
    throw new Error("usePresentation must be used within a PresentationProvider");
  }
  return ctx;
}
