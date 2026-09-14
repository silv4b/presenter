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

export async function getMonitorConfig(): Promise<string | null> {
  return invoke<string | null>("get_monitor_config");
}

export async function setMonitorConfig(id: string): Promise<void> {
  await invoke("set_monitor_config", { id });
}

export async function openProjection(monitorId: string | null): Promise<void> {
  await invoke("open_projection", { monitorId });
}

export async function closeProjection(): Promise<void> {
  await invoke("close_projection");
}
