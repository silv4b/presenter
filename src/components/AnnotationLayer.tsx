import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AnnotationStroke,
  AnnotationTool,
  ERASER_RADIUS,
  HIGHLIGHTER_COLOR,
  LASER_COLOR,
  LASER_RADIUS,
  PEN_COLOR,
  Point,
} from "@/lib/annotations";

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
  onResize?: (deltaY: number) => void;
  annotationCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  w: number,
  h: number,
  scale: number,
  strokes: AnnotationStroke[],
  laser: Point | null,
  eraserPos: Point | null,
  eraserRadius: number,
  toolCursor: Point | null,
  toolSize: number,
  toolColor: string,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  for (const s of strokes) {
    if (s.points.length === 0) continue;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size * scale;
    if (s.tool === "highlighter") ctx.globalAlpha = 0.45;
    ctx.beginPath();
    const first = s.points[0];
    ctx.moveTo(first.x * scale, first.y * scale);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x * scale, s.points[i].y * scale);
    }
    ctx.stroke();
    ctx.restore();
  }

  if (laser) {
    const x = laser.x * scale;
    const y = laser.y * scale;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.shadowColor = "rgba(255, 59, 48, 0.9)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = LASER_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, LASER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (eraserPos) {
    const x = eraserPos.x * scale;
    const y = eraserPos.y * scale;
    const r = eraserRadius * scale;
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (toolCursor) {
    const x = toolCursor.x * scale;
    const y = toolCursor.y * scale;
    const r = (toolSize / 2) * scale;
    ctx.save();
    ctx.strokeStyle = toolColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
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
  penSize = 2.5,
  highlighterSize = 18,
  onResize,
  annotationCanvasRef,
}: AnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const erasingRef = useRef(false);
  const [eraserPos, setEraserPos] = useState<Point | null>(null);
  const [toolCursor, setToolCursor] = useState<Point | null>(null);

  const drawing = activeTool === "pen" || activeTool === "highlighter";
  const toolSize = activeTool === "pen" ? penSize : activeTool === "highlighter" ? highlighterSize : 0;
  const toolColor = activeTool === "pen" ? PEN_COLOR : activeTool === "highlighter" ? HIGHLIGHTER_COLOR : "";
  const isActive = interactive && activeTool !== null;

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
    drawScene(ctx, dpr, w, h, scale, strokes, laser, eraserPos, eraserRadius, toolCursor, toolSize, toolColor);
  }, [scale, strokes, laser, eraserPos, eraserRadius, toolCursor, toolSize, toolColor]);

  const toPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      };
    },
    [scale],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    if (activeTool === "pen" || activeTool === "highlighter") {
      e.preventDefault();
      drawingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      onStrokeStart(activeTool, toPoint(e.clientX, e.clientY));
    } else if (activeTool === "laser") {
      onLaser(toPoint(e.clientX, e.clientY));
    } else if (activeTool === "eraser") {
      e.preventDefault();
      erasingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = toPoint(e.clientX, e.clientY);
      setEraserPos(p);
      onEraseStart?.(p);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const p = toPoint(e.clientX, e.clientY);
    if (drawingRef.current) {
      onStrokePoint(p);
    } else if (activeTool === "pen" || activeTool === "highlighter") {
      setToolCursor(p);
    } else if (activeTool === "laser") {
      onLaser(p);
    } else if (activeTool === "eraser") {
      setEraserPos(p);
      if (erasingRef.current) onErasePoint?.(p);
    }
  };

  const handlePointerUp = () => {
    if (!interactive) return;
    if (drawingRef.current) {
      drawingRef.current = false;
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
    if (activeTool === "eraser") setEraserPos(null);
    if (activeTool === "pen" || activeTool === "highlighter") setToolCursor(null);
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
