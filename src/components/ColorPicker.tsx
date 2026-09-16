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
  disabled?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export function ColorPicker({ resetKey = 0, onChange, variant = "default", disabled, onEditingChange }: ColorPickerProps) {
  const [editing, setEditing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hexInput, setHexInput] = useState("");
  const [customColors, setCustomColors] = useState<Record<number, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;
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
    onEditingChangeRef.current?.(editing);
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
    <div ref={containerRef} className={cn("flex items-center gap-2", disabled && "opacity-30 pointer-events-none")}>
      {variant === "dark" ? (
        <>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-[18px] text-white/60">#</span>
            <input
              ref={inputRef}
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.stopPropagation(); e.currentTarget.blur(); }
                if (e.key === "Enter") setEditing(false);
              }}
              maxLength={6}
              className="w-20 shrink-0 rounded border border-white/20 bg-white/10 px-1.5 py-1 font-mono text-xs text-white outline-none placeholder-white/40"
              placeholder="000000"
            />
          </div>
          <div className="shrink-0 rounded-full bg-white/30 h-5 w-0.5" />
          <div className="flex shrink-0 items-center gap-2">
            {PRESET_COLORS.map((c, i) => {
              const isActive = i === activeIndex;
              const bg = customColors[i] ?? c;
              return (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "size-5 shrink-0 rounded-full border-2 transition-transform hover:scale-110",
                    "border-white/30",
                    isActive && "border-white scale-110",
                  )}
                  style={{ backgroundColor: bg }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => handleCircleClick(c, i)}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {editing && (
            <div className="flex items-center gap-1">
              <span className="text-[18px] text-muted-foreground">#</span>
              <input
                ref={inputRef}
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { e.stopPropagation(); e.currentTarget.blur(); }
                  if (e.key === "Enter") setEditing(false);
                }}
                maxLength={6}
                className="w-20 rounded border border-border bg-muted px-1.5 py-1 font-mono text-xs text-foreground outline-none placeholder-muted-foreground"
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
                    "border-border",
                    isActive && "border-foreground scale-110",
                  )}
                  style={{ backgroundColor: bg }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => handleCircleClick(c, i)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
