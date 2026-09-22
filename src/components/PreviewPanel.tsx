import { usePresentation } from "@/state/presentation";
import { usePresenterAnnotations } from "@/state/annotations";
import { exportFullPdf } from "@/lib/exportPdf";
import { Button } from "@/components/ui/button";
import { NextPreview } from "@/components/NextPreview";
import { PresenterNotes } from "@/components/PresenterNotes";
import { PanelRightClose, Settings, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewPanelProps {
  width: number;
  show: boolean;
  resizing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onHide: () => void;
  onOpenSettings: () => void;
}

export function PreviewPanel({
  width,
  show,
  resizing,
  onMouseDown,
  onHide,
  onOpenSettings,
}: PreviewPanelProps) {
  const { docDataUrl, currentPage, numPages, nextPage, notesByPage } = usePresentation();
  const { strokesByPage } = usePresenterAnnotations();

  const handleExport = () => {
    if (docDataUrl) void exportFullPdf(docDataUrl, strokesByPage);
  };

  return (
    <div
      className={cn(
        "flex shrink-0 overflow-hidden",
        !resizing && "transition-[width] duration-300 ease-in-out",
      )}
      style={{ width: show ? width + 6 : 0 }}
    >
      <div
        onMouseDown={onMouseDown}
        className={cn(
          "flex w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors hover:bg-primary/60 active:bg-primary",
          resizing && "bg-primary/40",
        )}
        aria-hidden
      >
        <div className="h-8 w-0.5 rounded-full bg-muted-foreground/40" />
      </div>
      <aside
        style={{ width }}
        className="flex shrink-0 flex-col gap-3 border-l border-border bg-card p-4"
      >
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
