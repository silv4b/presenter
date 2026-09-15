const STORAGE_KEY = "presenter-file-history";
const MAX_HISTORY = 20;

export interface HistoryEntry {
  path: string;
  name: string;
  openedAt: number;
}

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function addToHistory(path: string): HistoryEntry[] {
  const name = path.split(/[\\/]/).pop() ?? path;
  const history = getHistory().filter((e) => e.path !== path);
  const entry: HistoryEntry = { path, name, openedAt: Date.now() };
  const updated = [entry, ...history].slice(0, MAX_HISTORY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function removeFromHistory(path: string): HistoryEntry[] {
  const updated = getHistory().filter((e) => e.path !== path);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearHistory(): HistoryEntry[] {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}
