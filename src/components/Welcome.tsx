import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePresentation } from "@/state/presentation";
import { WelcomeSidebar } from "@/components/WelcomeSidebar";
import { FolderOpen, FileUp, Keyboard, Settings } from "lucide-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

const shortcuts: [string, string][] = [
  ["F5", "Iniciar / encerrar apresentação"],
  ["O", "Abrir PDF"],
  ["→ / Espaço", "Próximo slide"],
  ["←", "Slide anterior"],
  ["B", "Tela preta"],
  ["Home / End", "Primeiro / último slide"],
  ["L / P / H / E", "Laser / Caneta / Marcador / Borracha"],
  ["Ctrl+Z / Ctrl+Shift+Z", "Desfazer / Refazer"],
  ["Ctrl+= / Ctrl− / Ctrl0", "Zoom in / out / resetar"],
];

export function Welcome({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { openPdf, loadPdfFromPath } = usePresentation();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const webview = getCurrentWebview();
    const unlisten = webview.onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setIsDragging(true);
      } else if (event.payload.type === "drop") {
        setIsDragging(false);
        const pdfPath = event.payload.paths.find((p) =>
          p.toLowerCase().endsWith(".pdf"),
        );
        if (pdfPath) loadPdfFromPath(pdfPath);
      } else {
        setIsDragging(false);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadPdfFromPath]);

  return (
    <div className="relative flex h-full w-full" onDragOver={(e) => e.preventDefault()}>
      <style>{`
        @keyframes drop-enter {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Drag overlay */}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-primary/5 backdrop-blur-sm transition-all duration-300 ease-out ${
          isDragging
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className="flex flex-col items-center gap-4"
          style={isDragging ? { animation: "drop-enter 0.3s ease-out" } : undefined}
        >
          <div className="rounded-full bg-primary/10 p-6">
            <FileUp className="size-12 text-primary" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-primary">Solte o arquivo PDF aqui</p>
            <p className="text-sm text-muted-foreground">Arquivos .pdf são aceitos</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-8 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-2xl font-semibold">Presenter</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Transforme arquivos PDF em apresentações estilo PowerPoint, com tela de
            controle para o palestrante e projeção em tela cheia para o público.
          </p>
        </div>

        <Button size="lg" onClick={openPdf}>
          <FolderOpen className="size-4" />
          Abrir PDF
        </Button>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Keyboard className="size-4" />
            Atalhos de teclado
          </div>
          <div className="flex flex-col gap-1.5">
            {shortcuts.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-6 text-xs">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  {key}
                </kbd>
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={onOpenSettings}
          aria-label="Configurações"
          title="Configurações"
          className="absolute bottom-4 right-4"
        >
          <Settings className="size-4" />
        </Button>
      </div>

      {/* History sidebar */}
      <WelcomeSidebar />
    </div>
  );
}
