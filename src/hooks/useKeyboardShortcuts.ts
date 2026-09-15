import { useEffect, useRef } from "react";

type AnnotationTool = "laser" | "pen" | "highlighter" | "eraser";

interface UseKeyboardShortcutsOptions {
  numPages: number;
  currentPage: number;
  isPresenting: boolean;
  docLoaded: boolean;
  zoom: number;
  dialogOpen: boolean;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  startPresentation: () => void;
  stopPresentation: () => void;
  toggleBlackScreen: () => void;
  toggleTool: (tool: AnnotationTool) => void;
  undo: () => void;
  redo: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  onEscape?: () => void;
  openPdf?: () => void;
}

export function useKeyboardShortcuts(opts: UseKeyboardShortcutsOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const o = optsRef.current;
      if (o.dialogOpen) return;

      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault(); o.undo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault(); o.redo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault(); o.redo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault(); o.zoomIn(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault(); o.zoomOut(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault(); o.zoomReset(); return;
      }

      switch (e.key) {
        case "ArrowRight": case "ArrowDown": case "PageDown":
          e.preventDefault(); o.nextPage(); break;
        case "ArrowLeft": case "ArrowUp": case "PageUp":
          e.preventDefault(); o.prevPage(); break;
        case " ":
          if (o.zoom <= 1) { e.preventDefault(); o.nextPage(); }
          break;
        case "Home":
          e.preventDefault(); o.goToPage(1); break;
        case "End":
          e.preventDefault(); o.goToPage(o.numPages); break;
        case "F5":
          e.preventDefault();
          if (o.isPresenting) void o.stopPresentation();
          else void o.startPresentation();
          break;
        case "Escape":
          if (o.isPresenting || o.docLoaded) {
            e.preventDefault();
            o.onEscape?.();
          }
          break;
        case "b": case "B":
          if (o.isPresenting) o.toggleBlackScreen(); break;
        case "l": case "L":
          if (!isInput) { e.preventDefault(); o.toggleTool("laser"); } break;
        case "p": case "P":
          if (!isInput) { e.preventDefault(); o.toggleTool("pen"); } break;
        case "h": case "H":
          if (!isInput) { e.preventDefault(); o.toggleTool("highlighter"); } break;
        case "e": case "E":
          if (!isInput) { e.preventDefault(); o.toggleTool("eraser"); } break;
        case "o": case "O":
          if (!isInput && !o.docLoaded && o.openPdf) {
            e.preventDefault(); o.openPdf();
          }
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
