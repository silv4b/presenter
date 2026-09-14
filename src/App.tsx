import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { PresentationProvider, usePresentation } from "@/state/presentation";
import { AnnotationsProvider, usePresenterAnnotations } from "@/state/annotations";
import { Document } from "@/lib/pdf";
import { Sidebar } from "@/components/Sidebar";
import { PdfStage } from "@/components/PdfStage";
import { SlideCarousel } from "@/components/SlideCarousel";
import { Welcome } from "@/components/Welcome";
import { AnnotationLayerContainer } from "@/components/AnnotationLayerContainer";
import { FloatingControls } from "@/components/FloatingControls";
import { PreviewPanel } from "@/components/PreviewPanel";
import { PanelRightOpen } from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAutoHide } from "@/hooks/useAutoHide";
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
    toggleTool,
    setNumPages,
    nextPage,
    prevPage,
    goToPage,
    startPresentation,
    stopPresentation,
    toggleBlackScreen,
    closeDocument,
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
  const [closeDocPending, setCloseDocPending] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [carouselHeight, setCarouselHeight] = useState(() => {
    const saved = Number(localStorage.getItem(CAROUSEL_HEIGHT_KEY));
    if (Number.isFinite(saved)) return Math.min(300, Math.max(160, saved));
    return 180;
  });

  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const confirmExitOpenRef = useRef(false);
  confirmExitOpenRef.current = confirmExitOpen;
  const closePendingRef = useRef(false);
  closePendingRef.current = closePending;
  const settingsOpenRef = useRef(false);
  settingsOpenRef.current = settingsOpen;

  useEffect(() => { localStorage.setItem(PREVIEW_WIDTH_KEY, String(previewWidth)); }, [previewWidth]);
  useEffect(() => { localStorage.setItem(PREVIEW_VISIBLE_KEY, String(showPreview)); }, [showPreview]);
  useEffect(() => { localStorage.setItem(CAROUSEL_HEIGHT_KEY, String(carouselHeight)); }, [carouselHeight]);

  const handleZoom = useCallback((delta: number) => {
    setZoom((z) => {
      const step = delta > 0 ? -ZOOM_STEP : ZOOM_STEP;
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + step));
    });
  }, []);

  const handleZoomReset = useCallback(() => setZoom(1), []);
  const handleZoomIn = useCallback(() => handleZoom(-ZOOM_STEP), [handleZoom]);
  const handleZoomOut = useCallback(() => handleZoom(ZOOM_STEP), [handleZoom]);

  const handleWheelZoom = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e.deltaY);
      }
    },
    [handleZoom],
  );

  const docDataUrlRef = useRef(docDataUrl);
  docDataUrlRef.current = docDataUrl;

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
    if (isPresenting) await stopPresentation();
    await getCurrentWindow().destroy();
  }, [isPresenting, stopPresentation]);

  const dialogOpen = confirmExitOpen || closePending || closeDocPending || settingsOpen;

  useKeyboardShortcuts({
    numPages,
    currentPage,
    isPresenting,
    docLoaded: !!docDataUrl,
    zoom,
    dialogOpen,
    nextPage,
    prevPage,
    goToPage,
    startPresentation,
    stopPresentation,
    toggleBlackScreen,
    toggleTool,
    undo: annotations.undo,
    redo: annotations.redo,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    zoomReset: handleZoomReset,
    onEscape: () => {
      if (isPresenting) setConfirmExitOpen(true);
      else if (docDataUrl) setCloseDocPending(true);
    },
  });

  const { visible: controlsVisible, show: showControls, setVisible: setControlsVisible } = useAutoHide(3000);

  useEffect(() => {
    if (isPresenting && isSingleMonitor) {
      showControls();
    } else {
      setControlsVisible(true);
    }
  }, [isPresenting, isSingleMonitor, showControls, setControlsVisible]);

  const fullscreenMode = isPresenting && isSingleMonitor && docDataUrl;

  const handleDialogArrowNav = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const container = e.currentTarget;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>("button"));
      const idx = focusable.indexOf(document.activeElement as HTMLElement);
      if (idx === -1) return;
      e.preventDefault();
      const next = e.key === "ArrowRight"
        ? (idx + 1) % focusable.length
        : (idx - 1 + focusable.length) % focusable.length;
      focusable[next].focus();
    }
    if (e.key === "Escape") e.stopPropagation();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {fullscreenMode ? (
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
                <AnnotationLayerContainer scale={scale} annotationCanvasRef={pdfCanvasRef} />
              )}
            />
          </Document>

          {blackScreen && <div className="absolute inset-0 z-10 bg-black" />}

          <FloatingControls visible={controlsVisible} onStopPresentation={() => void stopPresentation()} />
        </div>
      ) : (
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
                        <AnnotationLayerContainer scale={scale} annotationCanvasRef={pdfCanvasRef} />
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

                <PreviewPanel
                  width={previewWidth}
                  show={showPreview}
                  resizing={resizing}
                  onMouseDown={startResize}
                  onHide={() => setShowPreview(false)}
                  onOpenSettings={() => setSettingsOpen(true)}
                />

                {!showPreview && (
                  <button
                    onClick={() => setShowPreview(true)}
                    aria-label="Mostrar preview"
                    title="Mostrar preview"
                    className="absolute right-3 top-3 z-10 rounded-md bg-background/80 p-1.5 backdrop-blur-sm hover:bg-accent"
                  >
                    <PanelRightOpen className="size-4" />
                  </button>
                )}
              </>
            ) : (
              <Welcome onOpenSettings={() => setSettingsOpen(true)} />
            )}
          </main>
        </>
      )}

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

      <AlertDialog open={closePending} onOpenChange={(open) => !open && setClosePending(false)}>
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
            <AlertDialogCancel onClick={() => setClosePending(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleAppClose()}>
              Fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closeDocPending} onOpenChange={setCloseDocPending}>
        <AlertDialogContent onKeyDown={handleDialogArrowNav}>
          <AlertDialogHeader>
            <AlertDialogTitle>Voltar ao início?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento atual será fechado e as anotações feitas nesta sessão serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setCloseDocPending(false); closeDocument(); }}>
              Voltar
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
      <AnnotationsProvider>
        <PresenterShell />
      </AnnotationsProvider>
    </PresentationProvider>
  );
}
