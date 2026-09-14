import { useEffect, useRef } from "react";
import { Page } from "@/lib/pdf";
import { cn } from "@/lib/utils";

interface SlideCarouselProps {
  numPages: number;
  currentPage: number;
  onSelect: (page: number) => void;
}

export function SlideCarousel({
  numPages,
  currentPage,
  onSelect,
}: SlideCarouselProps) {
  const listRef = useRef<HTMLDivElement>(null);

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
    const delta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    container.scrollLeft += delta;
  };

  if (numPages <= 0) return null;

  return (
    <div
      ref={listRef}
      onWheel={onWheel}
      className="thin-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto border-t border-border bg-card px-3 py-2"
    >
      {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          data-page={p}
          onClick={() => onSelect(p)}
          title={`Ir para o slide ${p}`}
          className={cn(
            "relative shrink-0 overflow-hidden rounded-sm border-2 transition-colors",
            p === currentPage
              ? "border-primary"
              : "border-transparent hover:border-muted-foreground",
          )}
        >
          <Page
            pageNumber={p}
            height={72}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={null}
          />
          <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl-sm bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {p}
          </span>
        </button>
      ))}
    </div>
  );
}
