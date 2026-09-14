import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresentation } from "@/state/presentation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function SlideNavigation() {
  const { docName, numPages, currentPage, nextPage, prevPage, goToPage } = usePresentation();

  if (!docName || numPages <= 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              onClick={prevPage}
              disabled={currentPage <= 1}
              aria-label="Slide anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Slide anterior (←)</TooltipContent>
        </Tooltip>

        <div className="flex items-baseline gap-1 font-mono text-sm tabular-nums">
          <input
            type="number"
            min={1}
            max={numPages}
            value={currentPage}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 1 && v <= numPages) goToPage(v);
            }}
            className="w-12 rounded-md border border-input bg-background px-2 py-1 text-center text-foreground"
            aria-label="Número do slide"
          />
          <span className="text-muted-foreground">/ {numPages}</span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              onClick={nextPage}
              disabled={currentPage >= numPages}
              aria-label="Próximo slide"
            >
              <ChevronRight className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Próximo slide (→)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
