import { Button } from "@/components/ui/button";
import { usePresentation } from "@/state/presentation";
import { FolderOpen, Keyboard, Settings } from "lucide-react";

const shortcuts: [string, string][] = [
  ["F5", "Iniciar / encerrar apresentação"],
  ["→ / Espaço", "Próximo slide"],
  ["←", "Slide anterior"],
  ["B", "Tela preta"],
  ["Home / End", "Primeiro / último slide"],
  ["L / P / H / E", "Laser / Caneta / Marcador / Borracha"],
  ["Ctrl+Z / Ctrl+Shift+Z", "Desfazer / Refazer"],
  ["Ctrl+= / Ctrl− / Ctrl0", "Zoom in / out / resetar"],
];

export function Welcome({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { openPdf } = usePresentation();

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 p-8">
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
  );
}
