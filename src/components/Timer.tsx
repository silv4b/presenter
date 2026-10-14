import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pause, Play, RotateCcw, Timer as TimerIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime, parseTimerDigits, toTimerDigits } from "@/lib/time";
import { usePresentation, type TimerMode } from "@/state/presentation";

// Quatro campos de dois dígitos cada. Os centésimos são apenas exibidos.
// Campo 0: HH (índices 0 e 1) - editável
// Campo 1: MM (índices 2 e 3) - editável
// Campo 2: SS (índices 4 e 5) - editável
// Campo 3: CC (índices 6 e 7) - somente leitura, menor
const DIGITS_PER_FIELD = 2;
const EDITABLE_FIELD_COUNT = 3; // HH, MM, SS
const FIELD_COUNT = 4;
const DIGIT_COUNT = DIGITS_PER_FIELD * FIELD_COUNT; // 8 dígitos exibidos
const CENTISECONDS_FIELD = FIELD_COUNT - 1; // campo somente leitura
const LAST_EDITABLE_INDEX = EDITABLE_FIELD_COUNT * DIGITS_PER_FIELD - 1; // dígito 5

const FIELD_LABELS = ["Horas", "Minutos", "Segundos", "Centésimos"];

export function Timer() {
  const {
    registerTimerFunctions,
    timerMode: mode,
    setTimerMode: setMode,
    timerInitialTime,
    setTimerInitialTime,
  } = usePresentation();

  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(timerInitialTime);
  const [digits, setDigits] = useState<string[]>(() =>
    toTimerDigits(formatTime(timerInitialTime)),
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const baseMsRef = useRef(timerInitialTime);
  const inputRefs = useRef<Array<HTMLInputElement | null>>(new Array(DIGIT_COUNT).fill(null));
  const isEditingRef = useRef(false);
  // Espelho sempre atualizado dos dígitos: os handlers leem daqui para não
  // depender do closure do render em que foram criados.
  const digitsRef = useRef(digits);

  useEffect(() => {
    digitsRef.current = digits;
  }, [digits]);

  /** Aplica um tempo como nova base, tanto na exibição quanto na persistência. */
  const applyTime = useCallback((ms: number) => {
    baseMsRef.current = ms;
    setElapsedMs(ms);
    setTimerInitialTime(ms);
  }, [setTimerInitialTime]);

  const reset = useCallback(() => {
    setRunning(false);
    setActiveIndex(null);
    isEditingRef.current = false;
    baseMsRef.current = timerInitialTime;
    setElapsedMs(timerInitialTime);
    setDigits(toTimerDigits(formatTime(timerInitialTime)));
  }, [timerInitialTime]);

  useEffect(() => {
    registerTimerFunctions(() => setRunning((r) => !r), reset);
  }, [registerTimerFunctions, reset]);

  // Reflete mudanças externas (ex.: diálogo de configurações) quando o
  // cronômetro está parado.
  useEffect(() => {
    if (running || activeIndex !== null) return;
    if (timerInitialTime === baseMsRef.current) return;
    baseMsRef.current = timerInitialTime;
    setElapsedMs(timerInitialTime);
    setDigits(toTimerDigits(formatTime(timerInitialTime)));
  }, [timerInitialTime, running, activeIndex]);

  // Mantém os dígitos em dia com o tempo exibido quando não há edição.
  useEffect(() => {
    if (activeIndex !== null) return;
    setDigits(toTimerDigits(formatTime(elapsedMs)));
  }, [elapsedMs, activeIndex]);

  // Foca e seleciona o input correspondente quando o campo ativo muda.
  useEffect(() => {
    if (activeIndex !== null && inputRefs.current[activeIndex]) {
      const input = inputRefs.current[activeIndex]!;
      input.focus();
      input.select();
    }
  }, [activeIndex]);

  // Aplica os dígitos e encerra a edição. Lê sempre do espelho para que o
  // closure usado pelo handler global não fique defasado.
  const applyDigits = useCallback(() => {
    applyTime(parseTimerDigits(digitsRef.current));
    setActiveIndex(null);
    isEditingRef.current = false;
  }, [applyTime]);

  // Handler global de teclado durante a edição: absorve as setas, o Tab e o
  // Enter/Escape, que são tratados pelos atalhos globais do app.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isEditingRef.current || activeIndex === null) return;

      const fieldIdx = Math.floor(activeIndex / DIGITS_PER_FIELD);
      if (fieldIdx === CENTISECONDS_FIELD) return; // Centésimos não são editáveis.

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex > 0) {
          setActiveIndex(activeIndex - 1);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex < LAST_EDITABLE_INDEX) {
          setActiveIndex(activeIndex + 1);
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          setActiveIndex(activeIndex > 0 ? activeIndex - 1 : LAST_EDITABLE_INDEX);
        } else {
          setActiveIndex(activeIndex < LAST_EDITABLE_INDEX ? activeIndex + 1 : 0);
        }
      } else if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        applyDigits();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [activeIndex, applyDigits]);

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
          setDigits(new Array(DIGIT_COUNT).fill("0"));
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

  const switchMode = (next: TimerMode) => {
    setRunning(false);
    setActiveIndex(null);
    isEditingRef.current = false;
    setMode(next);
    // Preserva o tempo atual ao trocar de modo.
    applyTime(elapsedMs);
  };

  const advanceIfNeeded = (index: number) => {
    const fieldIdx = Math.floor(index / DIGITS_PER_FIELD);
    const digitInField = index % DIGITS_PER_FIELD;
    if (fieldIdx < EDITABLE_FIELD_COUNT && digitInField === 1) {
      const nextFieldStart = (fieldIdx + 1) * DIGITS_PER_FIELD;
      if (nextFieldStart < DIGIT_COUNT) setActiveIndex(nextFieldStart);
    } else if (index < LAST_EDITABLE_INDEX) {
      setActiveIndex(index + 1);
    }
  };

  /** Escreve o dígito e aplica o tempo resultante, sem esperar o próximo render. */
  const commitDigit = useCallback(
    (nextDigits: string[]) => {
      setDigits(nextDigits);
      digitsRef.current = nextDigits;
      applyTime(parseTimerDigits(nextDigits));
    },
    [applyTime],
  );

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const nextDigits = [...digitsRef.current];
    nextDigits[index] = value || "0";
    commitDigit(nextDigits);
  };

  const handleDigitKeyDown = (e: React.KeyboardEvent, index: number) => {
    const key = e.key;
    if (/^\d$/.test(key)) {
      const nextDigits = [...digitsRef.current];
      nextDigits[index] = key;
      commitDigit(nextDigits);
      advanceIfNeeded(index);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const fieldIdx = Math.floor(index / DIGITS_PER_FIELD);

    // Centésimos não são editáveis.
    if (fieldIdx === CENTISECONDS_FIELD) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      if (index > 0) {
        setActiveIndex(index - 1);
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      if (index < LAST_EDITABLE_INDEX) {
        setActiveIndex(index + 1);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        setActiveIndex(index > 0 ? index - 1 : LAST_EDITABLE_INDEX);
      } else {
        setActiveIndex(index < LAST_EDITABLE_INDEX ? index + 1 : 0);
      }
    } else if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      applyDigits();
    } else if (e.key === "Backspace") {
      // Permite apagar e voltar um dígito.
      if (!digitsRef.current[index] && index > 0) {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex(index - 1);
      }
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (activeIndex !== null) applyDigits();
    }, 0);
  };

  const handleClick = (index: number) => {
    if (running) return;
    const fieldIdx = Math.floor(index / DIGITS_PER_FIELD);
    if (fieldIdx === CENTISECONDS_FIELD) return; // Centésimos não são editáveis.

    // Clicar em qualquer dígito seleciona o mais à esquerda do campo.
    setActiveIndex(fieldIdx * 2);
    isEditingRef.current = true;
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isEditingRef.current = true;
    e.currentTarget.select();
  };

  const expired = mode === "countdown" && elapsedMs === 0 && !running;
  const parts = ["hours", "minutes", "seconds", "centiseconds"] as const;
  const time = formatTime(elapsedMs);

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
        <span className="flex items-baseline gap-0" role="group" aria-label="Tempo do cronômetro">
          {parts.map((part, partIndex) => (
            <span key={part} className="flex items-center gap-0">
              {time[part].split("").map((_, digitIndex) => {
                const globalIndex = partIndex * DIGITS_PER_FIELD + digitIndex;
                const fieldIdx = partIndex;
                const isCentiseconds = fieldIdx === CENTISECONDS_FIELD;
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
                    aria-label={`${FIELD_LABELS[fieldIdx]}, dígito ${digitIndex + 1} de 2`}
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
              {partIndex < FIELD_COUNT - 1 && <span className="text-muted-foreground px-0.5">:</span>}
            </span>
          ))}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground">Regressivo</span>
          <span className="text-[0.7rem] text-muted-foreground">
            {mode === "countdown" ? "Conta até zero" : "Conta a partir de zero"}
          </span>
        </div>
        <Switch
          checked={mode === "countdown"}
          onCheckedChange={(checked) => switchMode(checked ? "countdown" : "stopwatch")}
          aria-label="Alternar modo regressivo"
        />
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
