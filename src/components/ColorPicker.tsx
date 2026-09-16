import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";

const PICKER_WIDTH = 222;
const PICKER_MARGIN = 8;

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
];

function readFromStorage(key: string | undefined): { color?: string; activeIndex?: number; customColors?: Record<number, string> } | undefined {
  if (!key) return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length === 0) return undefined;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch { return undefined; }
}

function writeToStorage(key: string | undefined, value: { color: string; activeIndex: number; customColors: Record<number, string> }) {
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

interface ColorPickerProps {
  storageKey?: string;
  defaultColor?: string;
  onChange: (color: string) => void;
  onCustomize?: () => void;
  variant?: "default" | "dark";
  disabled?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export function ColorPicker({ storageKey, defaultColor = PRESET_COLORS[0], onChange, onCustomize, variant = "default", disabled, onEditingChange }: ColorPickerProps) {
  const stored = readFromStorage(storageKey);
  const initialColor = stored?.color ?? defaultColor;
  const initialActiveIndex = stored?.activeIndex ?? 0;
  const initialCustomColors = stored?.customColors ?? {};

  const [editing, setEditing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [currentColor, setCurrentColor] = useState(initialColor);
  const [customColors, setCustomColors] = useState<Record<number, string>>(initialCustomColors);
  const [pickerStyle, setPickerStyle] = useState<React.CSSProperties>({});
  const pickerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const circlesRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCustomizeRef = useRef(onCustomize);
  onCustomizeRef.current = onCustomize;
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;

  useEffect(() => {
    onEditingChangeRef.current?.(editing);
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        pickerRef.current && !pickerRef.current.contains(e.target as Node)
      ) {
        setEditing(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [editing]);

  const clampPickerPosition = useCallback(() => {
    if (!circlesRef.current) return;
    const rect = circlesRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const halfPicker = PICKER_WIDTH / 2;
    const margin = PICKER_MARGIN;

    let left = centerX - halfPicker - 700;
    if (left < margin) left = margin;
    if (left + PICKER_WIDTH > window.innerWidth - margin) {
      left = window.innerWidth - margin - PICKER_WIDTH;
    }

    const top = rect.bottom + 10;

    setPickerStyle({ position: "fixed", left, top, width: PICKER_WIDTH, zIndex: 50 });
  }, []);

  useLayoutEffect(() => {
    if (editing) clampPickerPosition();
  }, [editing, clampPickerPosition]);

  useEffect(() => {
    if (!editing) return;
    const handleResize = () => clampPickerPosition();
    const handleScroll = () => clampPickerPosition();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [editing, clampPickerPosition]);

  const handleCircleClick = (c: string, index: number) => {
    if (index === activeIndex && editing) {
      setEditing(false);
    } else {
      const resolved = customColors[index] ?? c;
      setActiveIndex(index);
      setCurrentColor(resolved);
      setEditing(true);
      writeToStorage(storageKey, { color: resolved, activeIndex: index, customColors });
      onChangeRef.current(resolved);
    }
  };

  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    setCustomColors((prev) => {
      const next = { ...prev, [activeIndex]: color };
      writeToStorage(storageKey, { color, activeIndex, customColors: next });
      return next;
    });
    onCustomizeRef.current?.();
    onChangeRef.current(color);
  };

  const picker = (
    <div
      ref={pickerRef}
      className={cn(
        "z-50 rounded-lg border p-3 shadow-md",
        variant === "dark" ? "border-white/20 bg-black/90" : "border-border bg-popover",
      )}
      style={pickerStyle}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <HexColorPicker color={currentColor} onChange={handleColorChange} />
      <input
        type="text"
        value={currentColor.replace("#", "").toUpperCase()}
        onChange={(e) => {
          const raw = e.target.value;
          if (/^[0-9a-fA-F]{0,6}$/.test(raw) && raw.length === 6) {
            handleColorChange(`#${raw}`);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); setEditing(false); }
          if (e.key === "Enter") setEditing(false);
        }}
        maxLength={7}
        className={cn(
          "mt-2 w-full rounded border px-2 py-1.5 font-mono text-xs outline-none",
          variant === "dark"
            ? "border-white/20 bg-white/10 text-white placeholder-white/40"
            : "border-border bg-muted text-foreground placeholder-muted-foreground",
        )}
        placeholder="000000"
      />
    </div>
  );

  if (variant === "dark") {
    return (
      <div ref={containerRef} className={cn("relative flex items-center gap-2", disabled && "opacity-30 pointer-events-none")}>
        <div ref={circlesRef} className="flex shrink-0 items-center gap-2">
          {PRESET_COLORS.map((c, i) => {
            const bg = customColors[i] ?? c;
            const isActive = i === activeIndex;
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
                onClick={() => handleCircleClick(c, i)}
              />
            );
          })}
        </div>
        {editing && picker}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative flex flex-col items-center gap-2", disabled && "opacity-30 pointer-events-none")}>
      <div ref={circlesRef} className="flex items-center gap-2">
        {PRESET_COLORS.map((c, i) => {
          const bg = customColors[i] ?? c;
          const isActive = i === activeIndex;
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
              onClick={() => handleCircleClick(c, i)}
            />
          );
        })}
      </div>
      {editing && picker}
    </div>
  );
}
