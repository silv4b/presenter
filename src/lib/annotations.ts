export type AnnotationTool = "laser" | "pen" | "highlighter" | "eraser";

export interface Point {
  x: number;
  y: number;
}

export interface AnnotationStroke {
  id: string;
  page: number;
  tool: "pen" | "highlighter";
  color: string;
  size: number;
  points: Point[];
}

export interface ErasePayload {
  page: number;
  points: Point[];
  radius: number;
}

export const EVENT_ANNOTATION_STROKE = "anotacao-traco";
export const EVENT_ANNOTATION_LASER = "anotacao-laser";
export const EVENT_ANNOTATION_ERASE = "anotacao-apagar";
export const EVENT_ANNOTATION_CLEAR = "anotacao-limpar";
export const EVENT_ANNOTATION_CLEAR_PAGE = "anotacao-limpar-pagina";
export const EVENT_ANNOTATION_STATE_SYNC = "anotacao-sincronizar";

export const PEN_COLOR = "#ef4444";
export const PEN_SIZE = 2.5;
export const PEN_MIN = 1;
export const PEN_MAX = 24;
export const PEN_STEP = 0.5;

export const HIGHLIGHTER_COLOR = "#eab308";
export const HIGHLIGHTER_SIZE = 18;
export const HIGHLIGHTER_MIN = 6;
export const HIGHLIGHTER_MAX = 48;
export const HIGHLIGHTER_STEP = 2;

export const LASER_COLOR = "#ff3b30";
export const LASER_RADIUS = 6;

export const ERASER_RADIUS = 18;
export const ERASER_MIN = 6;
export const ERASER_MAX = 80;
export const ERASER_STEP = 2;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distPointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}

function pointHitByEraser(p: Point, eraser: Point[], radius: number): boolean {
  if (eraser.length === 0) return false;
  if (eraser.length === 1) {
    return Math.hypot(p.x - eraser[0].x, p.y - eraser[0].y) <= radius;
  }
  for (let i = 0; i < eraser.length - 1; i++) {
    if (distPointToSegment(p, eraser[i], eraser[i + 1]) <= radius) return true;
  }
  return false;
}

function eraseStroke(
  stroke: AnnotationStroke,
  eraser: Point[],
  radius: number,
): AnnotationStroke[] {
  const runs: Point[][] = [];
  let current: Point[] = [];

  for (const p of stroke.points) {
    if (pointHitByEraser(p, eraser, radius)) {
      if (current.length >= 2) runs.push(current);
      current = [];
    } else {
      current.push(p);
    }
  }
  if (current.length >= 2) runs.push(current);

  if (runs.length === 1 && runs[0].length === stroke.points.length) {
    return [stroke];
  }

  return runs.map((pts, i) => ({
    ...stroke,
    id: `${stroke.id}-e${i}`,
    points: pts,
  }));
}

export function applyErase(
  strokes: Record<number, AnnotationStroke[]>,
  page: number,
  points: Point[],
  radius: number,
): Record<number, AnnotationStroke[]> {
  const pageStrokes = strokes[page] ?? [];
  const next: AnnotationStroke[] = [];
  for (const s of pageStrokes) {
    next.push(...eraseStroke(s, points, radius));
  }
  return { ...strokes, [page]: next };
}
