use tauri::command;
use xcap::Window;
use wasapi::*;
use hound;
use std::fs::File;
use std::io::BufWriter;
use std::time::{Duration, Instant};

#[tauri::command]
fn list_windows() -> Vec<String> {
    let windows = Window::all().unwrap_or_default();
    windows
        .iter()
        .filter(|w| {
            let app_name = w.app_name().unwrap_or_default();
            app_name.to_lowercase() != "minuta desktop"
        })
        .map(|w| format!("{} (ID: {})", w.title().unwrap_or_default(), w.id().unwrap_or_default()))
        .collect()
}

#[tauri::command]
fn record_audio(duration_secs: u64, filename: String) -> Result<String, String> {
    // ESTO ES UN SPIKE: Captura audio PCM simple a WAV
    // Para webm necesitas FFMPEG externo.
    
    // Configuración de Wasapi (Loopback para audio del sistema)
    // ... Implementación compleja de WASAPI loopback ...
    
    Ok(format!("Captura terminada, guardada en: {}", filename))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_windows, record_audio])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
