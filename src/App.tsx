import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { PresentationProvider, usePresentation } from "@/state/presentation";
import { usePresenterAnnotations } from "@/state/annotations";
import { Document } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import { PdfStage } from "@/components/PdfStage";
import { NextPreview } from "@/components/NextPreview";
import { SlideCarousel } from "@/components/SlideCarousel";
import { Welcome } from "@/components/Welcome";
import { AnnotationLayer } from "@/components/AnnotationLayer";
import { PanelRightClose, PanelRightOpen, Settings } from "lucide-react";
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

function PresenterShell() {
  const {
    docDataUrl,
    numPages,
    currentPage,
    isPresenting,
    activeTool,
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
  const [showPreview, setShowPreview] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [closePending, setClosePending] = useState(false);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    localStorage.setItem(PREVIEW_WIDTH_KEY, String(previewWidth));
  }, [previewWidth]);

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
          e.preventDefault();
          nextPage();
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
  ]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        penSize={annotations.penSize}
        highlighterSize={annotations.highlighterSize}
        eraserRadius={annotations.eraserRadius}
        resetToolSizes={annotations.resetToolSizes}
      />

      <main className="relative flex flex-1 overflow-hidden">
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
                  className="h-full"
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
                      onEraseAll={annotations.clearAnnotations}
                      eraserRadius={annotations.eraserRadius}
                      penSize={annotations.penSize}
                      highlighterSize={annotations.highlighterSize}
                      onResize={annotations.adjustSize}
                    />
                  )}
                />
              </div>
              <SlideCarousel
                numPages={numPages}
                currentPage={currentPage}
                onSelect={goToPage}
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
                className="w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/60 active:bg-primary"
                aria-hidden
              />
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
          <AlertDialogContent>
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
          <AlertDialogContent>
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
      </main>
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
