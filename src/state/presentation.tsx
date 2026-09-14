import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { emit } from "@tauri-apps/api/event";
import { readPdfAsDataUrl, setDocument } from "@/lib/pdf";
import {
  listMonitors,
  getMonitorConfig,
  setMonitorConfig,
  openProjection,
  closeProjection,
  type MonitorInfo,
} from "@/lib/monitors";
import {
  EVENT_SLIDE_CHANGE,
  EVENT_BLACK_SCREEN,
  type SlideChangePayload,
} from "@/lib/shared";
import type { AnnotationTool } from "@/lib/annotations";

interface PresentationContextValue {
  docPath: string | null;
  docName: string | null;
  docDataUrl: string | null;
  numPages: number;
  currentPage: number;
  loadingDoc: boolean;
  error: string | null;
  isPresenting: boolean;
  blackScreen: boolean;
  monitors: MonitorInfo[];
  selectedMonitor: string | null;
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
  activeTool: AnnotationTool | null;
  toggleTool: (tool: AnnotationTool) => void;
}

const PresentationContext = createContext<PresentationContextValue | null>(null);

export function PresentationProvider({ children }: { children: ReactNode }) {
  const [docPath, setDocPath] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [docDataUrl, setDocDataUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [blackScreen, setBlackScreen] = useState(false);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool | null>(null);

  useEffect(() => {
    let active = true;
    listMonitors()
      .then((list) => {
        if (!active) return;
        setMonitors(list);
      })
      .catch(() => {});
    getMonitorConfig()
      .then((id) => {
        if (active) setSelectedMonitor(id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const refreshMonitors = useCallback(async () => {
    const list = await listMonitors();
    setMonitors(list);
  }, []);

  const selectMonitor = useCallback((id: string) => {
    setSelectedMonitor(id);
    setMonitorConfig(id).catch(() => {});
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
  }, []);

  const loadPdfFromPath = useCallback(async (path: string) => {
    setLoadingDoc(true);
    setError(null);
    try {
      const name = path.split(/[\\/]/).pop() ?? path;
      const dataUrl = await readPdfAsDataUrl(path);
      setDocPath(path);
      setDocName(name);
      setDocDataUrl(dataUrl);
      setCurrentPage(1);
      setNumPages(0);
      await setDocument(path, name, 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingDoc(false);
    }
  }, []);

  const closeDocument = useCallback(() => {
    if (isPresenting) {
      closeProjection().catch(() => {});
      setIsPresenting(false);
    }
    setDocPath(null);
    setDocName(null);
    setDocDataUrl(null);
    setNumPages(0);
    setCurrentPage(1);
    setError(null);
  }, [isPresenting]);

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.min(Math.max(page, 1), Math.max(numPages, 1));
      setCurrentPage(clamped);
      const payload: SlideChangePayload = { page: clamped };
      emit(EVENT_SLIDE_CHANGE, payload).catch(() => {});
      if (docPath) {
        setDocument(docPath, docName ?? "", clamped).catch(() => {});
      }
    },
    [numPages, docPath, docName],
  );

  const nextPage = useCallback(() => {
    if (currentPage < numPages) goToPage(currentPage + 1);
  }, [currentPage, numPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const startPresentation = useCallback(async () => {
    try {
      await openProjection(selectedMonitor);
    } catch (e) {
      console.error("Falha ao abrir a tela de projeção", e);
    }
    setIsPresenting(true);
    emit(EVENT_SLIDE_CHANGE, { page: currentPage } satisfies SlideChangePayload).catch(
      () => {},
    );
    emit(EVENT_BLACK_SCREEN, { black: blackScreen }).catch(() => {});
  }, [currentPage, blackScreen, selectedMonitor]);

  const stopPresentation = useCallback(async () => {
    try {
      await closeProjection();
    } catch (e) {
      console.error("Falha ao encerrar a tela de projeção", e);
    }
    setIsPresenting(false);
  }, []);

  const toggleBlackScreen = useCallback(() => {
    setBlackScreen((prev) => {
      const next = !prev;
      emit(EVENT_BLACK_SCREEN, { black: next }).catch(() => {});
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
      loadingDoc,
      error,
      isPresenting,
      blackScreen,
      monitors,
      selectedMonitor,
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
      activeTool,
      toggleTool,
    }),
    [
      docPath,
      docName,
      docDataUrl,
      numPages,
      currentPage,
      loadingDoc,
      error,
      isPresenting,
      blackScreen,
      monitors,
      selectedMonitor,
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
      activeTool,
      toggleTool,
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
