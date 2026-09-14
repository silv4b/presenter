import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresentation } from "@/state/presentation";
import {
  PEN_SIZE as DEFAULT_PEN,
  HIGHLIGHTER_SIZE as DEFAULT_HIGHLIGHTER,
  ERASER_RADIUS as DEFAULT_ERASER,
} from "@/lib/annotations";
import {
  Eraser,
  Highlighter,
  MousePointer2,
  Pen,
  RotateCcw,
  Undo2,
  Redo2,
} from "lucide-react";

function formatSize(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface AnnotationToolbarProps {
  penSize: number;
  highlighterSize: number;
  eraserRadius: number;
  resetToolSizes: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function AnnotationToolbar({
  penSize,
  highlighterSize,
  eraserRadius,
  resetToolSizes,
  undo,
  redo,
  canUndo,
  canRedo,
}: AnnotationToolbarProps) {
  const { activeTool, toggleTool } = usePresentation();

  const tools = [
    { tool: "laser" as const, Icon: MousePointer2, label: "Laser (L)", sizeLabel: "\u00a0" },
    { tool: "pen" as const, Icon: Pen, label: "Caneta (P)", sizeLabel: formatSize(penSize) },
    { tool: "highlighter" as const, Icon: Highlighter, label: "Marcador (H)", sizeLabel: formatSize(highlighterSize) },
    { tool: "eraser" as const, Icon: Eraser, label: "Borracha (E)", sizeLabel: formatSize(eraserRadius) },
  ];

  return (
    <div className="flex items-start justify-center gap-2">
      {tools.map(({ tool, Icon, label, sizeLabel }) => (
        <div key={tool} className="flex flex-col items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={activeTool === tool ? "secondary" : "ghost"}
                onClick={() => toggleTool(tool)}
                aria-label={label.split(" ")[0]}
              >
                <Icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
          </Tooltip>
          <span className="h-3 text-[10px] leading-none tabular-nums text-muted-foreground">
            {sizeLabel}
          </span>
        </div>
      ))}

      <div className="flex flex-col items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={resetToolSizes}
              disabled={penSize === DEFAULT_PEN && highlighterSize === DEFAULT_HIGHLIGHTER && eraserRadius === DEFAULT_ERASER}
              aria-label="Restaurar tamanhos padrão"
            >
              <RotateCcw className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Restaurar padrão</TooltipContent>
        </Tooltip>
        <span className="h-3 text-[10px] leading-none tabular-nums text-muted-foreground">&nbsp;</span>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={undo} disabled={!canUndo} aria-label="Desfazer">
              <Undo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Desfazer (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <span className="h-3 text-[10px] leading-none tabular-nums text-muted-foreground">&nbsp;</span>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={redo} disabled={!canRedo} aria-label="Refazer">
              <Redo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Refazer (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
        <span className="h-3 text-[10px] leading-none tabular-nums text-muted-foreground">&nbsp;</span>
      </div>
    </div>
  );
}
