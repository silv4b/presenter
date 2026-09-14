import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Document, readPdfAsDataUrl, getDocument } from "@/lib/pdf";
import { PdfStage } from "@/components/PdfStage";
import { AnnotationLayer } from "@/components/AnnotationLayer";
import { useViewscreenAnnotations } from "@/state/annotations";
import {
  EVENT_SLIDE_CHANGE,
  EVENT_BLACK_SCREEN,
  type SlideChangePayload,
} from "@/lib/shared";

export default function Viewscreen() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [black, setBlack] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    listen<SlideChangePayload>(EVENT_SLIDE_CHANGE, (e) => {
      setPage(e.payload.page);
    }).then((u) => {
      if (disposed) u();
      else unlisteners.push(u);
    });
    listen<{ black: boolean }>(EVENT_BLACK_SCREEN, (e) => {
      setBlack(e.payload.black);
    }).then((u) => {
      if (disposed) u();
      else unlisteners.push(u);
    });
    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
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
            className="h-full"
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
    </div>
  );
}
