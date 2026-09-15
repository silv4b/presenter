import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { usePresentation } from "@/state/presentation";
import {
  applyErase,
  clamp,
  ERASER_RADIUS,
  ERASER_MIN,
  ERASER_MAX,
  ERASER_STEP,
  EVENT_ANNOTATION_STROKE,
  EVENT_ANNOTATION_LASER,
  EVENT_ANNOTATION_ERASE,
  EVENT_ANNOTATION_CLEAR,
  EVENT_ANNOTATION_CLEAR_PAGE,
  EVENT_ANNOTATION_STATE_SYNC,
  HIGHLIGHTER_COLOR,
  HIGHLIGHTER_SIZE,
  HIGHLIGHTER_MIN,
  HIGHLIGHTER_MAX,
  HIGHLIGHTER_STEP,
  PEN_COLOR,
  PEN_SIZE,
  PEN_MIN,
  PEN_MAX,
  PEN_STEP,
  type AnnotationStroke,
  type ErasePayload,
  type Point,
} from "@/lib/annotations";

let strokeSeq = 0;
function nextStrokeId() {
  strokeSeq += 1;
  return `stroke-${Date.now()}-${strokeSeq}`;
}

const MAX_HISTORY = 50;

export interface PresenterAnnotations {
  strokes: AnnotationStroke[];
  strokesByPage: Record<number, AnnotationStroke[]>;
  laser: Point | null;
  onStrokeStart: (tool: "pen" | "highlighter", point: Point) => void;
  onStrokePoint: (point: Point) => void;
  onStrokeEnd: () => void;
  onLaser: (point: Point | null) => void;
  onEraseStart: (point: Point) => void;
  onErasePoint: (point: Point) => void;
  onEraseEnd: () => void;
  clearAnnotations: () => void;
  clearPage: (page: number) => void;
  penSize: number;
  highlighterSize: number;
  eraserRadius: number;
  penColor: string;
  highlighterColor: string;
  setPenColor: (color: string) => void;
  setHighlighterColor: (color: string) => void;
  adjustSize: (deltaY: number) => void;
  resetToolSizes: () => void;
  resetColors: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const AnnotationsContext = createContext<PresenterAnnotations | null>(null);

export function AnnotationsProvider({ children }: { children: ReactNode }) {
  const { currentPage, activeTool } = usePresentation();

  const [strokesByPage, setStrokesByPage] = useState<Record<number, AnnotationStroke[]>>({});
  const [laser, setLaser] = useState<Point | null>(null);
  const [penSize, setPenSize] = useState(PEN_SIZE);
  const [highlighterSize, setHighlighterSize] = useState(HIGHLIGHTER_SIZE);
  const [eraserRadius, setEraserRadius] = useState(ERASER_RADIUS);
  const [penColor, setPenColor] = useState(PEN_COLOR);
  const [highlighterColor, setHighlighterColor] = useState(HIGHLIGHTER_COLOR);

  const penSizeRef = useRef(PEN_SIZE);
  const highlighterSizeRef = useRef(HIGHLIGHTER_SIZE);
  const eraserRadiusRef = useRef(ERASER_RADIUS);
  const eraseGestureRadiusRef = useRef(ERASER_RADIUS);

  const currentPageRef = useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { penSizeRef.current = penSize; }, [penSize]);
  useEffect(() => { highlighterSizeRef.current = highlighterSize; }, [highlighterSize]);
  useEffect(() => { eraserRadiusRef.current = eraserRadius; }, [eraserRadius]);

  const penColorRef = useRef(PEN_COLOR);
  const highlighterColorRef = useRef(HIGHLIGHTER_COLOR);
  useEffect(() => { penColorRef.current = penColor; }, [penColor]);
  useEffect(() => { highlighterColorRef.current = highlighterColor; }, [highlighterColor]);

  const activeStrokeRef = useRef<AnnotationStroke | null>(null);
  const activePointsRef = useRef<Point[]>([]);

  const strokesByPageRef = useRef<Record<number, AnnotationStroke[]>>({});
  const historyRef = useRef<Record<number, AnnotationStroke[]>[]>([{}]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((state: Record<number, AnnotationStroke[]>) => {
    const idx = historyIndexRef.current;
    const history = historyRef.current.slice(0, idx + 1);
    history.push(structuredClone(state));
    if (history.length > MAX_HISTORY) history.shift();
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const pendingRef = useRef<{ stroke?: AnnotationStroke; laser?: Point | null; clear?: boolean }>({});
  const rafRef = useRef<number | null>(null);

  const emitPending = useCallback(() => {
    rafRef.current = null;
    const p = pendingRef.current;
    pendingRef.current = {};
    if (p.clear) emit(EVENT_ANNOTATION_CLEAR).catch(() => {});
    if (p.laser !== undefined) emit(EVENT_ANNOTATION_LASER, p.laser).catch(() => {});
    if (p.stroke) emit(EVENT_ANNOTATION_STROKE, p.stroke).catch(() => {});
  }, []);

  const schedule = useCallback(
    (patch: { stroke?: AnnotationStroke; laser?: Point | null; clear?: boolean }) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(emitPending);
    },
    [emitPending],
  );

  useEffect(() => { strokesByPageRef.current = strokesByPage; }, [strokesByPage]);

  const onStrokeStart = useCallback(
    (tool: "pen" | "highlighter", point: Point) => {
      const stroke: AnnotationStroke = {
        id: nextStrokeId(),
        page: currentPageRef.current,
        tool,
        color: tool === "pen" ? penColorRef.current : highlighterColorRef.current,
        size: tool === "pen" ? penSizeRef.current : highlighterSizeRef.current,
        points: [point],
      };
      activeStrokeRef.current = stroke;
      activePointsRef.current = [point];
      const page = currentPageRef.current;
      setStrokesByPage((prev) => {
        const next = { ...prev, [page]: [...(prev[page] ?? []), stroke] };
        strokesByPageRef.current = next;
        return next;
      });
      schedule({ stroke });
    },
    [schedule],
  );

  const onStrokePoint = useCallback(
    (point: Point) => {
      const active = activeStrokeRef.current;
      if (!active) return;
      activePointsRef.current = [...activePointsRef.current, point];
      const updated: AnnotationStroke = { ...active, points: [...activePointsRef.current] };
      const page = active.page;
      const id = active.id;
      setStrokesByPage((prev) => {
        const next = {
          ...prev,
          [page]: (prev[page] ?? []).map((s) => (s.id === id ? updated : s)),
        };
        strokesByPageRef.current = next;
        return next;
      });
      schedule({ stroke: updated });
    },
    [schedule],
  );

  const onStrokeEnd = useCallback(() => {
    const snapshot = activeStrokeRef.current;
    activeStrokeRef.current = null;
    activePointsRef.current = [];
    emitPending();
    if (snapshot) pushHistory(strokesByPageRef.current);
  }, [emitPending, pushHistory]);

  const onLaser = useCallback(
    (point: Point | null) => {
      setLaser(point);
      emit(EVENT_ANNOTATION_LASER, point).catch(() => {});
    },
    [],
  );

  const erasingRef = useRef(false);
  const erasePointsRef = useRef<Point[]>([]);

  const applyEraseNow = useCallback((page: number, pts: Point[], radius: number) => {
    setStrokesByPage((prev) => applyErase(prev, page, pts, radius));
  }, []);

  const onEraseStart = useCallback(
    (point: Point) => {
      erasingRef.current = true;
      erasePointsRef.current = [point];
      eraseGestureRadiusRef.current = eraserRadiusRef.current;
      applyEraseNow(currentPageRef.current, [point], eraseGestureRadiusRef.current);
    },
    [applyEraseNow],
  );

  const onErasePoint = useCallback(
    (point: Point) => {
      if (!erasingRef.current) return;
      erasePointsRef.current = [...erasePointsRef.current, point];
      applyEraseNow(currentPageRef.current, erasePointsRef.current, eraseGestureRadiusRef.current);
    },
    [applyEraseNow],
  );

  const onEraseEnd = useCallback(() => {
    if (!erasingRef.current) return;
    erasingRef.current = false;
    const pts = erasePointsRef.current;
    erasePointsRef.current = [];
    if (pts.length > 0) {
      const payload: ErasePayload = {
        page: currentPageRef.current,
        points: pts,
        radius: eraseGestureRadiusRef.current,
      };
      emit(EVENT_ANNOTATION_ERASE, payload).catch(() => {});
      pushHistory(strokesByPageRef.current);
    }
  }, [pushHistory]);

  const clearAnnotations = useCallback(() => {
    pushHistory(strokesByPageRef.current);
    setStrokesByPage({});
    schedule({ clear: true });
  }, [schedule, pushHistory]);

  const clearPage = useCallback(
    (page: number) => {
      const current = strokesByPageRef.current;
      if (!current[page] || current[page].length === 0) return;
      pushHistory(current);
      setStrokesByPage((prev) => {
        const next = { ...prev };
        delete next[page];
        strokesByPageRef.current = next;
        return next;
      });
      emit(EVENT_ANNOTATION_CLEAR_PAGE, { page }).catch(() => {});
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const state = historyRef.current[historyIndexRef.current];
    strokesByPageRef.current = state;
    setStrokesByPage(state);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
    emit(EVENT_ANNOTATION_STATE_SYNC, state).catch(() => {});
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const state = historyRef.current[historyIndexRef.current];
    strokesByPageRef.current = state;
    setStrokesByPage(state);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    emit(EVENT_ANNOTATION_STATE_SYNC, state).catch(() => {});
  }, []);

  const adjustSize = useCallback(
    (deltaY: number) => {
      const dir = deltaY < 0 ? 1 : -1;
      if (activeTool === "pen") {
        setPenSize((s) => clamp(s + dir * PEN_STEP, PEN_MIN, PEN_MAX));
      } else if (activeTool === "highlighter") {
        setHighlighterSize((s) => clamp(s + dir * HIGHLIGHTER_STEP, HIGHLIGHTER_MIN, HIGHLIGHTER_MAX));
      } else if (activeTool === "eraser") {
        setEraserRadius((s) => clamp(s + dir * ERASER_STEP, ERASER_MIN, ERASER_MAX));
      }
    },
    [activeTool],
  );

  useEffect(() => {
    if (activeTool !== "laser" && laser) {
      setLaser(null);
      schedule({ laser: null });
    }
  }, [activeTool, laser, schedule]);

  useEffect(() => {
    setLaser(null);
    schedule({ laser: null });
  }, [currentPage, schedule]);

  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];
    const add = (p: Promise<UnlistenFn>) =>
      p.then((u) => { if (disposed) u(); else unlisteners.push(u); });

    add(listen(EVENT_ANNOTATION_CLEAR, () => {
      setStrokesByPage({});
      setLaser(null);
    }));

    add(listen<{ page: number }>(EVENT_ANNOTATION_CLEAR_PAGE, (e) => {
      setStrokesByPage((prev) => {
        const next = { ...prev };
        delete next[e.payload.page];
        return next;
      });
    }));

    return () => { disposed = true; unlisteners.forEach((u) => u()); };
  }, []);

  useEffect(() => {
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, []);

  const strokes = strokesByPage[currentPage] ?? [];

  const resetToolSizes = useCallback(() => {
    setPenSize(PEN_SIZE);
    setHighlighterSize(HIGHLIGHTER_SIZE);
    setEraserRadius(ERASER_RADIUS);
  }, []);

  const resetColors = useCallback(() => {
    setPenColor(PEN_COLOR);
    setHighlighterColor(HIGHLIGHTER_COLOR);
  }, []);

  const value: PresenterAnnotations = {
    strokes, strokesByPage, laser,
    onStrokeStart, onStrokePoint, onStrokeEnd, onLaser,
    onEraseStart, onErasePoint, onEraseEnd,
    clearAnnotations, clearPage,
    penSize, highlighterSize, eraserRadius,
    penColor, highlighterColor, setPenColor, setHighlighterColor,
    adjustSize, resetToolSizes, resetColors,
    undo, redo, canUndo, canRedo,
  };

  return (
    <AnnotationsContext.Provider value={value}>
      {children}
    </AnnotationsContext.Provider>
  );
}

export function usePresenterAnnotations(): PresenterAnnotations {
  const ctx = useContext(AnnotationsContext);
  if (!ctx) {
    throw new Error("usePresenterAnnotations must be used within an AnnotationsProvider");
  }
  return ctx;
}
