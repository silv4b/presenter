import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PRESET_BG_COLORS = [
  { label: "Preto", value: "#000000" },
  { label: "Branco", value: "#ffffff" },
  { label: "Cinza", value: "#737373" },
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  alwaysShowFloatingControls: boolean;
  onAlwaysShowFloatingControlsChange: (value: boolean) => void;
  floatingControlsTimeout: number;
  onFloatingControlsTimeoutChange: (value: number) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  backgroundColor,
  onBackgroundColorChange,
  alwaysShowFloatingControls,
  onAlwaysShowFloatingControlsChange,
  floatingControlsTimeout,
  onFloatingControlsTimeoutChange,
}: SettingsDialogProps) {
  const isPreset = PRESET_BG_COLORS.some((c) => c.value === backgroundColor);
  const [editing, setEditing] = useState(false);
  const [lastCustom, setLastCustom] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState(backgroundColor.replace("#", "").toUpperCase());
  const pickerRef = useRef<HTMLDivElement>(null);
  const customBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHexInput(backgroundColor.replace("#", "").toUpperCase());
  }, [backgroundColor]);

  useEffect(() => {
    if (!editing) return;
    const handleClickOutside = (e: PointerEvent) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        customBtnRef.current && !customBtnRef.current.contains(e.target as Node)
      ) {
        setEditing(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside, true);
    return () => document.removeEventListener("pointerdown", handleClickOutside, true);
  }, [editing]);

  const handlePresetClick = (color: string) => {
    if (color === backgroundColor) {
      setEditing((prev) => !prev);
    } else {
      onBackgroundColorChange(color);
      setEditing(false);
    }
  };

  const handleCustomClick = () => {
    setEditing((prev) => !prev);
  };

  const handleColorChange = (color: string) => {
    setLastCustom(color);
    onBackgroundColorChange(color);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>Personalize a aparência do aplicativo.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="relative flex flex-col gap-2">
            <span className="text-sm font-medium">Cor de fundo</span>
            <p className="text-xs text-muted-foreground">
              Cor da área atrás dos slides durante a apresentação e no modo de edição.
            </p>
            <div className="flex items-center gap-3 pt-1">
              {PRESET_BG_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={cn(
                    "size-8 shrink-0 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer",
                    backgroundColor === c.value
                      ? "border-foreground scale-110"
                      : "border-border",
                  )}
                  style={{ backgroundColor: c.value }}
                  onClick={() => handlePresetClick(c.value)}
                  title={c.label}
                />
              ))}
              <button
                ref={customBtnRef}
                type="button"
                className={cn(
                  "size-8 shrink-0 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer",
                  isPreset ? "border-border" : "border-foreground scale-110",
                )}
                style={{ backgroundColor: isPreset ? (lastCustom ?? "#3f3f46") : backgroundColor }}
                onClick={handleCustomClick}
                title="Personalizado"
              />
            </div>
            {editing && (
              <div
                ref={pickerRef}
                className="absolute left-0 top-full z-50 mt-2 rounded-lg border border-border bg-popover p-3 shadow-md"
              >
                <HexColorPicker color={backgroundColor} onChange={handleColorChange} />
                <input
                  type="text"
                  value={hexInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace("#", "");
                    if (/^[0-9a-fA-F]{0,6}$/.test(raw)) {
                      setHexInput(raw.toUpperCase());
                      if (raw.length === 6) {
                        handleColorChange(`#${raw}`);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" || e.key === "Enter") setEditing(false);
                  }}
                  maxLength={6}
                  className="mt-2 w-full rounded border border-border bg-muted px-2 py-1.5 font-mono text-xs text-foreground outline-none placeholder-muted-foreground"
                  placeholder="000000"
                />
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Controles flutuantes sempre visíveis</span>
              <p className="text-xs text-muted-foreground">
                Mantém os controles visíveis durante a apresentação sem esconder automaticamente.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={alwaysShowFloatingControls}
              onClick={() => onAlwaysShowFloatingControlsChange(!alwaysShowFloatingControls)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                alwaysShowFloatingControls ? "bg-primary" : "bg-input",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  alwaysShowFloatingControls ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className={cn("text-sm font-medium", alwaysShowFloatingControls && "text-muted-foreground")}>
                Tempo de exibição dos controles
              </span>
              <p className="text-xs text-muted-foreground">
                Tempo em segundos antes dos controles desaparecerem.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={30}
                value={floatingControlsTimeout}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 1 && v <= 30) onFloatingControlsTimeoutChange(v);
                }}
                disabled={alwaysShowFloatingControls}
                className={cn(
                  "w-14 rounded border border-border bg-muted px-2 py-1 text-center font-mono text-xs text-foreground outline-none",
                  alwaysShowFloatingControls && "cursor-not-allowed opacity-40",
                )}
              />
              <span className="text-xs text-muted-foreground">s</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
