import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresentation } from "@/state/presentation";
import { usePresenterAnnotations } from "@/state/annotations";
import { ColorPicker } from "@/components/ColorPicker";
import { cn } from "@/lib/utils";
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

export function AnnotationToolbar() {
  const { activeTool, toggleTool, docDataUrl } = usePresentation();
  const {
    penSize,
    highlighterSize,
    eraserRadius,
    penColor,
    highlighterColor,
    setPenColor,
    setHighlighterColor,
    resetToolSizes,
    resetColors,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePresenterAnnotations();

  const docLoaded = !!docDataUrl;
  const lastPickedRef = useRef<string | null>(null);
  const [colorResetKey, setColorResetKey] = useState(0);
  const [colorCustomized, setColorCustomized] = useState(false);

  const tools = [
    { tool: "laser" as const, Icon: MousePointer2, label: "Laser (L)", sizeLabel: "\u00a0" },
    { tool: "pen" as const, Icon: Pen, label: "Caneta (P)", sizeLabel: formatSize(penSize) },
    { tool: "highlighter" as const, Icon: Highlighter, label: "Marcador (H)", sizeLabel: formatSize(highlighterSize) },
    { tool: "eraser" as const, Icon: Eraser, label: "Borracha (E)", sizeLabel: formatSize(eraserRadius) },
  ];

  const showColorPicker = docLoaded && (activeTool === "pen" || activeTool === "highlighter");
  const isDefault = penSize === DEFAULT_PEN && highlighterSize === DEFAULT_HIGHLIGHTER && eraserRadius === DEFAULT_ERASER && !colorCustomized;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative flex items-end gap-2 pb-1", !showColorPicker && "invisible h-0 overflow-hidden")}>
        <ColorPicker
          key={`${activeTool}-${colorResetKey}`}
          value={activeTool === "pen" ? penColor : highlighterColor}
          defaultColor={activeTool === "pen" ? "#ef4444" : "#eab308"}
          onChange={(c) => {
            lastPickedRef.current = c;
            if (activeTool === "pen") setPenColor(c);
            else setHighlighterColor(c);
          }}
          onCustomize={() => setColorCustomized(true)}
        />
      </div>
      <div className="flex items-start justify-center gap-2">
        {tools.map(({ tool, Icon, label, sizeLabel }) => (
          <div key={tool} className="flex flex-col items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={activeTool === tool ? "secondary" : "ghost"}
                  onClick={() => toggleTool(tool)}
                  disabled={!docLoaded}
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
                onClick={() => { resetToolSizes(); resetColors(); lastPickedRef.current = null; setColorResetKey((k) => k + 1); setColorCustomized(false); }}
                disabled={!docLoaded || isDefault}
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
              <Button size="icon" variant="ghost" onClick={undo} disabled={!docLoaded || !canUndo} aria-label="Desfazer">
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
              <Button size="icon" variant="ghost" onClick={redo} disabled={!docLoaded || !canRedo} aria-label="Refazer">
                <Redo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Refazer (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
          <span className="h-3 text-[10px] leading-none tabular-nums text-muted-foreground">&nbsp;</span>
        </div>
      </div>
    </div>
  );
}
