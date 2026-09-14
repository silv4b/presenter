import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Page } from "@/lib/pdf";
import { cn } from "@/lib/utils";

export interface StageMetrics {
  scale: number;
  pageSize: { w: number; h: number };
}

interface PdfStageProps {
  pageNumber: number;
  numPages: number;
  zoom?: number;
  className?: string;
  overlay?: (metrics: StageMetrics) => ReactNode;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export function PdfStage({ pageNumber, numPages, zoom = 1, className, overlay, pdfCanvasRef }: PdfStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setContainer({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && e.target === document.body) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceHeld(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [zoom, pageNumber]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!spaceHeld || zoom <= 1) return;
      e.preventDefault();
      panningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      const onMouseMove = (ev: MouseEvent) => {
        if (!panningRef.current) return;
        const dx = ev.clientX - panStartRef.current.x;
        const dy = ev.clientY - panStartRef.current.y;
        setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      };
      const onMouseUp = () => {
        panningRef.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [spaceHeld, zoom, pan.x, pan.y],
  );

  const fitScale = useMemo(() => {
    if (!pageSize || !container.w || !container.h) return null;
    const s = Math.min(container.w / pageSize.w, container.h / pageSize.h);
    return Math.max(s, 0.05);
  }, [pageSize, container]);

  const pages = useMemo(() => {
    const set = new Set<number>([pageNumber]);
    if (pageNumber > 1) set.add(pageNumber - 1);
    if (pageNumber < numPages) set.add(pageNumber + 1);
    return Array.from(set).sort((a, b) => a - b);
  }, [pageNumber, numPages]);

  const rendered =
    fitScale && pageSize
      ? { w: pageSize.w * fitScale, h: pageSize.h * fitScale }
      : null;

  const metrics: StageMetrics | null =
    fitScale && pageSize
      ? { scale: fitScale * zoom, pageSize }
      : null;

  const canPan = spaceHeld && zoom > 1;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-black",
        canPan && "cursor-grab",
        panningRef.current && "cursor-grabbing",
        className,
      )}
      onMouseDown={handleMouseDown}
    >
      <div
        style={{
          width: rendered?.w,
          height: rendered?.h,
          transform: zoom !== 1
            ? `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`
            : undefined,
          transformOrigin: "center center",
        }}
      >
        {pages.map((p) => {
          const isCurrent = p === pageNumber;
          return (
            <div
              key={p}
              className={cn(
                "flex items-center justify-center",
                isCurrent ? "relative" : "hidden",
                isCurrent && !rendered && "invisible",
              )}
              style={isCurrent && rendered ? { width: rendered.w, height: rendered.h } : undefined}
            >
              <Page
                pageNumber={p}
                scale={fitScale ?? 1}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={null}
                canvasRef={p === pageNumber ? pdfCanvasRef : undefined}
                onLoadSuccess={(page) => {
                  if (p === pageNumber) {
                    const vp = page.getViewport({ scale: 1 });
                    setPageSize((prev) =>
                      prev && prev.w === vp.width && prev.h === vp.height
                        ? prev
                        : { w: vp.width, h: vp.height },
                    );
                  }
                }}
                className="shadow-2xl shadow-black/60"
              />
              {isCurrent && metrics && overlay
                ? overlay(metrics)
                : null}
            </div>
          );
        })}
      </div>
      {!rendered && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
          Carregando slide…
        </div>
      )}
    </div>
  );
}
