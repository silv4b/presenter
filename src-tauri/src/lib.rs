use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::utils::config::AppDirectoriesOverride;
use tauri::{AppHandle, Manager, Monitor, WebviewUrl, WebviewWindowBuilder, WindowEvent};

const VIEWSCREEN_PREFIX: &str = "viewscreen";

/// Arquivo que, presente na mesma pasta do executável, ativa o modo portátil.
const PORTABLE_MARKER: &str = "portable.txt";

/// Pasta que recebe todos os dados do app quando o modo portátil está ativo.
const PORTABLE_DATA_DIR: &str = "app-data";

#[derive(Default)]
struct DocState(Mutex<Option<DocInfo>>);

#[derive(Clone, Serialize)]
struct DocInfo {
    path: String,
    name: String,
    page: u32,
}

/// Serializado em camelCase para bater com o tipo `MonitorInfo` do frontend.
/// Só carrega o que a interface usa: posição e fator de escala não são exibidos.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MonitorInfo {
    id: String,
    name: Option<String>,
    width: u32,
    height: u32,
    primary: bool,
}

/// Cache da seleção de monitores.
///
/// Antes guardava só `Option<Vec<String>>`, o que fazia o valor valer para a
/// sessão inteira: editar o `config.json` por fora, ou trocar a pasta portátil,
/// era ignorado até reiniciar o app. Guarda também a assinatura do arquivo no
/// disco para reler quando ele mudar por fora.
#[derive(Default)]
struct MonitorState(Mutex<MonitorCache>);

/// Último estado maximizado conhecido da janela principal. Serve para só gravar
/// no `config.json` quando o estado muda, e não a cada evento de redimensionar.
#[derive(Default)]
struct WindowState(Mutex<Option<bool>>);

#[derive(Default)]
struct MonitorCache {
    ids: Option<Vec<String>>,
    signature: Option<FileSignature>,
}

/// Identifica o `config.json` no disco sem depender de crate extra: tamanho e
/// data de modificação. Só comparação — se não der para ler, fica `None` e a
/// releitura acontece na próxima consulta, que é o caso seguro.
#[derive(Clone, PartialEq)]
struct FileSignature {
    len: u64,
    modified: Option<std::time::SystemTime>,
}

fn file_signature(path: &std::path::Path) -> Option<FileSignature> {
    let meta = std::fs::metadata(path).ok()?;
    Some(FileSignature {
        len: meta.len(),
        modified: meta.modified().ok(),
    })
}

#[tauri::command]
fn read_pdf(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:application/pdf;base64,{b64}"))
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
fn set_document(state: tauri::State<DocState>, path: String, name: String, page: u32) {
    *state.0.lock().unwrap() = Some(DocInfo { path, name, page });
}

#[tauri::command]
fn get_document(state: tauri::State<DocState>) -> Option<DocInfo> {
    state.0.lock().unwrap().clone()
}

/// Esquece o documento atual. Sem isso o `DocState` continua apontando para o
/// PDF anterior e uma nova projeção abriria o arquivo velho.
#[tauri::command]
fn clear_document(state: tauri::State<DocState>) {
    *state.0.lock().unwrap() = None;
}

/// Identificador estável de um monitor. Fonte única para `list_monitors` e
/// `open_projections`: se os dois divergirem, a seleção não acha o monitor.
fn monitor_id(m: &Monitor) -> String {
    let pos = m.position();
    m.name()
        .cloned()
        .unwrap_or_else(|| format!("monitor:{}x{}", pos.x, pos.y))
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
            let id = monitor_id(&m);
            let primary = primary_pos
                .as_ref()
                .map(|p| p.x == pos.x && p.y == pos.y)
                .unwrap_or(false);
            MonitorInfo {
                id,
                name,
                width: size.width,
                height: size.height,
                primary,
            }
        })
        .collect()
}

/// Lê a seleção de monitores, relendo o arquivo quando ele mudou por fora.
///
/// O cache existia só para não bater no disco a cada chamada, mas sem conferir
/// a assinatura do arquivo ele segurava o valor antigo indefinidamente: editar o
/// `config.json` na mão, ou apontar o app para outra pasta portátil na mesma
/// sessão, não tinha efeito. Agora a releitura acontece só quando o arquivo
/// realmente mudou, então o caminho rápido continua sendo memória.
#[tauri::command]
fn get_monitor_config(state: tauri::State<MonitorState>, app: AppHandle) -> Option<Vec<String>> {
    let path = config_path(&app);
    let on_disk = path.as_deref().and_then(file_signature);
    let mut guard = state.0.lock().unwrap();

    if guard.signature != on_disk {
        guard.ids = read_monitor_config(&app);
        guard.signature = on_disk;
    }
    guard.ids.clone()
}

#[tauri::command]
fn set_monitor_config(
    state: tauri::State<MonitorState>,
    app: AppHandle,
    ids: Vec<String>,
) -> Result<(), String> {
    write_monitor_config(&app, &ids)?;
    // A assinatura é lida depois da escrita para não correr o risco de registrar
    // a do arquivo antigo e invalidar o cache na próxima consulta.
    let mut guard = state.0.lock().unwrap();
    guard.signature = config_path(&app).as_deref().and_then(file_signature);
    guard.ids = Some(ids);
    Ok(())
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

fn write_monitor_config(app: &AppHandle, ids: &[String]) -> Result<(), String> {
    update_config(app, |root| {
        root["monitors"] = serde_json::json!(ids);
    })
}

/// Lê o estado maximizado persistido da janela principal. Ausente = maximizado,
/// que é o padrão do app.
fn read_window_maximized(app: &AppHandle) -> bool {
    #[derive(Deserialize)]
    struct Config {
        #[serde(rename = "windowMaximized")]
        window_maximized: Option<bool>,
    }
    config_path(app)
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|data| serde_json::from_str::<Config>(&data).ok())
        .and_then(|config| config.window_maximized)
        .unwrap_or(true)
}

fn write_window_maximized(app: &AppHandle, value: bool) -> Result<(), String> {
    update_config(app, |root| {
        root["windowMaximized"] = serde_json::json!(value);
    })
}

/// Aplica uma alteração no `config.json` preservando as demais chaves.
fn update_config(
    app: &AppHandle,
    update: impl FnOnce(&mut serde_json::Value),
) -> Result<(), String> {
    let path = config_path(app)
        .ok_or_else(|| "não foi possível localizar a pasta de configuração".to_string())?;

    let mut root: serde_json::Value = std::fs::read_to_string(&path)
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| serde_json::json!({}));
    update(&mut root);

    let serialized =
        serde_json::to_string_pretty(&root).map_err(|e| format!("config.json: {e}"))?;

    // Escrita atômica: grava ao lado e renomeia por cima. `fs::write` trunca o
    // destino antes de escrever, e um crash no meio deixaria o arquivo
    // corrompido — o que volta como lista vazia na próxima leitura.
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serialized.as_bytes()).map_err(|e| format!("config.json: {e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("config.json: {e}")
    })
}

/// Retorna a pasta de dados do modo portátil quando existe um `portable.txt`
/// ao lado do executável. Sem o marcador, o app usa os diretórios padrão do
/// sistema (`%APPDATA%`), preservando o comportamento da versão instalada.
fn portable_data_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?.to_path_buf();
    dir.join(PORTABLE_MARKER)
        .is_file()
        .then(|| dir.join(PORTABLE_DATA_DIR))
}

fn viewscreen_label(idx: usize) -> String {
    format!("{}-{}", VIEWSCREEN_PREFIX, idx)
}

#[tauri::command]
async fn open_projections(app: AppHandle, monitor_ids: Vec<String>) -> Result<(), String> {
    // Fecha as janelas de projeção abertas antes de abrir as novas
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

        let target = monitors.iter().find(|m| monitor_id(m) == *target_id);

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
    let mut context = tauri::generate_context!();

    if let Some(dir) = portable_data_dir() {
        context.config_mut().app.app_directories_override = Some(AppDirectoriesOverride::Root(dir));
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DocState::default())
        .manage(MonitorState::default())
        .manage(WindowState::default())
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            match event {
                WindowEvent::Destroyed => {
                    close_all_viewscreens(window.app_handle());
                }
                // Maximizar/restaurar também dispara `Resized`. Persistimos só a
                // mudança de estado, não cada arrasto da borda.
                WindowEvent::Resized(_) => {
                    let app = window.app_handle();
                    let maximized = window.is_maximized().unwrap_or(false);
                    let state = app.state::<WindowState>();
                    let mut guard = state.0.lock().unwrap();
                    if *guard != Some(maximized) {
                        *guard = Some(maximized);
                        if let Err(e) = write_window_maximized(app, maximized) {
                            eprintln!("Falha ao salvar o estado da janela: {e}");
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_pdf,
            file_exists,
            set_document,
            get_document,
            clear_document,
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
            let info = reader
                .next_frame(&mut buf)
                .expect("failed to read icon frame");
            buf.truncate(info.buffer_size());
            let icon = tauri::image::Image::new_owned(buf, info.width, info.height);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(icon);

                // A janela nasce oculta (visible: false no tauri.conf.json) para
                // não piscar: aplicamos o estado salvo e só então mostramos.
                let maximized = read_window_maximized(app.handle());
                {
                    let state = app.state::<WindowState>();
                    *state.0.lock().unwrap() = Some(maximized);
                }
                if maximized {
                    let _ = window.maximize();
                }
                let _ = window.show();
            }
            Ok(())
        })
        .run(context)
        .expect("error while running tauri application");
}
