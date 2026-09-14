import { invoke } from "@tauri-apps/api/core";

export interface MonitorInfo {
  id: string;
  name: string | null;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleFactor: number;
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

export async function openProjections(monitorIds: string[]): Promise<void> {
  await invoke("open_projections", { monitorIds });
}

export async function closeProjection(): Promise<void> {
  await invoke("close_projection");
}
