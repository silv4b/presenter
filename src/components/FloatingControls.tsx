import { useEffect, useRef, useState } from "react";
import { usePresentation } from "@/state/presentation";
import { usePresenterAnnotations } from "@/state/annotations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/ColorPicker";
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

  const toolClass = (tool: AnnotationTool) =>
    cn("size-8 text-white", activeTool === tool ? "bg-white/20" : "hover:bg-white/10");

  const tools: [AnnotationTool, typeof MousePointer2, string][] = [
    ["laser", MousePointer2, "Laser (L)"],
    ["pen", Pen, "Caneta (P)"],
    ["highlighter", Highlighter, "Marcador (H)"],
    ["eraser", Eraser, "Borracha (E)"],
  ];

  const lastPickedRef = useRef<string | null>(null);
  const [colorResetKey, setColorResetKey] = useState(0);
  const [colorCustomized, setColorCustomized] = useState(false);

  useEffect(() => {
    if (activeTool !== "pen" && activeTool !== "highlighter") return;
    if (lastPickedRef.current === null) return;
    if (activeTool === "pen") setPenColor(lastPickedRef.current);
    else setHighlighterColor(lastPickedRef.current);
  }, [activeTool, setPenColor, setHighlighterColor]);

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

      {/* Color picker + Annotation tools */}
      <div
        className={cn(
          "absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 overflow-visible rounded-lg border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-sm transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <div
          className="relative flex h-8 items-center ml-2 mr-1"
        >
          <ColorPicker
            key={`${activeTool}-${colorResetKey}`}
            value={activeTool === "pen" ? penColor : highlighterColor}
            defaultColor={activeTool === "pen" ? "#ef4444" : "#eab308"}
            onChange={(c) => {
              lastPickedRef.current = c;
              if (activeTool === "pen") setPenColor(c);
              else if (activeTool === "highlighter") setHighlighterColor(c);
            }}
            onCustomize={() => setColorCustomized(true)}
            variant="dark"
            disabled={activeTool !== "pen" && activeTool !== "highlighter"}
          />
        </div>
        <div className="mx-1 h-5 w-px bg-white/20" />
        {tools.map(([tool, Icon, label]) => (
          <Button key={tool} size="icon" variant="ghost" className={toolClass(tool)} onClick={() => toggleTool(tool)} title={label}>
            <Icon className="size-4" />
          </Button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/20" />
        <Button
          size="icon" variant="ghost" className="size-8 text-white hover:bg-white/10"
          onClick={() => { resetToolSizes(); resetColors(); lastPickedRef.current = null; setColorResetKey((k) => k + 1); setColorCustomized(false); }}
          disabled={penSize === DEFAULT_PEN && highlighterSize === DEFAULT_HIGHLIGHTER && eraserRadius === DEFAULT_ERASER && !colorCustomized}
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
