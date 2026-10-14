const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function readBoolean(key: string, fallback: boolean): boolean {
  const raw = readRaw(key);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

// Number(null) é 0, e 0 é um número válido: ler a chave sem checar se existe
// faria o clamp devolver o mínimo, nunca o default. Por isso o `raw === null`.
export function readNumber(
  key: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function readHexColor(key: string, fallback: string): string {
  const raw = readRaw(key);
  return raw && HEX_COLOR.test(raw) ? raw : fallback;
}

export function readEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = readRaw(key);
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}