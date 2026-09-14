import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { jsPDF } from "jspdf";
import { PresentationProvider, usePresentation } from "@/state/presentation";
import { usePresenterAnnotations } from "@/state/annotations";
import { Document, pdfjs } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import { PdfStage } from "@/components/PdfStage";
import { NextPreview } from "@/components/NextPreview";
import { SlideCarousel } from "@/components/SlideCarousel";
import { Welcome } from "@/components/Welcome";
import { AnnotationLayer } from "@/components/AnnotationLayer";
import { PanelRightClose, PanelRightOpen, Settings, ChevronLeft, ChevronRight, Square, MousePointer2, Pen, Highlighter, Eraser, RotateCcw, Download, Undo2, Redo2 } from "lucide-react";
import { PEN_SIZE as DEFAULT_PEN, HIGHLIGHTER_SIZE as DEFAULT_HIGHLIGHTER, ERASER_RADIUS as DEFAULT_ERASER } from "@/lib/annotations";
import type { AnnotationTool, AnnotationStroke } from "@/lib/annotations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const PREVIEW_WIDTH_KEY = "presenter.previewWidth";
const PREVIEW_VISIBLE_KEY = "presenter.previewVisible";
const CAROUSEL_HEIGHT_KEY = "presenter.carouselHeight";

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.1;

function PresenterShell() {
  const {
    docDataUrl,
    numPages,
    currentPage,
    isPresenting,
    isSingleMonitor,
    blackScreen,
    activeTool,
    toggleTool,
    setNumPages,
    nextPage,
    prevPage,
    goToPage,
    startPresentation,
    stopPresentation,
    toggleBlackScreen,
  } = usePresentation();

  const annotations = usePresenterAnnotations();

  const MIN_PREVIEW = 240;
  const MAX_PREVIEW = 512;
  const [previewWidth, setPreviewWidth] = useState(() => {
    const saved = Number(localStorage.getItem(PREVIEW_WIDTH_KEY));
    if (Number.isFinite(saved)) {
      return Math.min(MAX_PREVIEW, Math.max(MIN_PREVIEW, saved));
    }
    return MAX_PREVIEW;
  });
  const [showPreview, setShowPreview] = useState(() => {
    const saved = localStorage.getItem(PREVIEW_VISIBLE_KEY);
    return saved !== "false";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [closePending, setClosePending] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [carouselHeight, setCarouselHeight] = useState(() => {
    const saved = Number(localStorage.getItem(CAROUSEL_HEIGHT_KEY));
    if (Number.isFinite(saved)) return Math.min(300, Math.max(160, saved));
    return 180;
  });

  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawAnnotationsOnCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, strokes: AnnotationStroke[], scale: number) => {
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.save();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (stroke.tool === "highlighter") {
          ctx.globalAlpha = 0.45;
        }
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * scale, stroke.points[0].y * scale);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * scale, stroke.points[i].y * scale);
        }
        ctx.stroke();
        ctx.restore();
      }
    },
    [],
  );

  const handleExportFullPdf = useCallback(async () => {
    if (!docDataUrl) return;

    const loadingTask = pdfjs.getDocument({ url: docDataUrl });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    let pdf: InstanceType<typeof jsPDF> | null = null;

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const pw = viewport.width;
      const ph = viewport.height;

      const canvas = document.createElement("canvas");
      canvas.width = pw;
      canvas.height = ph;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, canvas, viewport }).promise;

      const strokes = annotations.strokesByPage[i] ?? [];
      if (strokes.length > 0) {
        drawAnnotationsOnCanvas(ctx, strokes, 2);
      }

      const imgData = canvas.toDataURL("image/png");
      const isLandscape = pw > ph;

      if (!pdf) {
        pdf = new jsPDF({
          unit: "px",
          format: [pw, ph],
          orientation: isLandscape ? "landscape" : "portrait",
        });
      } else {
        pdf.addPage([pw, ph], isLandscape ? "landscape" : "portrait");
      }
      pdf.addImage(imgData, "PNG", 0, 0, pw, ph);
    }

    if (!pdf) return;

    const path = await save({
      defaultPath: `apresentacao-com-anotacoes.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!path) return;

    const pdfBase64 = pdf.output("datauristring").split(",")[1];
    await invoke("save_file", { path, data: pdfBase64 });
  }, [docDataUrl, annotations.strokesByPage, drawAnnotationsOnCanvas]);

  const confirmExitOpenRef = useRef(false);
  confirmExitOpenRef.current = confirmExitOpen;
  const closePendingRef = useRef(false);
  closePendingRef.current = closePending;
  const settingsOpenRef = useRef(false);
  settingsOpenRef.current = settingsOpen;

  useEffect(() => {
    localStorage.setItem(PREVIEW_WIDTH_KEY, String(previewWidth));
  }, [previewWidth]);

  useEffect(() => {
    localStorage.setItem(PREVIEW_VISIBLE_KEY, String(showPreview));
  }, [showPreview]);

  useEffect(() => {
    localStorage.setItem(CAROUSEL_HEIGHT_KEY, String(carouselHeight));
  }, [carouselHeight]);

  const handleZoom = useCallback((delta: number) => {
    setZoom((z) => {
      const step = delta > 0 ? -ZOOM_STEP : ZOOM_STEP;
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + step));
    });
  }, []);

  const handleZoomReset = useCallback(() => setZoom(1), []);

  const handleWheelZoom = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e.deltaY);
      }
    },
    [handleZoom],
  );

  // Track latest docDataUrl for the close listener
  const docDataUrlRef = useRef(docDataUrl);
  docDataUrlRef.current = docDataUrl;

  // Listen for close request from main.tsx handler (registered once)
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    listen("app-close-requested", () => {
      if (docDataUrlRef.current) {
        setClosePending(true);
      } else {
        getCurrentWindow().destroy();
      }
    }).then((fn) => { unlistenFn = fn; });
    return () => { unlistenFn?.(); };
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
    const onMove = (ev: MouseEvent) => {
      const width = window.innerWidth - ev.clientX;
      setPreviewWidth(Math.min(MAX_PREVIEW, Math.max(MIN_PREVIEW, width)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      setResizing(false);
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const handleAppClose = useCallback(async () => {
    setClosePending(false);
    if (isPresenting) {
      await stopPresentation();
    }
    await getCurrentWindow().destroy();
  }, [isPresenting, stopPresentation]);

  const handleAppCloseCancel = useCallback(() => {
    setClosePending(false);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const dialogOpen = confirmExitOpenRef.current || closePendingRef.current || settingsOpenRef.current;
      if (dialogOpen) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        annotations.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        annotations.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        annotations.redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        handleZoom(-ZOOM_STEP);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        handleZoom(ZOOM_STEP);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        handleZoomReset();
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          e.preventDefault();
          nextPage();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          prevPage();
          break;
        case " ":
          if (zoom <= 1) {
            e.preventDefault();
            nextPage();
          }
          break;
        case "Home":
          e.preventDefault();
          goToPage(1);
          break;
        case "End":
          e.preventDefault();
          goToPage(numPages);
          break;
        case "F5":
          e.preventDefault();
          if (isPresenting) void stopPresentation();
          else void startPresentation();
          break;
        case "Escape":
          if (isPresenting) {
            e.preventDefault();
            setConfirmExitOpen(true);
          }
          break;
        case "b":
        case "B":
          if (isPresenting) toggleBlackScreen();
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    numPages,
    isPresenting,
    nextPage,
    prevPage,
    goToPage,
    startPresentation,
    stopPresentation,
    toggleBlackScreen,
    annotations.undo,
    annotations.redo,
    handleZoom,
    handleZoomReset,
    zoom,
  ]);

  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isPresenting && isSingleMonitor) {
      showControls();
    } else {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  }, [isPresenting, isSingleMonitor, showControls]);

  const fullscreenMode = isPresenting && isSingleMonitor && docDataUrl;

  const handleDialogArrowNav = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const container = e.currentTarget;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>("button"),
      );
      const idx = focusable.indexOf(document.activeElement as HTMLElement);
      if (idx === -1) return;
      e.preventDefault();
      const next =
        e.key === "ArrowRight"
          ? (idx + 1) % focusable.length
          : (idx - 1 + focusable.length) % focusable.length;
      focusable[next].focus();
    }
    if (e.key === "Escape") {
      e.stopPropagation();
    }
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {fullscreenMode ? (
        /* ── Single-monitor fullscreen presentation ── */
          <div
            className="relative h-full w-full bg-black"
            onMouseMove={showControls}
            onWheel={handleWheelZoom}
          >
          <Document
            file={docDataUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            error={<p className="p-8 text-sm text-destructive">Falha ao carregar PDF.</p>}
            loading={<p className="p-8 text-sm text-muted-foreground">Carregando documento…</p>}
            suspense={false}
            className="relative h-full"
          >
            <PdfStage
              pageNumber={currentPage}
              numPages={numPages}
              zoom={zoom}
              className="h-full"
              pdfCanvasRef={pdfCanvasRef}
              overlay={({ scale }) => (
                <AnnotationLayer
                  scale={scale}
                  activeTool={activeTool}
                  interactive
                  strokes={annotations.strokes}
                  laser={annotations.laser}
                  onStrokeStart={annotations.onStrokeStart}
                  onStrokePoint={annotations.onStrokePoint}
                  onStrokeEnd={annotations.onStrokeEnd}
                  onLaser={annotations.onLaser}
                  onEraseStart={annotations.onEraseStart}
                  onErasePoint={annotations.onErasePoint}
                  onEraseEnd={annotations.onEraseEnd}
                  onEraseAll={() => annotations.clearPage(currentPage)}
                  eraserRadius={annotations.eraserRadius}
                  penSize={annotations.penSize}
                  highlighterSize={annotations.highlighterSize}
                  onResize={annotations.adjustSize}
                  annotationCanvasRef={annotationCanvasRef}
                />
              )}
            />
          </Document>

          {/* Black screen overlay */}
          {blackScreen && (
            <div className="absolute inset-0 z-10 bg-black" />
          )}

          {/* Floating controls */}
          <div
            className={cn(
              "absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-sm transition-opacity duration-300",
              controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-white hover:bg-white/10"
              onClick={prevPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-16 px-1 text-center text-xs font-medium text-white/80 tabular-nums">
              {currentPage} / {numPages}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-white hover:bg-white/10"
              onClick={nextPage}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="size-4" />
            </Button>
            <div className="mx-1 h-5 w-px bg-white/20" />
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-white hover:bg-red-500/40"
              onClick={() => void stopPresentation()}
              title="Encerrar apresentação (Esc)"
            >
              <Square className="size-3.5" />
            </Button>
          </div>

          {/* Floating annotation tools */}
          <div
            className={cn(
              "absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-sm transition-opacity duration-300",
              controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            {([
              ["laser", MousePointer2, "Laser"],
              ["pen", Pen, "Caneta"],
              ["highlighter", Highlighter, "Marcador"],
              ["eraser", Eraser, "Borracha"],
            ] as const).map(([tool, Icon, label]) => (
              <Button
                key={tool}
                size="icon"
                variant="ghost"
                className={cn(
                  "size-8 text-white",
                  activeTool === tool ? "bg-white/20" : "hover:bg-white/10",
                )}
                onClick={() => toggleTool(tool as AnnotationTool)}
                title={label}
              >
                <Icon className="size-4" />
              </Button>
            ))}
            <div className="mx-1 h-5 w-px bg-white/20" />
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-white hover:bg-white/10"
              onClick={annotations.resetToolSizes}
              disabled={
                annotations.penSize === DEFAULT_PEN &&
                annotations.highlighterSize === DEFAULT_HIGHLIGHTER &&
                annotations.eraserRadius === DEFAULT_ERASER
              }
              title="Restaurar tamanhos padrão"
            >
              <RotateCcw className="size-3.5" />
            </Button>
            <div className="mx-1 h-5 w-px bg-white/20" />
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-white hover:bg-white/10"
              onClick={annotations.undo}
              disabled={!annotations.canUndo}
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-white hover:bg-white/10"
              onClick={annotations.redo}
              disabled={!annotations.canRedo}
              title="Refazer (Ctrl+Shift+Z)"
            >
              <Redo2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        /* ── Normal layout ── */
        <>
          <Sidebar
            penSize={annotations.penSize}
            highlighterSize={annotations.highlighterSize}
            eraserRadius={annotations.eraserRadius}
            resetToolSizes={annotations.resetToolSizes}
            undo={annotations.undo}
            redo={annotations.redo}
            canUndo={annotations.canUndo}
            canRedo={annotations.canRedo}
          />

          <main className="relative flex flex-1 overflow-hidden" onWheel={handleWheelZoom}>
            {docDataUrl ? (
              <>
                <Document
                  file={docDataUrl}
                  onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  error={<p className="p-8 text-sm text-destructive">Falha ao carregar PDF.</p>}
                  loading={<p className="p-8 text-sm text-muted-foreground">Carregando documento…</p>}
                  suspense={false}
                  className="flex min-h-0 min-w-0 flex-1 flex-col"
                >
                  <div className="relative min-h-0 flex-1">
                    <PdfStage
                      pageNumber={currentPage}
                      numPages={numPages}
                      zoom={zoom}
                      className="h-full"
                      pdfCanvasRef={pdfCanvasRef}
                      overlay={({ scale }) => (
                        <AnnotationLayer
                          scale={scale}
                          activeTool={activeTool}
                          interactive
                          strokes={annotations.strokes}
                          laser={annotations.laser}
                          onStrokeStart={annotations.onStrokeStart}
                          onStrokePoint={annotations.onStrokePoint}
                          onStrokeEnd={annotations.onStrokeEnd}
                          onLaser={annotations.onLaser}
                          onEraseStart={annotations.onEraseStart}
                          onErasePoint={annotations.onErasePoint}
                          onEraseEnd={annotations.onEraseEnd}
                          onEraseAll={() => annotations.clearPage(currentPage)}
                          eraserRadius={annotations.eraserRadius}
                          penSize={annotations.penSize}
                          highlighterSize={annotations.highlighterSize}
                          onResize={annotations.adjustSize}
                          annotationCanvasRef={annotationCanvasRef}
                        />
                      )}
                    />
                  </div>
                  <SlideCarousel
                    numPages={numPages}
                    currentPage={currentPage}
                    onSelect={goToPage}
                    height={carouselHeight}
                    onHeightChange={setCarouselHeight}
                    strokesByPage={annotations.strokesByPage}
                  />
                </Document>

                <div
                  className={cn(
                    "flex shrink-0 overflow-hidden",
                    !resizing && "transition-[width] duration-300 ease-in-out",
                  )}
                  style={{ width: showPreview ? previewWidth + 6 : 0 }}
                >
                  <div
                    onMouseDown={startResize}
                    className={cn(
                      "flex w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors hover:bg-primary/60 active:bg-primary",
                      resizing && "bg-primary/40",
                    )}
                    aria-hidden
                  >
                    <div className="h-8 w-0.5 rounded-full bg-muted-foreground/40" />
                  </div>
                  <aside
                    style={{ width: previewWidth }}
                    className="flex shrink-0 flex-col gap-3 border-l border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Próximo
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowPreview(false)}
                        aria-label="Ocultar preview"
                        title="Ocultar preview"
                      >
                        <PanelRightClose className="size-4" />
                      </Button>
                    </div>
                    {currentPage < numPages ? (
                      <button
                        type="button"
                        onClick={nextPage}
                        title="Avançar para o próximo slide"
                        className="cursor-pointer"
                      >
                        <NextPreview
                          file={docDataUrl}
                          pageNumber={currentPage + 1}
                          width={Math.max(previewWidth - 32, 0)}
                        />
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground">Fim da apresentação</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleExportFullPdf}
                    >
                      <Download className="size-3.5" />
                      Exportar PDF
                    </Button>
                    <div className="mt-auto flex justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSettingsOpen(true)}
                        aria-label="Configurações"
                        title="Configurações"
                      >
                        <Settings className="size-4" />
                      </Button>
                    </div>
                  </aside>
                </div>

                {!showPreview && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowPreview(true)}
                    aria-label="Mostrar preview"
                    title="Mostrar preview"
                    className="absolute right-3 top-3 z-10"
                  >
                    <PanelRightOpen className="size-4" />
                  </Button>
                )}
              </>
            ) : (
              <Welcome onOpenSettings={() => setSettingsOpen(true)} />
            )}
          </main>
        </>
      )}

      {/* ── Global dialogs (always mounted) ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Em breve — configurações do aplicativo.
          </p>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmExitOpen} onOpenChange={setConfirmExitOpen}>
        <AlertDialogContent onKeyDown={handleDialogArrowNav}>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar apresentação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar a apresentação?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void stopPresentation()}>
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closePending} onOpenChange={(open) => !open && handleAppCloseCancel()}>
        <AlertDialogContent onKeyDown={handleDialogArrowNav}>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar o Presenter?</AlertDialogTitle>
            <AlertDialogDescription>
              {isPresenting
                ? "Uma apresentação está aberta. Ao fechar, a projeção também será encerrada."
                : "Um documento está carregado. Deseja realmente fechar o aplicativo?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleAppCloseCancel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleAppClose()}>
              Fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function App() {
  return (
    <PresentationProvider>
      <PresenterShell />
    </PresentationProvider>
  );
}
