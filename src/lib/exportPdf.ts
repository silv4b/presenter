import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { jsPDF } from "jspdf";
import type { AnnotationStroke } from "./annotations";
import { drawStrokes } from "./canvasDrawing";
import { pdfjs } from "./pdf";

export async function exportFullPdf(
  docDataUrl: string,
  strokesByPage: Record<number, AnnotationStroke[]>,
) {
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

    const strokes = strokesByPage[i] ?? [];
    if (strokes.length > 0) {
      drawStrokes(ctx, strokes, 2);
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
    defaultPath: "apresentacao-com-anotacoes.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return;

  const pdfBase64 = pdf.output("datauristring").split(",")[1];
  await invoke("save_file", { path, data: pdfBase64 });
}
