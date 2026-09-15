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
