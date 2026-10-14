import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface HexInputProps {
  color: string;
  onChange: (color: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  label?: string;
}

export function HexInput({ color, onChange, onKeyDown, className, label = "Cor em hexadecimal" }: HexInputProps) {
  const [text, setText] = useState(() => color.replace("#", "").toUpperCase());

  useEffect(() => {
    setText(color.replace("#", "").toUpperCase());
  }, [color]);

  return (
    <input
      type="text"
      value={text}
      aria-label={label}
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      maxLength={6}
      placeholder="000000"
      onChange={(e) => {
        const raw = e.target.value.replace("#", "");
        if (!/^[0-9a-fA-F]{0,6}$/.test(raw)) return;
        const next = raw.toUpperCase();
        setText(next);
        if (raw.length === 6) onChange(`#${next.toLowerCase()}`);
      }}
      onKeyDown={onKeyDown}
      className={cn(
        "mt-2 w-full rounded border px-2 py-1.5 font-mono text-xs outline-none",
        className,
      )}
    />
  );
}
