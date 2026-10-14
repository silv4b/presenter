import { readRaw, removeStorage, writeStorage } from "@/lib/storage";

// A chave antiga usava "presenter-file-history", fora do padrão "presenter." do
// resto do app. Ler só a nova chave apagaria o histórico de quem já usou o
// presenter, então a antiga continua sendo lida e migrada para a nova no primeiro
// uso.
const STORAGE_KEY = "presenter.fileHistory";
const LEGACY_STORAGE_KEY = "presenter-file-history";
const MAX_FILE_HISTORY = 100;

export interface HistoryEntry {
  path: string;
  name: string;
  openedAt: number;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return typeof e.path === "string" && typeof e.name === "string" && typeof e.openedAt === "number";
}

function saveHistory(history: HistoryEntry[]): void {
  writeStorage(STORAGE_KEY, JSON.stringify(history));
}

export function getHistory(): HistoryEntry[] {
  try {
    let raw = readRaw(STORAGE_KEY);
    if (raw === null) {
      raw = readRaw(LEGACY_STORAGE_KEY);
      // Migrou o histórico legado para a chave nova, sem o qual ele se perderia
      // no próximo `saveHistory`.
      if (raw !== null) writeStorage(STORAGE_KEY, raw);
    }
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry);
  } catch {
    return [];
  }
}

export function addToHistory(path: string): HistoryEntry[] {
  const name = path.split(/[\\/]/).pop() ?? path;
  const history = getHistory().filter((e) => e.path !== path);
  const entry: HistoryEntry = { path, name, openedAt: Date.now() };
  const updated = [entry, ...history].slice(0, MAX_FILE_HISTORY);
  saveHistory(updated);
  return updated;
}

export function removeFromHistory(path: string): HistoryEntry[] {
  const updated = getHistory().filter((e) => e.path !== path);
  saveHistory(updated);
  return updated;
}

export function clearHistory(): HistoryEntry[] {
  removeStorage(STORAGE_KEY);
  removeStorage(LEGACY_STORAGE_KEY);
  return [];
}
