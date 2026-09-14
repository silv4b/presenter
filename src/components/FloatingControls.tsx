import { usePresentation } from "@/state/presentation";
import { usePresenterAnnotations } from "@/state/annotations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Square,
  MousePointer2,
  Pen,
  Highlighter,
  Eraser,
  RotateCcw,
  Undo2,
  Redo2,
} from "lucide-react";
import { PEN_SIZE as DEFAULT_PEN, HIGHLIGHTER_SIZE as DEFAULT_HIGHLIGHTER, ERASER_RADIUS as DEFAULT_ERASER } from "@/lib/annotations";
import type { AnnotationTool } from "@/lib/annotations";

interface FloatingControlsProps {
  visible: boolean;
  onStopPresentation: () => void;
}

export function FloatingControls({ visible, onStopPresentation }: FloatingControlsProps) {
  const {
    currentPage,
    numPages,
    activeTool,
    toggleTool,
    nextPage,
    prevPage,
  } = usePresentation();

  const {
    penSize,
    highlighterSize,
    eraserRadius,
    resetToolSizes,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePresenterAnnotations();

  const toolClass = (tool: AnnotationTool) =>
    cn("size-8 text-white", activeTool === tool ? "bg-white/20" : "hover:bg-white/10");

  const tools: [AnnotationTool, typeof MousePointer2, string][] = [
    ["laser", MousePointer2, "Laser (L)"],
    ["pen", Pen, "Caneta (P)"],
    ["highlighter", Highlighter, "Marcador (H)"],
    ["eraser", Eraser, "Borracha (E)"],
  ];

  return (
    <>
      {/* Navigation */}
      <div
        className={cn(
          "absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-sm transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <Button size="icon" variant="ghost" className="size-8 text-white hover:bg-white/10" onClick={prevPage} disabled={currentPage <= 1}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-16 px-1 text-center text-xs font-medium text-white/80 tabular-nums">
          {currentPage} / {numPages}
        </span>
        <Button size="icon" variant="ghost" className="size-8 text-white hover:bg-white/10" onClick={nextPage} disabled={currentPage >= numPages}>
          <ChevronRight className="size-4" />
        </Button>
        <div className="mx-1 h-5 w-px bg-white/20" />
        <Button size="icon" variant="ghost" className="size-8 text-white hover:bg-red-500/40" onClick={onStopPresentation} title="Encerrar apresentação (Esc)">
          <Square className="size-3.5" />
        </Button>
      </div>

      {/* Annotation tools */}
      <div
        className={cn(
          "absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-sm transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {tools.map(([tool, Icon, label]) => (
          <Button key={tool} size="icon" variant="ghost" className={toolClass(tool)} onClick={() => toggleTool(tool)} title={label}>
            <Icon className="size-4" />
          </Button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/20" />
        <Button
          size="icon" variant="ghost" className="size-8 text-white hover:bg-white/10"
          onClick={resetToolSizes}
          disabled={penSize === DEFAULT_PEN && highlighterSize === DEFAULT_HIGHLIGHTER && eraserRadius === DEFAULT_ERASER}
          title="Restaurar tamanhos padrão"
        >
          <RotateCcw className="size-3.5" />
        </Button>
        <div className="mx-1 h-5 w-px bg-white/20" />
        <Button size="icon" variant="ghost" className="size-8 text-white hover:bg-white/10" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
          <Undo2 className="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-8 text-white hover:bg-white/10" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)">
          <Redo2 className="size-3.5" />
        </Button>
      </div>
    </>
  );
}
