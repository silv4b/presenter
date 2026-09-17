import { useCallback, useEffect, useRef, useState } from "react";
import { Page } from "@/lib/pdf";
import { cn } from "@/lib/utils";
import type { AnnotationStroke } from "@/lib/annotations";
import { drawStrokes } from "@/lib/canvasDrawing";

interface SlideCarouselProps {
  numPages: number;
  currentPage: number;
  onSelect: (page: number) => void;
  height: number;
  onHeightChange: (height: number) => void;
  strokesByPage: Record<number, AnnotationStroke[]>;
  onResizeChange?: (resizing: boolean) => void;
}

const MIN_HEIGHT = 160;
const MAX_HEIGHT = 300;

function drawThumbnailAnnotations(
  canvas: HTMLCanvasElement,
  strokes: AnnotationStroke[],
  pageW: number,
  pageH: number,
  thumbH: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const thumbW = (pageW / pageH) * thumbH;
  canvas.width = thumbW * 2;
  canvas.height = thumbH * 2;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, thumbW, thumbH);
  drawStrokes(ctx, strokes, thumbH / pageH);
}

export function SlideCarousel({
  numPages,
  currentPage,
  onSelect,
  height,
  onHeightChange,
  strokesByPage,
  onResizeChange,
}: SlideCarouselProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const [pageDims, setPageDims] = useState<Record<number, { w: number; h: number }>>({});

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(
      `[data-page="${currentPage}"]`,
    );
    if (!el) return;
    const target =
      el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
    container.scrollTo({ left: target, behavior: "smooth" });
  }, [currentPage]);

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = listRef.current;
    if (!container) return;
    if (e.ctrlKey || e.metaKey) return;
    const delta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    container.scrollLeft += delta;
  };

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);
      onResizeChange?.(true);
      const startY = e.clientY;
      const startH = height;
      const onMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY;
        onHeightChange(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH + delta)));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        setResizing(false);
        onResizeChange?.(false);
      };
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [height, onHeightChange],
  );

  const handlePageLoad = useCallback(
    (page: number, w: number, h: number) => {
      setPageDims((prev) => {
        if (prev[page]?.w === w && prev[page]?.h === h) return prev;
        return { ...prev, [page]: { w, h } };
      });
    },
    [],
  );

  if (numPages <= 0) return null;

  return (
    <div className="flex shrink-0 flex-col border-t border-border bg-card">
      <div
        onMouseDown={startResize}
        className={cn(
          "flex h-1.5 cursor-row-resize items-center justify-center transition-colors hover:bg-primary/60 active:bg-primary",
          resizing && "bg-primary/40",
        )}
        aria-hidden
      >
        <div className="h-0.5 w-8 rounded-full bg-muted-foreground/40" />
      </div>
      <div
        ref={listRef}
        onWheel={onWheel}
        className="thin-scrollbar flex items-center gap-2 px-3"
        style={{ height, overflowX: "auto", overflowY: "hidden", paddingTop: 0, paddingBottom: 0 }}
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
          const strokes = strokesByPage[p];
          const dim = pageDims[p];
          const hasAnnotations = strokes && strokes.length > 0;
          return (
            <button
              key={p}
              type="button"
              data-page={p}
              onClick={() => onSelect(p)}
              title={`Ir para o slide ${p}`}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-sm border-2 py-1 transition-colors",
                p === currentPage
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground",
              )}
            >
              <Page
                pageNumber={p}
                height={Math.max(1, height - 66)}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={null}
                onLoadSuccess={(page) => {
                  const vp = page.getViewport({ scale: 1 });
                  handlePageLoad(p, vp.width, vp.height);
                }}
              />
              {hasAnnotations && dim && (
                <ThumbnailAnnotations
                  strokes={strokes}
                  pageW={dim.w}
                  pageH={dim.h}
                  thumbH={Math.max(1, height - 66)}
                />
              )}
              <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl-sm bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {p} / {numPages}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThumbnailAnnotations({
  strokes,
  pageW,
  pageH,
  thumbH,
}: {
  strokes: AnnotationStroke[];
  pageW: number;
  pageH: number;
  thumbH: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawThumbnailAnnotations(canvas, strokes, pageW, pageH, thumbH);
  }, [strokes, pageW, pageH, thumbH]);

  const thumbW = (pageW / pageH) * thumbH;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      style={{ width: thumbW, height: thumbH }}
    />
  );
}
