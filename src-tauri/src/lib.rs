use base64::Engine;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Monitor, WebviewUrl, WebviewWindowBuilder, WindowEvent};

const VIEWSCREEN_PREFIX: &str = "viewscreen";

#[derive(Default)]
struct DocState(Mutex<Option<DocInfo>>);

#[derive(Clone, Serialize)]
struct DocInfo {
    path: String,
    name: String,
    page: u32,
}

#[derive(Clone, Serialize)]
struct MonitorInfo {
    id: String,
    name: Option<String>,
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    scale_factor: f64,
    primary: bool,
}

#[derive(Default)]
struct MonitorState(Mutex<Option<Vec<String>>>);

#[tauri::command]
fn read_pdf(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:application/pdf;base64,{b64}"))
}

#[tauri::command]
fn set_document(state: tauri::State<DocState>, path: String, name: String, page: u32) {
    *state.0.lock().unwrap() = Some(DocInfo { path, name, page });
}

#[tauri::command]
fn get_document(state: tauri::State<DocState>) -> Option<DocInfo> {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
fn list_monitors(app: AppHandle) -> Vec<MonitorInfo> {
    let primary_pos = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.position().clone());
    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|m| {
            let pos = m.position();
            let size = m.size();
            let name = m.name().cloned();
            let id = name
                .clone()
                .unwrap_or_else(|| format!("monitor:{}x{}", pos.x, pos.y));
            let primary = primary_pos
                .as_ref()
                .map(|p| p.x == pos.x && p.y == pos.y)
                .unwrap_or(false);
            MonitorInfo {
                id,
                name,
                width: size.width,
                height: size.height,
                x: pos.x,
                y: pos.y,
                scale_factor: m.scale_factor(),
                primary,
            }
        })
        .collect()
}

#[tauri::command]
fn get_monitor_config(state: tauri::State<MonitorState>, app: AppHandle) -> Option<Vec<String>> {
    let mut guard = state.0.lock().unwrap();
    if guard.is_none() {
        *guard = read_monitor_config(&app);
    }
    guard.clone()
}

#[tauri::command]
fn set_monitor_config(state: tauri::State<MonitorState>, app: AppHandle, ids: Vec<String>) {
    *state.0.lock().unwrap() = Some(ids.clone());
    write_monitor_config(&app, &ids);
}

fn config_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("config.json"))
}

fn read_monitor_config(app: &AppHandle) -> Option<Vec<String>> {
    #[derive(Deserialize)]
    struct Config {
        monitors: Option<Vec<String>>,
    }
    let path = config_path(app)?;
    let data = std::fs::read_to_string(path).ok()?;
    let config: Config = serde_json::from_str(&data).ok()?;
    config.monitors.or_else(|| {
        // migration: single "monitor" key → array
        #[derive(Deserialize)]
        struct LegacyConfig {
            monitor: Option<String>,
        }
        let legacy: LegacyConfig = serde_json::from_str(&data).ok()?;
        legacy.monitor.map(|m| vec![m])
    })
}

fn write_monitor_config(app: &AppHandle, ids: &[String]) {
    if let Some(path) = config_path(app) {
        let config = serde_json::json!({ "monitors": ids });
        if let Ok(s) = serde_json::to_string(&config) {
            let _ = std::fs::write(path, s);
        }
    }
}

fn monitor_key(m: &Monitor) -> String {
    let pos = m.position();
    m.name()
        .cloned()
        .unwrap_or_else(|| format!("monitor:{}x{}", pos.x, pos.y))
}

fn viewscreen_label(idx: usize) -> String {
    format!("{}-{}", VIEWSCREEN_PREFIX, idx)
}

#[tauri::command]
async fn open_projections(app: AppHandle, monitor_ids: Vec<String>) -> Result<(), String> {
    // close existing viewscreen windows first
    close_all_viewscreens(&app);

    let monitors = app.available_monitors().map_err(|e| e.to_string())?;

    for (idx, target_id) in monitor_ids.iter().enumerate() {
        let label = viewscreen_label(idx);

        let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
            .title("Presenter — Projeção")
            .decorations(false)
            .resizable(false)
            .visible(false)
            .build()
            .map_err(|e| e.to_string())?;

        let target = monitors.iter().find(|m| monitor_key(m) == *target_id);

        if let Some(monitor) = target {
            let pos = monitor.position().clone();
            let size = monitor.size().clone();
            window
                .set_position(tauri::PhysicalPosition::new(pos.x, pos.y))
                .map_err(|e| e.to_string())?;
            window
                .set_size(tauri::PhysicalSize::new(size.width, size.height))
                .map_err(|e| e.to_string())?;
        }

        window.show().map_err(|e| e.to_string())?;
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
    }

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.set_focus();
    }

    Ok(())
}

fn close_all_viewscreens(app: &AppHandle) {
    let labels: Vec<String> = app
        .webview_windows()
        .into_iter()
        .map(|(label, _win)| label)
        .filter(|label| label.starts_with(VIEWSCREEN_PREFIX))
        .collect();
    for label in labels {
        if let Some(w) = app.get_webview_window(&label) {
            let _ = w.destroy();
        }
    }
}

#[tauri::command]
fn close_projection(app: AppHandle) {
    close_all_viewscreens(&app);
}

#[tauri::command]
fn save_file(path: String, data: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DocState::default())
        .manage(MonitorState::default())
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    let app = window.app_handle();
                    close_all_viewscreens(app);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_pdf,
            set_document,
            get_document,
            list_monitors,
            get_monitor_config,
            set_monitor_config,
            open_projections,
            close_projection,
            save_file
        ])
        .setup(|app| {
            let icon_bytes = include_bytes!("../../src/assets/presenter-icon.png");
            let decoder = png::Decoder::new(std::io::Cursor::new(icon_bytes));
            let mut reader = decoder.read_info().expect("failed to decode icon PNG");
            let mut buf = vec![0u8; reader.output_buffer_size()];
            let info = reader.next_frame(&mut buf).expect("failed to read icon frame");
            buf.truncate(info.buffer_size());
            let icon = tauri::image::Image::new_owned(buf, info.width, info.height);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(icon);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
