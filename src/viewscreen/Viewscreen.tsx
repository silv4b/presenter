import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Document, readPdfAsDataUrl, getDocument } from "@/lib/pdf";
import { PdfStage } from "@/components/PdfStage";
import { AnnotationLayer } from "@/components/AnnotationLayer";
import { useViewscreenAnnotations } from "@/state/annotations";
import {
  EVENT_SLIDE_CHANGE,
  EVENT_ZOOM_CHANGE,
  EVENT_BLACK_SCREEN,
  EVENT_WHITE_SCREEN,
  EVENT_VIEWSCREEN_READY,
  emitSafe,
  type SlideChangePayload,
} from "@/lib/shared";
import { BG_COLOR_KEY, DEFAULT_BG_COLOR, THEME_KEY } from "@/hooks/useSettings";
import { readHexColor, readRaw } from "@/lib/storage";

export default function Viewscreen() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [black, setBlack] = useState(false);
  const [white, setWhite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mesma validação do presenter: um hex inválido quebraria o style do palco.
  const [bgColor, setBgColor] = useState(() => readHexColor(BG_COLOR_KEY, DEFAULT_BG_COLOR));
  const { strokesByPage, laser } = useViewscreenAnnotations();

  useEffect(() => {
    let active = true;
    getDocument()
      .then(async (doc) => {
        if (!active) return;
        if (!doc) return;
        setPage(doc.page || 1);
        return readPdfAsDataUrl(doc.path);
      })
      .then((url) => {
        if (active && url) setDataUrl(url);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    const listeners = [
      listen<SlideChangePayload>(EVENT_SLIDE_CHANGE, (e) => setPage(e.payload.page)),
      listen<{ zoom: number }>(EVENT_ZOOM_CHANGE, (e) => setZoom(e.payload.zoom)),
      listen<{ black: boolean }>(EVENT_BLACK_SCREEN, (e) => setBlack(e.payload.black)),
      listen<{ white: boolean }>(EVENT_WHITE_SCREEN, (e) => setWhite(e.payload.white)),
    ];

    // Só avisa depois que os quatro listeners acima existem: é o que garante que
    // o reenvio de slide/zoom/preto/branco feito pelo presenter não seja perdido.
    Promise.all(listeners).then((resolved) => {
      if (disposed) {
        resolved.forEach((u) => u());
        return;
      }
      unlisteners.push(...resolved);
      void emitSafe(EVENT_VIEWSCREEN_READY);
    });

    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  // A projeção não passa pelo useSettings, então o tema nunca chegava nela.
  // O localStorage é compartilhado entre as duas janelas.
  useEffect(() => {
    const applyTheme = (value: string | null) => {
      document.documentElement.classList.toggle("dark", value === "dark");
    };
    applyTheme(readRaw(THEME_KEY));
    const handleStorage = (e: StorageEvent) => {
      if (e.key === BG_COLOR_KEY) {
        setBgColor(readHexColor(BG_COLOR_KEY, DEFAULT_BG_COLOR));
      }
      if (e.key === THEME_KEY) {
        applyTheme(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ backgroundColor: bgColor }}>
      {dataUrl ? (
        <Document
          file={dataUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          error={
            <div className="flex h-full items-center justify-center text-sm text-neutral-600">
              Falha ao carregar documento.
            </div>
          }
          loading={
            <div className="flex h-full items-center justify-center text-sm text-neutral-600">
              Carregando documento…
            </div>
          }
          suspense={false}
          className="h-full"
        >
          <PdfStage
            pageNumber={page}
            numPages={numPages}
            zoom={zoom}
            className="h-full"
            backgroundColor={bgColor}
            overlay={({ scale }) => (
              <AnnotationLayer
                scale={scale}
                activeTool={null}
                interactive={false}
                strokes={strokesByPage[page] ?? []}
                laser={laser}
                onStrokeStart={() => {}}
                onStrokePoint={() => {}}
                onStrokeEnd={() => {}}
                onLaser={() => {}}
              />
            )}
          />
        </Document>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-neutral-600">
          {error ?? "Aguardando documento…"}
        </div>
      )}
      {black && <div className="absolute inset-0 z-10 bg-black" />}
      {white && <div className="absolute inset-0 z-10 bg-white" />}
    </div>
  );
}
