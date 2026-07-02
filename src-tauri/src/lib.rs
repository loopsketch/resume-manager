mod llm;

use std::fs;
use std::path::PathBuf;

use tauri::Manager;

const RESUME_FILE: &str = "resume.json";

fn resume_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("アプリデータディレクトリを取得できません: {e}"))?;
    Ok(dir.join(RESUME_FILE))
}

/// 保存済みの業務履歴書データを読み込む。未保存の場合は None を返す。
#[tauri::command]
fn load_resume(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = resume_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).map_err(|e| format!("読み込みに失敗しました: {e}"))?;
    let value =
        serde_json::from_str(&text).map_err(|e| format!("JSON の解析に失敗しました: {e}"))?;
    Ok(Some(value))
}

/// 業務履歴書データを保存する。
#[tauri::command]
fn save_resume(app: tauri::AppHandle, data: serde_json::Value) -> Result<(), String> {
    let path = resume_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("保存先ディレクトリを作成できません: {e}"))?;
    }
    let text = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("JSON への変換に失敗しました: {e}"))?;
    fs::write(&path, text).map_err(|e| format!("保存に失敗しました: {e}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(llm::LlmState::default())
        .invoke_handler(tauri::generate_handler![
            load_resume,
            save_resume,
            llm::llm_status,
            llm::setup_llm,
            llm::start_llm,
            llm::stop_llm,
            llm::extract_resume,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // アプリ終了時にサイドカーの llama-server を確実に停止する
            if let tauri::RunEvent::Exit = event {
                app.state::<llm::LlmState>().kill();
            }
        });
}
