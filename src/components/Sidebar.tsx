import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePresentation } from "@/state/presentation";
import {
  PEN_SIZE as DEFAULT_PEN,
  HIGHLIGHTER_SIZE as DEFAULT_HIGHLIGHTER,
  ERASER_RADIUS as DEFAULT_ERASER,
} from "@/lib/annotations";
import type { MonitorInfo } from "@/lib/monitors";
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  FolderOpen,
  Highlighter,
  Home,
  MonitorOff,
  MousePointer2,
  Pen,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
} from "lucide-react";
import { Timer } from "@/components/Timer";

function monitorLabel(m: MonitorInfo, index: number): string {
  const readable =
    m.name && !m.name.includes("\\") ? m.name : `Monitor ${index + 1}`;
  const primary = m.primary ? " · principal" : "";
  return `${readable} — ${m.width}×${m.height}${primary}`;
}

function formatSize(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface SidebarProps {
  penSize: number;
  highlighterSize: number;
  eraserRadius: number;
  resetToolSizes: () => void;
}

export function Sidebar({ penSize, highlighterSize, eraserRadius, resetToolSizes }: SidebarProps) {
  const {
    docName,
    numPages,
    currentPage,
    isPresenting,
    blackScreen,
    monitors,
    selectedMonitor,
    refreshMonitors,
    selectMonitor,
    openPdf,
    closeDocument,
    nextPage,
    prevPage,
    goToPage,
    startPresentation,
    stopPresentation,
    toggleBlackScreen,
    activeTool,
    toggleTool,
  } = usePresentation();

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-4 border-r border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Presenter</span>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary" onClick={openPdf} className="w-full">
            <FolderOpen className="size-4" />
            Abrir PDF
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Abrir arquivo PDF do computador</TooltipContent>
      </Tooltip>

      {docName && (
        <p className="truncate text-xs text-muted-foreground" title={docName}>
          {docName}
        </p>
      )}

      {docName && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" onClick={closeDocument} className="w-full">
              <Home className="size-4" />
              Voltar ao início
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Fechar o documento e voltar à tela inicial
          </TooltipContent>
        </Tooltip>
      )}

      <Separator />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Tela de projeção
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={refreshMonitors}
                className="size-6"
                aria-label="Atualizar monitores"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Redetectar monitores conectados
            </TooltipContent>
          </Tooltip>
        </div>

        <Select
          value={
            monitors.some((m) => m.id === selectedMonitor)
              ? (selectedMonitor ?? undefined)
              : undefined
          }
          onValueChange={selectMonitor}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecionar monitor" />
          </SelectTrigger>
          <SelectContent>
            {monitors.map((m, i) => (
              <SelectItem key={m.id} value={m.id}>
                {monitorLabel(m, i)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {docName && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="w-full"
                onClick={isPresenting ? stopPresentation : startPresentation}
              >
                {isPresenting ? (
                  <>
                    <Square className="size-4" />
                    Encerrar (F5)
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Iniciar (F5)
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isPresenting
                ? "Encerrar apresentação na tela de projeção"
                : "Abrir a tela de projeção em tela cheia"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={blackScreen ? "destructive" : "outline"}
                onClick={toggleBlackScreen}
                className="w-full"
              >
                <MonitorOff className="size-4" />
                Tela preta (B)
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Alternar tela preta no projetor
            </TooltipContent>
          </Tooltip>
        </>
      )}

      <Separator />

      {docName && numPages > 0 && (
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
      )}

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-start justify-center gap-2">
          <div className="flex flex-col items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={activeTool === "laser" ? "secondary" : "ghost"}
                  onClick={() => toggleTool("laser")}
                  aria-label="Laser"
                >
                  <MousePointer2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Laser</TooltipContent>
            </Tooltip>
            <span className="h-3 text-[10px] leading-none tabular-nums text-muted-foreground">
              &nbsp;
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={activeTool === "pen" ? "secondary" : "ghost"}
                  onClick={() => toggleTool("pen")}
                  aria-label="Caneta"
                >
                  <Pen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Caneta</TooltipContent>
            </Tooltip>
            <span className="h-3 text-[10px] leading-none tabular-nums text-muted-foreground">
              {formatSize(penSize)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={activeTool === "highlighter" ? "secondary" : "ghost"}
                  onClick={() => toggleTool("highlighter")}
                  aria-label="Marcador de texto"
                >
                  <Highlighter className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Marcador de texto</TooltipContent>
            </Tooltip>
            <span className="h-3 text-[10px] leading-none tabular-nums text-muted-foreground">
              {formatSize(highlighterSize)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={activeTool === "eraser" ? "secondary" : "ghost"}
                  onClick={() => toggleTool("eraser")}
                  aria-label="Borracha"
                >
                  <Eraser className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Borracha</TooltipContent>
            </Tooltip>
            <span className="h-3 text-[10px] leading-none tabular-nums text-muted-foreground">
              {formatSize(eraserRadius)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={resetToolSizes}
                  disabled={
                    penSize === DEFAULT_PEN &&
                    highlighterSize === DEFAULT_HIGHLIGHTER &&
                    eraserRadius === DEFAULT_ERASER
                  }
                  aria-label="Restaurar tamanhos padrão"
                >
                  <RotateCcw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Restaurar padrão</TooltipContent>
            </Tooltip>
            <span className="h-3 text-[10px] leading-none tabular-nums text-muted-foreground">
              &nbsp;
            </span>
          </div>
        </div>
        <Timer />
      </div>
    </aside>
  );
}
