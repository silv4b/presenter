import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { PresentationProvider, usePresentation } from "@/state/presentation";
import { AnnotationsProvider, usePresenterAnnotations } from "@/state/annotations";
import { Document } from "@/lib/pdf";
import { Sidebar } from "@/components/Sidebar";
import { PdfStage, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "@/components/PdfStage";
import { SlideCarousel, CAROUSEL_MIN_HEIGHT, CAROUSEL_MAX_HEIGHT, CAROUSEL_DEFAULT_HEIGHT } from "@/components/SlideCarousel";
import { Welcome } from "@/components/Welcome";
import { AnnotationLayerContainer } from "@/components/AnnotationLayerContainer";
import { FloatingControls } from "@/components/FloatingControls";
import { PreviewPanel, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH } from "@/components/PreviewPanel";
import { PanelRightOpen, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { clamp } from "@/lib/annotations";
import { readBoolean, readNumber, writeStorage } from "@/lib/storage";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAutoHide } from "@/hooks/useAutoHide";
import { useSettings } from "@/hooks/useSettings";
import { SettingsDialog } from "@/components/SettingsDialog";
import { EVENT_APP_CLOSE_REQUESTED, EVENT_VIEWSCREEN_READY, EVENT_ZOOM_CHANGE, emitSafe } from "@/lib/shared";
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
const CAROUSEL_VISIBLE_KEY = "presenter.carouselVisible";
const SIDEBAR_VISIBLE_KEY = "presenter.sidebarVisible";

const ZOOM_DEFAULT = 1;
const MS_PER_SECOND = 1000;
const SIDEBAR_WIDTH = 320; // w-80 = 320px

function PresenterShell() {
  const {
    docDataUrl,
    numPages,
    currentPage,
    isPresenting,
    isSingleMonitor,
    blackScreen,
    whiteScreen,
    error,
    setError,
    toggleTool,
    setNumPages,
    nextPage,
    prevPage,
    goToPage,
    startPresentation,
    stopPresentation,
    toggleBlackScreen,
    toggleWhiteScreen,
    closeDocument,
    openPdf,
    toggleTimer,
    resetTimer,
    registerZoomReset,
  } = usePresentation();

  const annotations = usePresenterAnnotations();
  const { backgroundColor, setBackgroundColor, alwaysShowFloatingControls, setAlwaysShowFloatingControls, floatingControlsTimeout, setFloatingControlsTimeout, theme, setTheme } = useSettings();

  const [previewWidth, setPreviewWidth] = useState(() =>
    readNumber(PREVIEW_WIDTH_KEY, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH, PREVIEW_MAX_WIDTH),
  );
  const sidebarWidth = SIDEBAR_WIDTH;
  const [showPreview, setShowPreview] = useState(() =>
    readBoolean(PREVIEW_VISIBLE_KEY, true),
  );
  const [showSidebar, setShowSidebar] = useState(() =>
    readBoolean(SIDEBAR_VISIBLE_KEY, true),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [closePending, setClosePending] = useState(false);
  const [closeDocPending, setCloseDocPending] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [carouselHeight, setCarouselHeight] = useState(() =>
    readNumber(CAROUSEL_HEIGHT_KEY, CAROUSEL_MIN_HEIGHT, CAROUSEL_MAX_HEIGHT, CAROUSEL_DEFAULT_HEIGHT),
  );
  const [showCarousel, setShowCarousel] = useState(() =>
    readBoolean(CAROUSEL_VISIBLE_KEY, true),
  );
  const [carouselResizing, setCarouselResizing] = useState(false);

  const previewResizeCleanupRef = useRef<(() => void) | null>(null);

  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => { writeStorage(PREVIEW_WIDTH_KEY, String(previewWidth)); }, [previewWidth]);
  useEffect(() => { writeStorage(PREVIEW_VISIBLE_KEY, String(showPreview)); }, [showPreview]);
  useEffect(() => { writeStorage(SIDEBAR_VISIBLE_KEY, String(showSidebar)); }, [showSidebar]);
  useEffect(() => { writeStorage(CAROUSEL_HEIGHT_KEY, String(carouselHeight)); }, [carouselHeight]);
  useEffect(() => { writeStorage(CAROUSEL_VISIBLE_KEY, String(showCarousel)); }, [showCarousel]);

  // Um giro de wheel manda valores grandes (tipicamente ±100 por "clique"), então
  // usamos apenas o *sinal* do delta e avançamos um passo fixo. Somar o valor
  // bruto saturaria o zoom no mínimo/máximo a cada giro. Delta positivo = aproximar.
  const handleZoom = useCallback((delta: number) => {
    if (delta === 0) return;
    const step = delta > 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((z) => clamp(z + step, ZOOM_MIN, ZOOM_MAX));
  }, []);

  const handleZoomReset = useCallback(() => setZoom(ZOOM_DEFAULT), []);
  const handleZoomIn = useCallback(() => handleZoom(1), [handleZoom]);
  const handleZoomOut = useCallback(() => handleZoom(-1), [handleZoom]);

  const docDataUrlRef = useRef(docDataUrl);
  docDataUrlRef.current = docDataUrl;

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const isPresentingRef = useRef(isPresenting);
  isPresentingRef.current = isPresenting;
  const isSingleMonitorRef = useRef(isSingleMonitor);
  isSingleMonitorRef.current = isSingleMonitor;

  // O zoom é estado local do presente; durante a apresentação em dois monitores
  // ele precisa chegar à projeção, senão a telona fica presa no ajuste à tela.
  useEffect(() => {
    if (!isPresenting || isSingleMonitor) return;
    void emitSafe(EVENT_ZOOM_CHANGE, { zoom });
  }, [zoom, isPresenting, isSingleMonitor]);

  // Reenvia o zoom quando a projeção avisa que ficou pronta: se o presenter já
  // estava com zoom diferente de 1 ao começar, a projeção recém-aberta não tem
  // como saber. O mesmo handshake do slide já é feito na camada de apresentação.
  useEffect(() => {
    let disposed = false;
    let unlistenFn: (() => void) | null = null;
    listen(EVENT_VIEWSCREEN_READY, () => {
      if (disposed) return;
      if (!isPresentingRef.current || isSingleMonitorRef.current) return;
      void emitSafe(EVENT_ZOOM_CHANGE, { zoom: zoomRef.current });
    })
      .then((fn) => {
        if (disposed) fn();
        else unlistenFn = fn;
      })
      .catch((e) => {
        console.error("Falha ao escutar o sinal de prontidão da projeção", e);
      });
    return () => {
      disposed = true;
      unlistenFn?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlistenFn: (() => void) | null = null;
    listen(EVENT_APP_CLOSE_REQUESTED, () => {
      if (docDataUrlRef.current) {
        setClosePending(true);
      } else {
        getCurrentWindow().destroy();
      }
    })
      .then((fn) => {
        if (disposed) fn();
        else unlistenFn = fn;
      })
      .catch((e) => {
        // Sem listener não há quem atenda o pedido de fechamento, e o `emit` do
        // `main.tsx` ainda resolve normalmente porque o evento é broadcast. Sem
        // este `destroy` a janela ficaria presa: encerrar sem confirmação é
        // melhor do que travar o app.
        console.error("Falha ao escutar o pedido de fechamento", e);
        getCurrentWindow().destroy();
      });
    return () => {
      disposed = true;
      unlistenFn?.();
    };
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
    const onMove = (ev: MouseEvent) => {
      const width = window.innerWidth - ev.clientX;
      setPreviewWidth(clamp(width, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH));
    };
    const cleanup = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    const onUp = () => {
      previewResizeCleanupRef.current = null;
      setResizing(false);
      cleanup();
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    previewResizeCleanupRef.current = cleanup;
  }, []);

  useEffect(() => {
    return () => {
      previewResizeCleanupRef.current?.();
    };
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
    toggleWhiteScreen,
    toggleTool,
    undo: annotations.undo,
    redo: annotations.redo,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    zoomReset: handleZoomReset,
    registerZoomReset,
    onEscape: () => {
      if (isPresenting) setConfirmExitOpen(true);
      else if (docDataUrl) setCloseDocPending(true);
    },
    openPdf,
    toggleSidebar: () => setShowSidebar((v) => !v),
    togglePreview: () => setShowPreview((v) => !v),
    toggleCarousel: () => setShowCarousel((v) => !v),
    toggleTimer,
    resetTimer,
  });

  const { visible: controlsVisible, show: showControls, setVisible: setControlsVisible, clear: clearAutoHide } = useAutoHide(floatingControlsTimeout * MS_PER_SECOND);

  useEffect(() => {
    if (alwaysShowFloatingControls) {
      clearAutoHide();
      setControlsVisible(true);
    } else if (isPresenting && isSingleMonitor) {
      showControls();
    } else {
      setControlsVisible(true);
    }
  }, [isPresenting, isSingleMonitor, showControls, setControlsVisible, alwaysShowFloatingControls, clearAutoHide]);

  const fullscreenMode = isPresenting && isSingleMonitor && docDataUrl;

  const handleMouseMove = useCallback(() => {
    if (!alwaysShowFloatingControls) showControls();
  }, [alwaysShowFloatingControls, showControls]);

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
          className="relative h-full w-full"
          style={{ backgroundColor }}
          onMouseMove={handleMouseMove}
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
              backgroundColor={backgroundColor}
              onWheelZoom={(d) => handleZoom(-d)}
              overlay={({ scale }) => (
                <AnnotationLayerContainer scale={scale} annotationCanvasRef={annotationCanvasRef} />
              )}
            />
          </Document>

          {blackScreen && <div className="absolute inset-0 z-10 bg-black" />}
          {whiteScreen && <div className="absolute inset-0 z-10 bg-white" />}

          <FloatingControls visible={controlsVisible} onStopPresentation={() => setConfirmExitOpen(true)} />
        </div>
      ) : (
        <>
          <Sidebar onClose={() => setShowSidebar(false)} width={sidebarWidth} show={showSidebar} />

          <main className="relative flex flex-1 overflow-hidden">
            {!showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                aria-label="Mostrar sidebar"
                title="Mostrar sidebar (Z)"
                className="absolute left-3 top-3 z-10 rounded-md bg-background/80 p-1.5 backdrop-blur-sm hover:bg-accent cursor-pointer"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            )}
            {docDataUrl ? (
              <>
                <Document
                  file={docDataUrl}
                  onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  onLoadError={(err) => { console.error("PDF load error:", err); setError(err.message); }}
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
                      backgroundColor={backgroundColor}
                      onWheelZoom={(d) => handleZoom(-d)}
                      overlay={({ scale }) => (
                        <AnnotationLayerContainer scale={scale} annotationCanvasRef={annotationCanvasRef} />
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "overflow-hidden",
                      !carouselResizing && "transition-[height] duration-300 ease-in-out",
                    )}
                    style={{ height: showCarousel ? carouselHeight + 6 : 0 }}
                  >
                    <SlideCarousel
                      numPages={numPages}
                      currentPage={currentPage}
                      onSelect={goToPage}
                      height={carouselHeight}
                      onHeightChange={setCarouselHeight}
                      strokesByPage={annotations.strokesByPage}
                      onResizeChange={setCarouselResizing}
                    />
                  </div>
                </Document>

                <PreviewPanel
                  width={previewWidth}
                  show={showPreview}
                  resizing={resizing}
                  onMouseDown={startResize}
                  onWidthChange={setPreviewWidth}
                  onHide={() => setShowPreview(false)}
                  onOpenSettings={() => setSettingsOpen(true)}
                />

                {!showPreview && (
                  <button
                    onClick={() => setShowPreview(true)}
                    aria-label="Mostrar preview"
                    title="Mostrar preview"
                    className="absolute right-3 top-3 z-10 rounded-md bg-background/80 p-1.5 backdrop-blur-sm hover:bg-accent cursor-pointer"
                  >
                    <PanelRightOpen className="size-4" />
                  </button>
                )}
              </>
            ) : (
              <>
                {error && (
                  <div className="flex h-full items-center justify-center p-8 text-center">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
                <Welcome onOpenSettings={() => setSettingsOpen(true)} />
              </>
            )}
          </main>
        </>
      )}

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        backgroundColor={backgroundColor}
        onBackgroundColorChange={setBackgroundColor}
        alwaysShowFloatingControls={alwaysShowFloatingControls}
        onAlwaysShowFloatingControlsChange={setAlwaysShowFloatingControls}
        floatingControlsTimeout={floatingControlsTimeout}
        onFloatingControlsTimeoutChange={setFloatingControlsTimeout}
        theme={theme}
        onThemeChange={setTheme}
      />

      <AlertDialog open={confirmExitOpen} onOpenChange={setConfirmExitOpen}>
        <AlertDialogContent onKeyDown={handleDialogArrowNav}>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar apresentação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar a apresentação?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={() => void stopPresentation()}>
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
            <AlertDialogCancel className="cursor-pointer" onClick={() => setClosePending(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={() => void handleAppClose()}>
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
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={() => { setCloseDocPending(false); closeDocument(); }}>
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
