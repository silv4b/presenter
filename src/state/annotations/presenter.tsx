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
import { readHexColor, readRaw, writeStorage } from "@/lib/storage";
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
import { emitSafe } from "@/lib/shared";

let strokeSeq = 0;
function nextStrokeId() {
  strokeSeq += 1;
  return `stroke-${Date.now()}-${strokeSeq}`;
}

// Limite da pilha de desfazer/refazer de anotações. Não confundir com o
// histórico de arquivos, que tem outro limite em `lib/fileHistory.ts`.
const MAX_UNDO_HISTORY = 50;

const STORAGE_PREFIX = "presenter.";
const LEGACY_PREFIX = "presenter:";

const PEN_SIZE_KEY = "presenter.penSize";
const HIGHLIGHTER_SIZE_KEY = "presenter.highlighterSize";
const ERASER_RADIUS_KEY = "presenter.eraserRadius";
const PEN_COLOR_KEY = "presenter.penColor";
const HIGHLIGHTER_COLOR_KEY = "presenter.highlighterColor";

function readToolSize(key: string, fallback: number, min: number, max: number): number {
  // As chaves legadas usavam "presenter:" em vez de "presenter.". Só são lidas
  // para não perder o tamanho escolhido por quem já usou uma versão anterior.
  // O valor é limitado ao intervalo da ferramenta, como em `readNumber`: um
  // localStorage adulterado não deve escapar do mínimo/máximo.
  const legacyKey = LEGACY_PREFIX + key.slice(STORAGE_PREFIX.length);
  const raw = readRaw(key) ?? (legacyKey === key ? null : readRaw(legacyKey));
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

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
  const { currentPage, activeTool, docPath } = usePresentation();

  const [strokesByPage, setStrokesByPage] = useState<Record<number, AnnotationStroke[]>>({});
  const [laser, setLaser] = useState<Point | null>(null);
  const [penSize, setPenSize] = useState(() =>
    readToolSize(PEN_SIZE_KEY, PEN_SIZE, PEN_MIN, PEN_MAX),
  );
  const [highlighterSize, setHighlighterSize] = useState(() =>
    readToolSize(HIGHLIGHTER_SIZE_KEY, HIGHLIGHTER_SIZE, HIGHLIGHTER_MIN, HIGHLIGHTER_MAX),
  );
  const [eraserRadius, setEraserRadius] = useState(() =>
    readToolSize(ERASER_RADIUS_KEY, ERASER_RADIUS, ERASER_MIN, ERASER_MAX),
  );
  const [penColor, setPenColor] = useState(() => readHexColor(PEN_COLOR_KEY, PEN_COLOR));
  const [highlighterColor, setHighlighterColor] = useState(() =>
    readHexColor(HIGHLIGHTER_COLOR_KEY, HIGHLIGHTER_COLOR),
  );

  const penSizeRef = useRef(PEN_SIZE);
  const highlighterSizeRef = useRef(HIGHLIGHTER_SIZE);
  const eraserRadiusRef = useRef(ERASER_RADIUS);
  const eraseGestureRadiusRef = useRef(ERASER_RADIUS);

  const currentPageRef = useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { penSizeRef.current = penSize; }, [penSize]);
  useEffect(() => { highlighterSizeRef.current = highlighterSize; }, [highlighterSize]);
  useEffect(() => { eraserRadiusRef.current = eraserRadius; }, [eraserRadius]);

  useEffect(() => {
    writeStorage(PEN_SIZE_KEY, String(penSize));
  }, [penSize]);
  useEffect(() => {
    writeStorage(HIGHLIGHTER_SIZE_KEY, String(highlighterSize));
  }, [highlighterSize]);
  useEffect(() => {
    writeStorage(ERASER_RADIUS_KEY, String(eraserRadius));
  }, [eraserRadius]);

  const penColorRef = useRef(penColor);
  const highlighterColorRef = useRef(highlighterColor);
  useEffect(() => { penColorRef.current = penColor; }, [penColor]);
  useEffect(() => { highlighterColorRef.current = highlighterColor; }, [highlighterColor]);
  useEffect(() => {
    writeStorage(PEN_COLOR_KEY, penColor);
  }, [penColor]);
  useEffect(() => {
    writeStorage(HIGHLIGHTER_COLOR_KEY, highlighterColor);
  }, [highlighterColor]);

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
    if (history.length > MAX_UNDO_HISTORY) history.shift();
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
    if (p.clear) void emitSafe(EVENT_ANNOTATION_CLEAR);
    if (p.laser !== undefined) void emitSafe(EVENT_ANNOTATION_LASER, p.laser);
    if (p.stroke) void emitSafe(EVENT_ANNOTATION_STROKE, p.stroke);
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
      schedule({ laser: point });
    },
    [schedule],
  );

  const erasingRef = useRef(false);
  const erasePointsRef = useRef<Point[]>([]);
  // Estado das anotações no início do gesto de borracha. Cada ponto é aplicado
  // sobre esta base (e não sobre o resultado do ponto anterior), garantindo que
  // o resultado final seja idêntico a aplicar o caminho inteiro uma única vez —
  // que é exatamente o que a projeção faz ao receber EVENT_ANNOTATION_ERASE.
  const eraseBaseRef = useRef<Record<number, AnnotationStroke[]>>({});

  const applyEraseNow = useCallback((page: number, pts: Point[], radius: number) => {
    setStrokesByPage(() => {
      const next = applyErase(eraseBaseRef.current, page, pts, radius);
      strokesByPageRef.current = next;
      return next;
    });
  }, []);

  const onEraseStart = useCallback(
    (point: Point) => {
      erasingRef.current = true;
      erasePointsRef.current = [point];
      eraseGestureRadiusRef.current = eraserRadiusRef.current;
      eraseBaseRef.current = strokesByPageRef.current;
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
      void emitSafe(EVENT_ANNOTATION_ERASE, payload);
      pushHistory(strokesByPageRef.current);
    }
  }, [pushHistory]);

  const clearAnnotations = useCallback(() => {
    const next: Record<number, AnnotationStroke[]> = {};
    strokesByPageRef.current = next;
    setStrokesByPage(next);
    schedule({ clear: true });
    // Empilha o estado *depois* da limpeza, como o traço e a borracha fazem.
    // Assim `history[index]` sempre reflete o que está na tela e o refazer
    // consegue reaplicar a limpeza.
    pushHistory(next);
  }, [schedule, pushHistory]);

  const clearPage = useCallback(
    (page: number) => {
      const current = strokesByPageRef.current;
      if (!current[page] || current[page].length === 0) return;
      const next = { ...current };
      delete next[page];
      strokesByPageRef.current = next;
      setStrokesByPage(next);
      void emitSafe(EVENT_ANNOTATION_CLEAR_PAGE, { page });
      pushHistory(next);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const state = historyRef.current[historyIndexRef.current];
    strokesByPageRef.current = state;
    setStrokesByPage(state);
    setLaser(null);
    schedule({ laser: null });
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
    void emitSafe(EVENT_ANNOTATION_STATE_SYNC, state);
  }, [schedule]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const state = historyRef.current[historyIndexRef.current];
    strokesByPageRef.current = state;
    setStrokesByPage(state);
    setLaser(null);
    schedule({ laser: null });
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    void emitSafe(EVENT_ANNOTATION_STATE_SYNC, state);
  }, [schedule]);

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

  // Trocar de documento (ou fechá-lo) zera as anotações e também a pilha de
  // desfazer/refazer, para que o Ctrl+Z não restaure traços do documento
  // anterior. O estado local segue `docPath`, então o broadcast para a projeção
  // também sai daqui — o presenter não escuta este evento, logo não há eco.
  useEffect(() => {
    setStrokesByPage({});
    strokesByPageRef.current = {};
    setLaser(null);
    historyRef.current = [{}];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
    void emitSafe(EVENT_ANNOTATION_CLEAR);
  }, [docPath]);

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

  const value = useMemo<PresenterAnnotations>(
    () => ({
      strokes,
      strokesByPage,
      laser,
      onStrokeStart,
      onStrokePoint,
      onStrokeEnd,
      onLaser,
      onEraseStart,
      onErasePoint,
      onEraseEnd,
      clearAnnotations,
      clearPage,
      penSize,
      highlighterSize,
      eraserRadius,
      penColor,
      highlighterColor,
      setPenColor,
      setHighlighterColor,
      adjustSize,
      resetToolSizes,
      resetColors,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [
      strokes,
      strokesByPage,
      laser,
      onStrokeStart,
      onStrokePoint,
      onStrokeEnd,
      onLaser,
      onEraseStart,
      onErasePoint,
      onEraseEnd,
      clearAnnotations,
      clearPage,
      penSize,
      highlighterSize,
      eraserRadius,
      penColor,
      highlighterColor,
      adjustSize,
      resetToolSizes,
      resetColors,
      undo,
      redo,
      canUndo,
      canRedo,
    ],
  );

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
