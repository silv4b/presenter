import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresentation } from "@/state/presentation";
import { Play, Square, MonitorOff } from "lucide-react";

export function PresentationControls() {
  const { docName, isPresenting, blackScreen, startPresentation, stopPresentation, toggleBlackScreen } = usePresentation();

  if (!docName) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="w-full"
            onClick={isPresenting ? stopPresentation : startPresentation}
          >
            {isPresenting ? (
              <>
                <Square className="size-4" />
                Encerrar (F5)
              </>
            ) : (
              <>
                <Play className="size-4" />
                Iniciar (F5)
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {isPresenting
            ? "Encerrar apresentação na tela de projeção"
            : "Abrir a tela de projeção em tela cheia"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={blackScreen ? "destructive" : "outline"}
            onClick={toggleBlackScreen}
            className="w-full"
          >
            <MonitorOff className="size-4" />
            Tela preta (B)
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Alternar tela preta no projetor
        </TooltipContent>
      </Tooltip>
    </>
  );
}
