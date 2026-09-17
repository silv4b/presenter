import { invoke } from "@tauri-apps/api/core";
import { pdfjs, Document, Page } from "react-pdf";
import type { DocumentInfo } from "@/lib/shared";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export { Document, Page, pdfjs };

export async function readPdfAsDataUrl(path: string): Promise<string> {
  return invoke<string>("read_pdf", { path });
}

export async function fileExists(path: string): Promise<boolean> {
  return invoke<boolean>("file_exists", { path });
}

export async function setDocument(
  path: string,
  name: string,
  page: number,
): Promise<void> {
  await invoke("set_document", { path, name, page });
}

export async function getDocument(): Promise<DocumentInfo | null> {
  return invoke<DocumentInfo | null>("get_document");
}

export async function extractNotesFromPdf(docDataUrl: string): Promise<Record<number, string[]>> {
  const loadingTask = pdfjs.getDocument({ url: docDataUrl });
  const pdfDoc = await loadingTask.promise;
  const notes: Record<number, string[]> = {};

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const annotations = await page.getAnnotations();
    const textNotes = annotations.filter(
      (a) => a.subtype === "Text" && a.contents && a.contents.trim().length > 0,
    );
    if (textNotes.length > 0) {
      notes[i] = textNotes.map((a) => a.contents);
    }
  }
  return notes;
}
