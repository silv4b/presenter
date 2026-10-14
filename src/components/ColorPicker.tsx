import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";
import { HexInput } from "@/components/HexInput";

const PICKER_WIDTH = 222; // largura padrão do react-colorful
const PICKER_MARGIN = 8;
const PICKER_GAP = 10;
const PICKER_Z_INDEX = 50;
const PICKER_LEFT_OFFSET = -700; // deslocamento empírico que aproxima o popup do seletor

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
];

const PRESET_LABELS = [
  "Vermelho",
  "Laranja",
  "Amarelo",
  "Verde",
  "Azul",
  "Roxo",
];

interface ColorPickerProps {
  value?: string;
  defaultColor?: string;
  onChange: (color: string) => void;
  variant?: "default" | "dark";
  disabled?: boolean;
}

export function ColorPicker({ value, defaultColor = PRESET_COLORS[0], onChange, variant = "default", disabled }: ColorPickerProps) {
  const [editing, setEditing] = useState(false);
  const initialColor = value ?? defaultColor;
  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = PRESET_COLORS.indexOf(initialColor);
    return idx >= 0 ? idx : 0;
  });
  const [currentColor, setCurrentColor] = useState(initialColor);
  const [customColors, setCustomColors] = useState<Record<number, string>>(() => {
    if (PRESET_COLORS.indexOf(initialColor) >= 0) return {} as Record<number, string>;
    return { 0: initialColor };
  });
  const [pickerStyle, setPickerStyle] = useState<React.CSSProperties>({});
  const pickerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const circlesRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const customColorsRef = useRef(customColors);
  customColorsRef.current = customColors;

  useEffect(() => {
    if (value !== undefined && value !== currentColor) {
      setCurrentColor(value);
      const idx = PRESET_COLORS.indexOf(value);
      if (idx >= 0) {
        setActiveIndex(idx);
      } else {
        const existingKey = Object.keys(customColorsRef.current).find(
          (k) => customColorsRef.current[Number(k)] === value,
        );
        const targetIdx = existingKey !== undefined ? Number(existingKey) : 0;
        setActiveIndex(targetIdx);
        setCustomColors((prev) => ({ ...prev, [targetIdx]: value }));
      }
    }
  }, [value]);

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

    let left = centerX - halfPicker + PICKER_LEFT_OFFSET;
    if (left < margin) left = margin;
    if (left + PICKER_WIDTH > window.innerWidth - margin) {
      left = window.innerWidth - margin - PICKER_WIDTH;
    }

    const top = rect.bottom + PICKER_GAP;

    setPickerStyle({ position: "fixed", left, top, width: PICKER_WIDTH, zIndex: PICKER_Z_INDEX });
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
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [editing, clampPickerPosition]);

  const handleCircleClick = (c: string, index: number) => {
    const resolved = customColors[index] ?? c;
    if (index === activeIndex) {
      setEditing((prev) => !prev);
    } else {
      setActiveIndex(index);
      setCurrentColor(resolved);
      setEditing(false);
      onChangeRef.current(resolved);
    }
  };

  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    setCustomColors((prev) => ({ ...prev, [activeIndex]: color }));
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
      <HexInput
        color={currentColor}
        onChange={handleColorChange}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); setEditing(false); }
          if (e.key === "Enter") setEditing(false);
        }}
        className={cn(
          variant === "dark"
            ? "border-white/20 bg-white/10 text-white placeholder-white/40"
            : "border-border bg-muted text-foreground placeholder-muted-foreground",
        )}
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
                  "size-5 shrink-0 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer",
                  "border-white/30",
                  isActive && "border-white scale-110",
                )}
                style={{ backgroundColor: bg }}
                onClick={() => handleCircleClick(c, i)}
                title={PRESET_LABELS[i]}
                aria-label={PRESET_LABELS[i]}
                aria-pressed={isActive}
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
                "size-5 shrink-0 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer",
                "border-border",
                isActive && "border-foreground scale-110",
              )}
              style={{ backgroundColor: bg }}
              onClick={() => handleCircleClick(c, i)}
              title={PRESET_LABELS[i]}
              aria-label={PRESET_LABELS[i]}
              aria-pressed={isActive}
            />
          );
        })}
      </div>
      {editing && picker}
    </div>
  );
}