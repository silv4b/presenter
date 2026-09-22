import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, Timer as TimerIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "stopwatch" | "countdown";

function format(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function Timer() {
  const [mode, setMode] = useState<Mode>("stopwatch");
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [durationMin, setDurationMin] = useState(5);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setSeconds((s) => {
        if (mode === "countdown") {
          if (s <= 1) {
            setRunning(false);
            return 0;
          }
          return s - 1;
        }
        return s + 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, mode]);

  const reset = () => {
    setRunning(false);
    setSeconds(mode === "countdown" ? durationMin * 60 : 0);
  };

  const switchMode = (next: Mode) => {
    setRunning(false);
    setMode(next);
    setSeconds(next === "countdown" ? durationMin * 60 : 0);
  };

  const expired = mode === "countdown" && seconds === 0 && !running;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <TimerIcon className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Cronômetro</span>
      </div>

      <div
        className={cn(
          "font-mono text-3xl tabular-nums tracking-tight",
          expired && "text-destructive",
        )}
      >
        {format(seconds)}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => switchMode("stopwatch")}
          className={cn(mode === "stopwatch" && "bg-muted", "cursor-pointer")}
        >
          Progressivo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => switchMode("countdown")}
          className={cn(mode === "countdown" && "bg-muted", "cursor-pointer")}
        >
          Regressivo
        </Button>
      </div>

      {mode === "countdown" && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Minutos
          <input
            type="number"
            min={1}
            max={600}
            value={durationMin}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value) || 1);
              setDurationMin(v);
              if (!running) setSeconds(v * 60);
            }}
            className="w-16 rounded-md border border-input bg-background px-2 py-1 text-foreground"
          />
        </label>
      )}

      <div className="flex items-center gap-1">
        <Button size="sm" onClick={() => setRunning((r) => !r)} className="flex-1 cursor-pointer">
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          {running ? "Pausar" : "Iniciar"}
        </Button>
        <Button size="icon" variant="outline" onClick={reset} aria-label="Zerar" className="cursor-pointer">
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
