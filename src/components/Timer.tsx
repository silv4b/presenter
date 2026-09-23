import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, Timer as TimerIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "stopwatch" | "countdown";

// Field definitions: 4 fields, 2 digits each (except centiseconds which is display only)
// Field 0: HH (indices 0,1) - editable
// Field 1: MM (indices 2,3) - editable
// Field 2: SS (indices 4,5) - editable
// Field 3: CC (indices 6,7) - display only, smaller
const EDITABLE_FIELD_COUNT = 3; // HH, MM, SS

function format(ms: number): { parts: string[] } {
  const totalMs = Math.max(0, ms);
  const totalSeconds = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const centis = Math.floor((totalMs % 1000) / 10);
  return {
    parts: [
      String(h).padStart(2, "0"),
      String(m).padStart(2, "0"),
      String(s).padStart(2, "0"),
      String(centis).padStart(2, "0"),
    ],
  };
}

export function Timer() {
  const [mode, setMode] = useState<Mode>("stopwatch");
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [digits, setDigits] = useState<string[]>(["0", "0", "0", "0", "0", "0", "0", "0"]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const baseMsRef = useRef(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>(new Array(8).fill(null));
  const isEditingRef = useRef(false);

  // Sync digits from elapsedMs when not editing
  useEffect(() => {
    if (activeIndex !== null) return;
    const { parts } = format(elapsedMs);
    setDigits(parts.flatMap((p) => p.split("")));
  }, [elapsedMs, activeIndex]);

  // Focus active input when activeIndex changes
  useEffect(() => {
    if (activeIndex !== null && inputRefs.current[activeIndex]) {
      const input = inputRefs.current[activeIndex]!;
      input.focus();
      input.select();
    }
  }, [activeIndex]);

  // Global keyboard handler for timer editing (captures arrows when editing)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isEditingRef.current || activeIndex === null) return;
      
      const fieldIdx = Math.floor(activeIndex / 2);
      const isCentiseconds = fieldIdx === 3;
      if (isCentiseconds) return; // Don't handle keys for centiseconds
      
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex > 0) {
          setActiveIndex(activeIndex - 1);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex < 5) { // Only up to SS (index 5)
          setActiveIndex(activeIndex + 1);
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          if (activeIndex > 0) {
            setActiveIndex(activeIndex - 1);
          } else {
            setActiveIndex(5); // Circular: first digit -> last digit
          }
        } else {
          if (activeIndex < 5) {
            setActiveIndex(activeIndex + 1);
          } else {
            setActiveIndex(0); // Circular: last digit -> first digit
          }
        }
      } else if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        applyDigits();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [activeIndex]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (!running) return;
      const now = performance.now();
      const elapsed = now - (startTimeRef.current ?? now);
      if (mode === "countdown") {
        const remaining = Math.max(0, baseMsRef.current - elapsed);
        setElapsedMs(remaining);
        if (remaining <= 0) {
          setRunning(false);
          setElapsedMs(0);
          setDigits(["0", "0", "0", "0", "0", "0", "0", "0"]);
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
  }, [running, mode]);

  const reset = () => {
    setRunning(false);
    setActiveIndex(null);
    isEditingRef.current = false;
    baseMsRef.current = 0;
    setElapsedMs(0);
    setDigits(["0", "0", "0", "0", "0", "0", "0", "0"]);
  };

  const switchMode = (next: Mode) => {
    setRunning(false);
    setActiveIndex(null);
    isEditingRef.current = false;
    setMode(next);
    // Preserve current time when switching modes
    const ms = elapsedMs;
    baseMsRef.current = ms;
    setElapsedMs(ms);
    const { parts } = format(ms);
    setDigits(parts.flatMap((p) => p.split("")));
  };

  const advanceIfNeeded = (index: number) => {
    const fieldIdx = Math.floor(index / 2);
    const digitInField = index % 2;
    if (fieldIdx < EDITABLE_FIELD_COUNT && digitInField === 1) {
      const nextFieldStart = (fieldIdx + 1) * 2;
      if (nextFieldStart < 6) setActiveIndex(nextFieldStart);
    } else if (index < 5) {
      setActiveIndex(index + 1);
    }
  };

  const applyDigitsImmediate = () => {
    const timeStr = digits.join("");
    const h = parseInt(timeStr.slice(0, 2), 10);
    const m = parseInt(timeStr.slice(2, 4), 10);
    const s = parseInt(timeStr.slice(4, 6), 10);
    const cc = parseInt(timeStr.slice(6, 8), 10);
    const totalMs = (h * 3600 + m * 60 + s) * 1000 + cc * 10;
    baseMsRef.current = totalMs;
    setElapsedMs(totalMs);
  };

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const nextDigits = [...digits];
    nextDigits[index] = value || "0";
    setDigits(nextDigits);
    applyDigitsImmediate();
  };

  const handleDigitKeyDown = (e: React.KeyboardEvent, index: number) => {
    const key = e.key;
    if (/^\d$/.test(key)) {
      const nextDigits = [...digits];
      nextDigits[index] = key;
      setDigits(nextDigits);
      advanceIfNeeded(index);
      applyDigitsImmediate();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const fieldIdx = Math.floor(index / 2);
    const isCentiseconds = fieldIdx === 3;
    
    // Don't handle keys for centiseconds
    if (isCentiseconds) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      if (index > 0) {
        setActiveIndex(index - 1);
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      if (index < 5) {
        setActiveIndex(index + 1);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        if (index > 0) {
          setActiveIndex(index - 1);
        } else {
          setActiveIndex(5);
        }
      } else {
        if (index < 5) {
          setActiveIndex(index + 1);
        } else {
          setActiveIndex(0);
        }
      }
    } else if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      applyDigits();
    } else if (e.key === "Backspace") {
      // Allow backspace to clear and move left
      if (!digits[index] && index > 0) {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex(index - 1);
      }
    }
  };

  const applyDigits = () => {
    const timeStr = digits.join("");
    const h = parseInt(timeStr.slice(0, 2), 10);
    const m = parseInt(timeStr.slice(2, 4), 10);
    const s = parseInt(timeStr.slice(4, 6), 10);
    const cc = parseInt(timeStr.slice(6, 8), 10);
    const totalMs = (h * 3600 + m * 60 + s) * 1000 + cc * 10;
    baseMsRef.current = totalMs;
    setElapsedMs(totalMs);
    setActiveIndex(null);
    isEditingRef.current = false;
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (activeIndex !== null) applyDigits();
    }, 0);
  };

  const handleClick = (index: number) => {
    if (running) return;
    const fieldIdx = Math.floor(index / 2);
    if (fieldIdx === 3) return; // Don't edit centiseconds
    
    // Click on any digit -> select LEFTMOST digit of that field
    const fieldStart = fieldIdx * 2;
    setActiveIndex(fieldStart);
    isEditingRef.current = true;
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isEditingRef.current = true;
    e.currentTarget.select();
  };

  const expired = mode === "countdown" && elapsedMs === 0 && !running;
  const { parts } = format(elapsedMs);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <TimerIcon className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Cronômetro</span>
      </div>

      <div
        className={cn(
          "font-mono text-xl tabular-nums tracking-tight cursor-pointer select-none rounded px-1",
          expired && "text-destructive",
          !running && "hover:bg-muted/50",
        )}
        onBlur={handleBlur}
      >
        <span className="flex items-baseline gap-0">
          {parts.map((part, partIndex) => (
            <span key={partIndex} className="flex items-center gap-0">
              {part.split("").map((_, digitIndex) => {
                const globalIndex = partIndex * 2 + digitIndex;
                const fieldIdx = partIndex;
                const isCentiseconds = fieldIdx === 3;
                const isEditable = fieldIdx < EDITABLE_FIELD_COUNT && !running;
                return (
                  <input
                    key={globalIndex}
                    ref={(el) => { inputRefs.current[globalIndex] = el; }}
                    type="text"
                    value={digits[globalIndex]}
                    onChange={(e) => handleDigitChange(globalIndex, e.target.value)}
                    onKeyDown={(e) => { handleKeyDown(e, globalIndex); handleDigitKeyDown(e, globalIndex); }}
                    onClick={() => handleClick(globalIndex)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    maxLength={1}
                    inputMode="numeric"
                    className={cn(
                      "text-center bg-transparent border-none outline-none text-inherit",
                      activeIndex === globalIndex && "bg-muted",
                      isCentiseconds && "text-muted-foreground/60",
                    )}
                    style={{ 
                      font: "inherit", 
                      textAlign: "center",
                      width: isCentiseconds ? "1.25rem" : "1.75rem",
                    }}
                    disabled={!isEditable}
                    readOnly={!isEditable}
                  />
                );
              })}
              {partIndex < 3 && <span className="text-muted-foreground px-0.5">:</span>}
            </span>
          ))}
        </span>
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