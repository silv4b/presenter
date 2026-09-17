import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresentation } from "@/state/presentation";
import { RefreshCw, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonitorInfo } from "@/lib/monitors";

function monitorLabel(m: MonitorInfo, index: number): string {
  const readable = m.name && !m.name.includes("\\") ? m.name : `Monitor ${index + 1}`;
  const primary = m.primary ? " · principal" : "";
  return `${readable} — ${m.width}×${m.height}${primary}`;
}

export function MonitorSelector() {
  const [refreshing, setRefreshing] = useState(false);
  const { monitors, selectedMonitors, refreshMonitors, selectMonitor } = usePresentation();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Tela de projeção
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={async () => {
                setRefreshing(true);
                const min = new Promise((r) => setTimeout(r, 600));
                await Promise.all([refreshMonitors(), min]);
                setRefreshing(false);
              }}
              className="size-6"
              aria-label="Atualizar monitores"
            >
              <RefreshCw className={cn("size-3.5 transition-transform", refreshing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Redetectar monitores conectados
          </TooltipContent>
        </Tooltip>
      </div>

      {monitors.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum monitor detectado</p>
      ) : (
        <div className="flex flex-col gap-1">
          {monitors.map((m, i) => {
            const checked = selectedMonitors.includes(m.id);
            const primaryChecked = selectedMonitors.some((id) => monitors.find((mm) => mm.id === id)?.primary);
            const disabled = primaryChecked && !m.primary;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMonitor(m.id)}
                disabled={disabled}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  checked
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40",
                  )}
                >
                  {checked && (
                    <svg className="size-3" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <Monitor className="size-3.5 shrink-0" />
                <span className="truncate">{monitorLabel(m, i)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
