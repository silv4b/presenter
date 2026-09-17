import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresentation } from "@/state/presentation";
import { Play, Square, MonitorOff, Sun } from "lucide-react";

export function PresentationControls() {
  const { docName, isPresenting, blackScreen, whiteScreen, monitors, selectedMonitors, startPresentation, stopPresentation, toggleBlackScreen, toggleWhiteScreen } = usePresentation();

  const hasExternalMonitors = monitors.length > 1;
  const noMonitorSelected = selectedMonitors.length === 0;
  const canStart = !isPresenting && hasExternalMonitors && noMonitorSelected;

  if (!docName) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="w-full"
            disabled={canStart}
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
            : hasExternalMonitors && noMonitorSelected
              ? "Selecione pelo menos um monitor na lista abaixo"
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

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={whiteScreen ? "destructive" : "outline"}
            onClick={toggleWhiteScreen}
            className="w-full"
          >
            <Sun className="size-4" />
            Tela branca (W)
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Alternar tela branca no projetor
        </TooltipContent>
      </Tooltip>
    </>
  );
}
