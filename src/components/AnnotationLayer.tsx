import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ERASER_RADIUS,
  HIGHLIGHTER_COLOR,
  HIGHLIGHTER_SIZE,
  PEN_COLOR,
  PEN_SIZE,
  type AnnotationStroke,
  type AnnotationTool,
  type Point,
} from "@/lib/annotations";
import { drawStrokes, drawLaser, drawEraserCursor, drawToolCursor } from "@/lib/canvasDrawing";

interface AnnotationLayerProps {
  scale: number;
  activeTool: AnnotationTool | null;
  interactive: boolean;
  strokes: AnnotationStroke[];
  laser: Point | null;
  onStrokeStart: (tool: "pen" | "highlighter", point: Point) => void;
  onStrokePoint: (point: Point) => void;
  onStrokeEnd: () => void;
  onLaser: (point: Point | null) => void;
  onEraseStart?: (point: Point) => void;
  onErasePoint?: (point: Point) => void;
  onEraseEnd?: () => void;
  onEraseAll?: () => void;
  eraserRadius?: number;
  penSize?: number;
  highlighterSize?: number;
  penColor?: string;
  highlighterColor?: string;
  onResize?: (deltaY: number) => void;
  annotationCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

function withinCanvas(rect: DOMRect, clientX: number, clientY: number): boolean {
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}

function toCanvasPoint(rect: DOMRect, clientX: number, clientY: number, scale: number): Point {
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
}

function overCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number): boolean {
  const el = document.elementFromPoint(clientX, clientY);
  return !!el && (el === canvas || canvas.contains(el));
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  w: number,
  h: number,
  scale: number,
  strokes: AnnotationStroke[],
  laser: Point | null,
  cursor: Point | null,
  activeTool: AnnotationTool | null,
  eraserRadius: number,
  toolSize: number,
  toolColor: string,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  drawStrokes(ctx, strokes, scale);

  if (laser) drawLaser(ctx, laser, scale);
  if (!cursor) return;
  if (activeTool === "laser") drawLaser(ctx, cursor, scale);
  else if (activeTool === "eraser") drawEraserCursor(ctx, cursor, eraserRadius, scale);
  else drawToolCursor(ctx, cursor, toolSize, toolColor, scale);
}

export function AnnotationLayer({
  scale,
  activeTool,
  interactive,
  strokes,
  laser,
  onStrokeStart,
  onStrokePoint,
  onStrokeEnd,
  onLaser,
  onEraseStart,
  onErasePoint,
  onEraseEnd,
  onEraseAll,
  eraserRadius = ERASER_RADIUS,
  penSize = PEN_SIZE,
  highlighterSize = HIGHLIGHTER_SIZE,
  penColor = PEN_COLOR,
  highlighterColor = HIGHLIGHTER_COLOR,
  onResize,
  annotationCanvasRef,
}: AnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const erasingRef = useRef(false);
  const shiftRef = useRef(false);
  const strokeStartRef = useRef<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);

  // Acompanha a posição global do ponteiro para posicionar o cursor imediatamente ao trocar de ferramenta
  const lastMouseX = useRef(0);
  const lastMouseY = useRef(0);
  useEffect(() => {
    const handleMouseMove = (e: PointerEvent) => {
      lastMouseX.current = e.clientX;
      lastMouseY.current = e.clientY;
    };
    window.addEventListener("pointermove", handleMouseMove);
    return () => window.removeEventListener("pointermove", handleMouseMove);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const drawing = activeTool === "pen" || activeTool === "highlighter";
  const toolSize = activeTool === "pen" ? penSize : activeTool === "highlighter" ? highlighterSize : 0;
  const toolColor = activeTool === "pen" ? penColor : activeTool === "highlighter" ? highlighterColor : "";
  const isActive = interactive && activeTool !== null;

  const cursorPoint = useCallback((clientX: number, clientY: number): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!withinCanvas(rect, clientX, clientY)) return null;
    return toCanvasPoint(rect, clientX, clientY, scale);
  }, [scale]);

  useEffect(() => {
    if (!isActive) return;
    const handleMove = (e: PointerEvent) => setCursor(cursorPoint(e.clientX, e.clientY));
    window.addEventListener("pointermove", handleMove);
    // Posiciona o cursor imediatamente a partir da última posição conhecida do ponteiro
    const canvas = canvasRef.current;
    if (canvas && overCanvas(canvas, lastMouseX.current, lastMouseY.current)) {
      setCursor(toCanvasPoint(canvas.getBoundingClientRect(), lastMouseX.current, lastMouseY.current, scale));
    }
    return () => window.removeEventListener("pointermove", handleMove);
  }, [isActive, scale, cursorPoint]);

  useEffect(() => {
    if (!isActive) setCursor(null);
  }, [isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, dpr, w, h, scale, strokes, laser, cursor, activeTool, eraserRadius, toolSize, toolColor);
  }, [scale, strokes, laser, cursor, activeTool, eraserRadius, toolSize, toolColor]);

  const toPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      return toCanvasPoint(canvas.getBoundingClientRect(), clientX, clientY, scale);
    },
    [scale],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    if (activeTool === "pen" || activeTool === "highlighter") {
      e.preventDefault();
      drawingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = toPoint(e.clientX, e.clientY);
      strokeStartRef.current = p;
      onStrokeStart(activeTool, p);
    } else if (activeTool === "laser") {
      onLaser(toPoint(e.clientX, e.clientY));
    } else if (activeTool === "eraser") {
      e.preventDefault();
      erasingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = toPoint(e.clientX, e.clientY);
      setCursor(p);
      onEraseStart?.(p);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    let p = toPoint(e.clientX, e.clientY);
    if (drawingRef.current) {
      if (shiftRef.current && strokeStartRef.current) {
        const s = strokeStartRef.current;
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const angle = Math.atan2(dy, dx);
        const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.sqrt(dx * dx + dy * dy);
        p = { x: s.x + Math.cos(snapped) * dist, y: s.y + Math.sin(snapped) * dist };
      }
      onStrokePoint(p);
    } else if (drawing) {
      setCursor(p);
    } else if (activeTool === "laser") {
      onLaser(p);
    } else if (activeTool === "eraser") {
      setCursor(p);
      if (erasingRef.current) onErasePoint?.(p);
    }
  };

  const handlePointerUp = () => {
    if (!interactive) return;
    if (drawingRef.current) {
      drawingRef.current = false;
      strokeStartRef.current = null;
      onStrokeEnd();
    } else if (activeTool === "laser") {
      onLaser(null);
    } else if (activeTool === "eraser") {
      if (erasingRef.current) {
        erasingRef.current = false;
        onEraseEnd?.();
      }
    }
  };

  const handlePointerLeave = () => {
    if (!interactive) return;
    if (activeTool === "laser") onLaser(null);
    if (activeTool !== null) setCursor(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!interactive || activeTool === null) return;
    onResize?.(e.deltaY);
  };

  const handleDoubleClick = () => {
    if (!interactive || activeTool !== "eraser") return;
    onEraseAll?.();
  };

  return (
    <canvas
      ref={(node) => {
        (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = node;
        if (annotationCanvasRef) {
          (annotationCanvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = node;
        }
      }}
      className={cn(
        "absolute inset-0 h-full w-full",
        isActive ? "pointer-events-auto touch-none" : "pointer-events-none",
        drawing || activeTool === "laser" || activeTool === "eraser"
          ? "cursor-none"
          : "",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    />
  );
}
