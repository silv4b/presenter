import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePresentation } from "@/state/presentation";
import { getHistory, clearHistory, removeFromHistory, type HistoryEntry } from "@/lib/fileHistory";
import { fileExists } from "@/lib/pdf";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FileText, Trash2, Clock, MoreVertical, FolderOpen } from "lucide-react";

export function WelcomeSidebar() {
  const { loadPdfFromPath } = usePresentation();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [errorPath, setErrorPath] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleClick = async (entry: HistoryEntry) => {
    const exists = await fileExists(entry.path);
    if (exists) {
      await loadPdfFromPath(entry.path);
    } else {
      setErrorPath(entry.path);
    }
  };

  return (
    <>
      <div className="flex h-full w-80 flex-col border-l border-border bg-card/50 p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="size-4" />
            Arquivos recentes
          </div>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6"
              title="Limpar histórico"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Nenhum arquivo no histórico
            </p>
          ) : (
            history.map((entry) => (
              <div
                key={entry.path}
                className="group flex items-center gap-2 rounded-md py-1.5 text-left text-sm transition-colors hover:bg-muted"
              >
                <button
                  onClick={() => handleClick(entry)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium">{entry.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {entry.path}
                    </p>
                  </div>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 shrink-0"
                    >
                      <MoreVertical className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-46 flex flex-col gap-1">
                    <DropdownMenuItem onClick={() => revealItemInDir(entry.path)}>
                      <FolderOpen className="size-3.5" />
                      Abrir local do arquivo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setHistory(removeFromHistory(entry.path))}
                    >
                      <Trash2 className="size-3.5" />
                      Remover do histórico
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limpar histórico</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja limpar todo o histórico de arquivos recentes?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setHistory(clearHistory());
                setConfirmClear(false);
              }}
            >
              Limpar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!errorPath} onOpenChange={() => setErrorPath(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivo não encontrado</DialogTitle>
            <DialogDescription>
              O arquivo não foi encontrado no caminho original. Ele pode ter sido
              movido, renomeado ou excluído.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all rounded bg-muted p-2 font-mono text-xs text-muted-foreground">
            {errorPath}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErrorPath(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
