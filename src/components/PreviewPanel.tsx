import { usePresentation } from "@/state/presentation";
import { usePresenterAnnotations } from "@/state/annotations";
import { exportFullPdf } from "@/lib/exportPdf";
import { Button } from "@/components/ui/button";
import { NextPreview } from "@/components/NextPreview";
import { PresenterNotes } from "@/components/PresenterNotes";
import { PanelRightClose, Settings, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { clamp } from "@/lib/annotations";

export const PREVIEW_MIN_WIDTH = 320;
export const PREVIEW_MAX_WIDTH = 512;
const PREVIEW_RESIZE_STEP = 16;

interface PreviewPanelProps {
  width: number;
  show: boolean;
  resizing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onWidthChange: (width: number) => void;
  onHide: () => void;
  onOpenSettings: () => void;
}

export function PreviewPanel({
  width,
  show,
  resizing,
  onMouseDown,
  onWidthChange,
  onHide,
  onOpenSettings,
}: PreviewPanelProps) {
  const { docDataUrl, currentPage, numPages, nextPage, notesByPage } = usePresentation();
  const { strokesByPage } = usePresenterAnnotations();

  const handleExport = () => {
    if (docDataUrl) void exportFullPdf(docDataUrl, strokesByPage);
  };

  // O painel fica à direita: mover a alça para a esquerda aumenta a largura.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onWidthChange(clamp(width + PREVIEW_RESIZE_STEP, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onWidthChange(clamp(width - PREVIEW_RESIZE_STEP, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH));
    }
  };

  return (
    <div
      className={cn(
        "flex shrink-0 overflow-hidden",
        !resizing && "transition-[width] duration-300 ease-in-out",
      )}
      style={{ width: show ? width : 0 }}
    >
      <aside
        style={{ width }}
        className="relative flex shrink-0 flex-col gap-3 border-l border-sidebar-border bg-sidebar/50 p-4"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar largura do preview"
          aria-valuenow={width}
          aria-valuemin={PREVIEW_MIN_WIDTH}
          aria-valuemax={PREVIEW_MAX_WIDTH}
          tabIndex={0}
          onMouseDown={onMouseDown}
          onKeyDown={handleKeyDown}
          className={cn(
            "absolute inset-y-0 left-0 flex w-1.5 cursor-col-resize items-center justify-center transition-colors hover:bg-primary/60 active:bg-primary",
            resizing && "bg-primary/40",
          )}
        >
          <div className="h-8 w-0.5 rounded-full bg-muted-foreground/40" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Próximo
          </span>
          <Button size="icon" variant="ghost" onClick={onHide} aria-label="Ocultar preview" title="Ocultar preview (X)" className="cursor-pointer">
            <PanelRightClose className="size-4" />
          </Button>
        </div>
        {docDataUrl && currentPage < numPages ? (
          <button type="button" onClick={nextPage} title="Avançar para o próximo slide" className="cursor-pointer">
            <NextPreview file={docDataUrl} pageNumber={currentPage + 1} width={Math.max(width - 32, 0)} />
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">Fim da apresentação</p>
        )}
        <Button variant="outline" size="sm" className="w-full gap-2 cursor-pointer" onClick={handleExport}>
          <Download className="size-3.5" />
          Exportar PDF
        </Button>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notas
          </span>
          <PresenterNotes notes={notesByPage} currentPage={currentPage} />
        </div>
        <div className="mt-auto flex justify-end">
          <Button size="icon" variant="ghost" onClick={onOpenSettings} aria-label="Configurações" title="Configurações" className="cursor-pointer">
            <Settings className="size-4" />
          </Button>
        </div>
      </aside>
    </div>
  );
}
