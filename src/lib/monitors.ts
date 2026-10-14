import { invoke } from "@tauri-apps/api/core";

export interface MonitorInfo {
  id: string;
  name: string | null;
  width: number;
  height: number;
  primary: boolean;
}

export async function listMonitors(): Promise<MonitorInfo[]> {
  return invoke<MonitorInfo[]>("list_monitors");
}

export async function getMonitorConfig(): Promise<string[]> {
  return invoke<string[] | null>("get_monitor_config").then((v) => v ?? []);
}

export async function setMonitorConfig(ids: string[]): Promise<void> {
  await invoke("set_monitor_config", { ids });
}

// Sem isso o Rust continua servindo o documento anterior para a projeção.
export async function clearDocument(): Promise<void> {
  await invoke("clear_document");
}

export async function openProjections(monitorIds: string[]): Promise<void> {
  await invoke("open_projections", { monitorIds });
}

export async function closeProjection(): Promise<void> {
  await invoke("close_projection");
}
