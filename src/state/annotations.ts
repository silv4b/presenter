import { useCallback, useEffect, useRef, useState } from "react";
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

export interface PresenterAnnotations {
  strokes: AnnotationStroke[];
  laser: Point | null;
  onStrokeStart: (tool: "pen" | "highlighter", point: Point) => void;
  onStrokePoint: (point: Point) => void;
  onStrokeEnd: () => void;
  onLaser: (point: Point | null) => void;
  onEraseStart: (point: Point) => void;
  onErasePoint: (point: Point) => void;
  onEraseEnd: () => void;
  clearAnnotations: () => void;
  penSize: number;
  highlighterSize: number;
  eraserRadius: number;
  adjustSize: (deltaY: number) => void;
  resetToolSizes: () => void;
}

export function usePresenterAnnotations(): PresenterAnnotations {
  const { currentPage, activeTool } = usePresentation();

  const [strokesByPage, setStrokesByPage] = useState<Record<number, AnnotationStroke[]>>({});
  const [laser, setLaser] = useState<Point | null>(null);
  const [penSize, setPenSize] = useState(PEN_SIZE);
  const [highlighterSize, setHighlighterSize] = useState(HIGHLIGHTER_SIZE);
  const [eraserRadius, setEraserRadius] = useState(ERASER_RADIUS);

  const penSizeRef = useRef(PEN_SIZE);
  const highlighterSizeRef = useRef(HIGHLIGHTER_SIZE);
  const eraserRadiusRef = useRef(ERASER_RADIUS);
  const eraseGestureRadiusRef = useRef(ERASER_RADIUS);

  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    penSizeRef.current = penSize;
  }, [penSize]);
  useEffect(() => {
    highlighterSizeRef.current = highlighterSize;
  }, [highlighterSize]);
  useEffect(() => {
    eraserRadiusRef.current = eraserRadius;
  }, [eraserRadius]);

  const activeStrokeRef = useRef<AnnotationStroke | null>(null);
  const activePointsRef = useRef<Point[]>([]);

  const pendingRef = useRef<{
    stroke?: AnnotationStroke;
    laser?: Point | null;
    clear?: boolean;
  }>({});
  const rafRef = useRef<number | null>(null);

  const flushNow = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const p = pendingRef.current;
    pendingRef.current = {};
    if (p.clear) emit(EVENT_ANNOTATION_CLEAR).catch(() => {});
    if (p.laser !== undefined) emit(EVENT_ANNOTATION_LASER, p.laser).catch(() => {});
    if (p.stroke) emit(EVENT_ANNOTATION_STROKE, p.stroke).catch(() => {});
  }, []);

  const flush = useCallback(() => {
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
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const onStrokeStart = useCallback(
    (tool: "pen" | "highlighter", point: Point) => {
      const stroke: AnnotationStroke = {
        id: nextStrokeId(),
        page: currentPageRef.current,
        tool,
        color: tool === "pen" ? PEN_COLOR : HIGHLIGHTER_COLOR,
        size: tool === "pen" ? penSizeRef.current : highlighterSizeRef.current,
        points: [point],
      };
      activeStrokeRef.current = stroke;
      activePointsRef.current = [point];
      const page = currentPageRef.current;
      setStrokesByPage((prev) => ({
        ...prev,
        [page]: [...(prev[page] ?? []), stroke],
      }));
      schedule({ stroke });
    },
    [schedule],
  );

  const onStrokePoint = useCallback(
    (point: Point) => {
      const active = activeStrokeRef.current;
      if (!active) return;
      activePointsRef.current = [...activePointsRef.current, point];
      const updated: AnnotationStroke = {
        ...active,
        points: [...activePointsRef.current],
      };
      const page = active.page;
      const id = active.id;
      setStrokesByPage((prev) => ({
        ...prev,
        [page]: (prev[page] ?? []).map((s) => (s.id === id ? updated : s)),
      }));
      schedule({ stroke: updated });
    },
    [schedule],
  );

  const onStrokeEnd = useCallback(() => {
    activeStrokeRef.current = null;
    activePointsRef.current = [];
    flushNow();
  }, [flushNow]);

  const onLaser = useCallback(
    (point: Point | null) => {
      setLaser(point);
      schedule({ laser: point });
    },
    [schedule],
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
      applyEraseNow(
        currentPageRef.current,
        erasePointsRef.current,
        eraseGestureRadiusRef.current,
      );
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
    }
  }, []);

  const clearAnnotations = useCallback(() => {
    setStrokesByPage({});
    schedule({ clear: true });
  }, [schedule]);

  const adjustSize = useCallback(
    (deltaY: number) => {
      const dir = deltaY < 0 ? 1 : -1;
      if (activeTool === "pen") {
        setPenSize((s) => clamp(s + dir * PEN_STEP, PEN_MIN, PEN_MAX));
      } else if (activeTool === "highlighter") {
        setHighlighterSize((s) =>
          clamp(s + dir * HIGHLIGHTER_STEP, HIGHLIGHTER_MIN, HIGHLIGHTER_MAX),
        );
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
    let unlisten: UnlistenFn | null = null;
    listen(EVENT_ANNOTATION_CLEAR, () => {
      setStrokesByPage({});
      setLaser(null);
    }).then((u) => {
      if (disposed) u();
      else unlisten = u;
    });
    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const strokes = strokesByPage[currentPage] ?? [];

  const resetToolSizes = useCallback(() => {
    setPenSize(PEN_SIZE);
    setHighlighterSize(HIGHLIGHTER_SIZE);
    setEraserRadius(ERASER_RADIUS);
  }, []);

  return {
    strokes,
    laser,
    onStrokeStart,
    onStrokePoint,
    onStrokeEnd,
    onLaser,
    onEraseStart,
    onErasePoint,
    onEraseEnd,
    clearAnnotations,
    penSize,
    highlighterSize,
    eraserRadius,
    adjustSize,
    resetToolSizes,
  };
}

export interface ViewscreenAnnotations {
  strokesByPage: Record<number, AnnotationStroke[]>;
  laser: Point | null;
}

export function useViewscreenAnnotations(): ViewscreenAnnotations {
  const [strokesByPage, setStrokesByPage] = useState<Record<number, AnnotationStroke[]>>({});
  const [laser, setLaser] = useState<Point | null>(null);

  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    const add = (p: Promise<UnlistenFn>) =>
      p.then((u) => {
        if (disposed) u();
        else unlisteners.push(u);
      });

    add(
      listen<AnnotationStroke>(EVENT_ANNOTATION_STROKE, (e) => {
        const s = e.payload;
        setStrokesByPage((prev) => {
          const list = prev[s.page] ?? [];
          const idx = list.findIndex((x) => x.id === s.id);
          const updated =
            idx >= 0 ? list.map((x, i) => (i === idx ? s : x)) : [...list, s];
          return { ...prev, [s.page]: updated };
        });
      }),
    );

    add(
      listen<Point | null>(EVENT_ANNOTATION_LASER, (e) => {
        setLaser(e.payload);
      }),
    );

    add(
      listen<ErasePayload>(EVENT_ANNOTATION_ERASE, (e) => {
        const { page, points, radius } = e.payload;
        setStrokesByPage((prev) => applyErase(prev, page, points, radius));
      }),
    );

    add(
      listen(EVENT_ANNOTATION_CLEAR, () => {
        setStrokesByPage({});
        setLaser(null);
      }),
    );

    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  return { strokesByPage, laser };
}
