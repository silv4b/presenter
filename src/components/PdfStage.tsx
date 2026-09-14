import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Page } from "@/lib/pdf";
import { cn } from "@/lib/utils";

export interface StageMetrics {
  scale: number;
  pageSize: { w: number; h: number };
}

interface PdfStageProps {
  pageNumber: number;
  numPages: number;
  className?: string;
  overlay?: (metrics: StageMetrics) => ReactNode;
}

export function PdfStage({ pageNumber, numPages, className, overlay }: PdfStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);

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

  const scale = useMemo(() => {
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
    scale && pageSize
      ? { w: pageSize.w * scale, h: pageSize.h * scale }
      : null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-black",
        className,
      )}
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
              scale={scale ?? 1}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={null}
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
            {isCurrent && scale && pageSize && overlay
              ? overlay({ scale, pageSize })
              : null}
          </div>
        );
      })}
      {!rendered && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
          Carregando slide…
        </div>
      )}
    </div>
  );
}
