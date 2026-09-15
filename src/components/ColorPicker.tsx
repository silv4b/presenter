import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
];

interface ColorPickerProps {
  resetKey?: number;
  onChange: (color: string) => void;
  variant?: "default" | "dark";
}

export function ColorPicker({ resetKey = 0, onChange, variant = "default" }: ColorPickerProps) {
  const [editing, setEditing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hexInput, setHexInput] = useState("");
  const [customColors, setCustomColors] = useState<Record<number, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const prevResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (resetKey !== prevResetKeyRef.current) {
      prevResetKeyRef.current = resetKey;
      setActiveIndex(0);
      setCustomColors({});
      setEditing(false);
    }
  }, [resetKey]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [editing]);

  const handleHexChange = (raw: string) => {
    setHexInput(raw);
    const hex = `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      setCustomColors((prev) => ({ ...prev, [activeIndex]: hex }));
      onChangeRef.current(hex);
    }
  };

  const handleCircleClick = (c: string, index: number) => {
    if (index === activeIndex && editing) {
      setEditing(false);
    } else {
      const resolved = customColors[index] ?? c;
      setActiveIndex(index);
      setHexInput(resolved.replace("#", ""));
      setEditing(true);
      onChangeRef.current(resolved);
    }
  };

  return (
    <div ref={containerRef} className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-3">
        {editing && (
          <div className="flex items-center gap-1">
            <span className={cn("text-[18px]", variant === "dark" ? "text-white/60" : "text-muted-foreground")}>#</span>
            <input
              ref={inputRef}
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" || e.key === "Enter") setEditing(false);
              }}
              maxLength={6}
              className={cn(
                "w-20 rounded border px-1.5 py-1 font-mono outline-none",
                variant === "dark"
                  ? "border-white/20 bg-white/10 text-white placeholder-white/40"
                  : "border-border bg-muted text-foreground placeholder-muted-foreground",
              )}
              placeholder="000000"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {PRESET_COLORS.map((c, i) => {
            const isActive = i === activeIndex;
            const bg = customColors[i] ?? c;
            return (
              <button
                key={c}
                type="button"
                className={cn(
                  "size-5 shrink-0 rounded-full border-2 transition-transform hover:scale-110",
                  variant === "dark" ? "border-white/30" : "border-border",
                  isActive && (variant === "dark" ? "border-white scale-110" : "border-foreground scale-110"),
                )}
                style={{ backgroundColor: bg }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => handleCircleClick(c, i)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
