import type { AnnotationStroke, Point } from "./annotations";
import { LASER_COLOR, LASER_RADIUS } from "./annotations";

export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: AnnotationStroke[],
  scale: number,
) {
  for (const s of strokes) {
    if (s.points.length < 2) continue;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(s.size * scale, 0.5);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (s.tool === "highlighter") ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x * scale, s.points[0].y * scale);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x * scale, s.points[i].y * scale);
    }
    ctx.stroke();
    ctx.restore();
  }
}

export function drawLaser(
  ctx: CanvasRenderingContext2D,
  laser: Point,
  scale: number,
) {
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

export function drawEraserCursor(
  ctx: CanvasRenderingContext2D,
  pos: Point,
  radius: number,
  scale: number,
) {
  const x = pos.x * scale;
  const y = pos.y * scale;
  const r = radius * scale;
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

export function drawToolCursor(
  ctx: CanvasRenderingContext2D,
  pos: Point,
  size: number,
  color: string,
  scale: number,
) {
  const x = pos.x * scale;
  const y = pos.y * scale;
  const r = (size / 2) * scale;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
