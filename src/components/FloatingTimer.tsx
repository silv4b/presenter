import { useCallback, useEffect, useRef, useState } from "react";
import { usePresentation } from "@/state/presentation";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw } from "lucide-react";
import { formatTime } from "@/lib/time";

export function FloatingTimer() {
  const {
    timerMode,
    timerInitialTime,
    registerTimerFunctions,
  } = usePresentation();

  const initialMs = timerInitialTime;

  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(initialMs);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const baseMsRef = useRef(initialMs);

  useEffect(() => {
    baseMsRef.current = initialMs;
    setElapsedMs(initialMs);
  }, [initialMs]);

  const reset = useCallback(() => {
    setRunning(false);
    baseMsRef.current = initialMs;
    setElapsedMs(initialMs);
  }, [initialMs]);

  const toggle = useCallback(() => setRunning((r) => !r), []);

  // Ao pausar, o valor exibido vira a nova base, para que retomar continue
  // dali.
  useEffect(() => {
    if (running) return;
    baseMsRef.current = elapsedMs;
  }, [running, elapsedMs]);

  useEffect(() => {
    registerTimerFunctions(toggle, reset);
  }, [registerTimerFunctions, toggle, reset]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const now = performance.now();
      const elapsed = now - (startTimeRef.current ?? now);
      if (timerMode === "countdown") {
        const remaining = Math.max(0, baseMsRef.current - elapsed);
        setElapsedMs(remaining);
        if (remaining <= 0) {
          setRunning(false);
          return;
        }
      } else {
        setElapsedMs(baseMsRef.current + elapsed);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, timerMode, initialMs]);

  const time = formatTime(elapsedMs);

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-sm">
      <div className="flex min-w-24 items-center justify-end gap-1">
        <span className="font-mono text-base leading-none font-medium tabular-nums tracking-tight text-white/90">
          {time.hours}:{time.minutes}:{time.seconds}
        </span>
        <span className="font-mono text-sm leading-none text-white/50">
          .{time.centiseconds}
        </span>
      </div>

      <div className="mx-1 h-5 w-px bg-white/20" />

      <Button
        size="icon"
        variant="ghost"
        className="size-8 cursor-pointer text-white hover:bg-white/10"
        onClick={toggle}
        title={running ? "Pausar cronômetro (F1)" : "Iniciar cronômetro (F1)"}
        aria-label={running ? "Pausar cronômetro" : "Iniciar cronômetro"}
      >
        {running ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8 cursor-pointer text-white hover:bg-white/10"
        onClick={reset}
        title="Zerar cronômetro (F2)"
        aria-label="Zerar cronômetro"
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  );
}

