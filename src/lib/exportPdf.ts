import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { jsPDF } from "jspdf";
import type { AnnotationStroke } from "./annotations";
import { drawStrokes } from "./canvasDrawing";
import { pdfjs } from "./pdf";

// jsPDF é carregado sob demanda (await import()) dentro de renderAnnotatedPages:
// só entra no bundle inicial quando o usuário exporta. O módulo ./pdf fica no
// chunk principal de propósito (pdf.js renderiza a apresentação e a projeção).

// Escala fixa (e não `devicePixelRatio`) para que o PDF exportado seja
// idêntico independentemente do DPI da tela de quem exporta.
const RENDER_SCALE = 2;

async function renderAnnotatedPages(
  docDataUrl: string,
  strokesByPage: Record<number, AnnotationStroke[]>,
): Promise<jsPDF | null> {
  const { jsPDF } = await import("jspdf");
  const loadingTask = pdfjs.getDocument({ url: docDataUrl });
  try {
    const pdfDoc = await loadingTask.promise;
    let pdf: jsPDF | null = null;

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const pw = viewport.width;
      const ph = viewport.height;

      const canvas = document.createElement("canvas");
      canvas.width = pw;
      canvas.height = ph;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, canvas, viewport }).promise;

      const strokes = strokesByPage[i] ?? [];
      if (strokes.length > 0) {
        drawStrokes(ctx, strokes, RENDER_SCALE);
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

    return pdf;
  } finally {
    await loadingTask.destroy();
  }
}

export async function exportFullPdf(
  docDataUrl: string,
  strokesByPage: Record<number, AnnotationStroke[]>,
) {
  const pdf = await renderAnnotatedPages(docDataUrl, strokesByPage);
  if (!pdf) return;

  const path = await save({
    defaultPath: "apresentacao-com-anotacoes.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return;

  const pdfBase64 = pdf.output("datauristring").split(",")[1];
  await invoke("save_file", { path, data: pdfBase64 });
}
