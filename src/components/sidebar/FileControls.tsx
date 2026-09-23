import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresentation } from "@/state/presentation";
import { FolderOpen, Home } from "lucide-react";

export function FileControls() {
  const { docName, openPdf, closeDocument } = usePresentation();

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary" onClick={openPdf} className="w-full cursor-pointer">
            <FolderOpen className="size-4 cursor-pointer" />
            Abrir PDF
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Abrir arquivo PDF do computador</TooltipContent>
      </Tooltip>

      {docName && (
        <p className="truncate text-xs text-muted-foreground" title={docName}>
          {docName}
        </p>
      )}

      {docName && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" onClick={closeDocument} className="w-full cursor-pointer">
              <Home className="size-4" />
              Voltar ao início
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Fechar o documento e voltar à tela inicial
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
