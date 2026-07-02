//! ローカル LLM (llama.cpp / llama-server) のサイドカー管理と履歴書テキストの構造化抽出。
//!
//! llama-server バイナリと GGUF モデルは初回セットアップ時にダウンロードし、
//! アプリデータディレクトリ配下に保存する。

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::AsyncWriteExt;

const LLM_PORT: u16 = 8178;
const MODEL_URL: &str =
    "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf";
const MODEL_FILE: &str = "Qwen3.5-4B-Q4_K_M.gguf";
const LLAMA_RELEASE_API: &str =
    "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest";
const USER_AGENT: &str = "resume-manager";

/// llama-server の子プロセスを保持する状態。
#[derive(Default)]
pub struct LlmState {
    process: Mutex<Option<Child>>,
}

impl LlmState {
    /// サーバープロセスを停止する（未起動なら何もしない）。
    pub fn kill(&self) {
        if let Ok(mut guard) = self.process.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }

    fn is_running(&self) -> bool {
        let Ok(mut guard) = self.process.lock() else {
            return false;
        };
        match guard.as_mut() {
            Some(child) => match child.try_wait() {
                // まだ終了していない = 実行中
                Ok(None) => true,
                _ => {
                    *guard = None;
                    false
                }
            },
            None => false,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmStatus {
    binary_installed: bool,
    model_installed: bool,
    running: bool,
    ready: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    stage: String,
    downloaded: u64,
    total: Option<u64>,
    done: bool,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("アプリデータディレクトリを取得できません: {e}"))
}

fn llama_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("llama"))
}

fn model_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("models").join(MODEL_FILE))
}

/// ディレクトリを再帰的に走査して llama-server バイナリを探す。
fn find_server_binary(dir: &Path) -> Option<PathBuf> {
    let name = if cfg!(windows) {
        "llama-server.exe"
    } else {
        "llama-server"
    };
    let entries = fs::read_dir(dir).ok()?;
    let mut subdirs = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.file_name().is_some_and(|f| f == name) {
            return Some(path);
        }
        if path.is_dir() {
            subdirs.push(path);
        }
    }
    subdirs.iter().find_map(|d| find_server_binary(d))
}

fn http_client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(timeout)
        .build()
        .map_err(|e| format!("HTTP クライアントの初期化に失敗しました: {e}"))
}

/// URL からファイルをダウンロードし、進捗をイベントで通知する。
async fn download_file(
    app: &AppHandle,
    url: &str,
    dest: &Path,
    stage: &str,
) -> Result<(), String> {
    let client = http_client(Duration::from_secs(3600))?;
    let resp = client
        .get(url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("ダウンロードに失敗しました ({url}): {e}"))?;
    let total = resp.content_length();

    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| format!("ファイルを作成できません ({}): {e}", dest.display()))?;
    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emitted: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("ダウンロード中にエラーが発生しました: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("書き込みに失敗しました: {e}"))?;
        downloaded += chunk.len() as u64;
        // 4MB ごとに進捗を通知
        if downloaded - last_emitted >= 4 * 1024 * 1024 {
            last_emitted = downloaded;
            let _ = app.emit(
                "llm-download-progress",
                DownloadProgress {
                    stage: stage.to_string(),
                    downloaded,
                    total,
                    done: false,
                },
            );
        }
    }
    file.flush()
        .await
        .map_err(|e| format!("書き込みに失敗しました: {e}"))?;
    let _ = app.emit(
        "llm-download-progress",
        DownloadProgress {
            stage: stage.to_string(),
            downloaded,
            total,
            done: true,
        },
    );
    Ok(())
}

/// 実行環境に合った llama.cpp 最新リリースのアセット (名前, URL) を解決する。
async fn resolve_llama_asset() -> Result<(String, String), String> {
    let key = if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        "bin-win-cpu-x64.zip"
    } else if cfg!(all(target_os = "windows", target_arch = "aarch64")) {
        "bin-win-cpu-arm64.zip"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "bin-macos-arm64.tar.gz"
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        "bin-macos-x64.tar.gz"
    } else {
        return Err("この環境向けの llama.cpp ビルドが見つかりません".to_string());
    };

    let client = http_client(Duration::from_secs(30))?;
    let release: serde_json::Value = client
        .get(LLAMA_RELEASE_API)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("llama.cpp リリース情報の取得に失敗しました: {e}"))?
        .json()
        .await
        .map_err(|e| format!("リリース情報の解析に失敗しました: {e}"))?;

    let assets = release["assets"]
        .as_array()
        .ok_or("リリース情報にアセットがありません")?;
    for asset in assets {
        let name = asset["name"].as_str().unwrap_or_default();
        if name.contains(key) {
            let url = asset["browser_download_url"]
                .as_str()
                .ok_or("アセットのダウンロード URL がありません")?;
            return Ok((name.to_string(), url.to_string()));
        }
    }
    Err(format!("この環境向けのアセット ({key}) が見つかりません"))
}

/// アーカイブ (zip / tar.gz) を展開する。
async fn extract_archive(archive: PathBuf, dest: PathBuf) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let file = fs::File::open(&archive)
            .map_err(|e| format!("アーカイブを開けません ({}): {e}", archive.display()))?;
        let name = archive.to_string_lossy().to_lowercase();
        if name.ends_with(".zip") {
            let mut zip = zip::ZipArchive::new(file)
                .map_err(|e| format!("zip の読み込みに失敗しました: {e}"))?;
            zip.extract(&dest)
                .map_err(|e| format!("zip の展開に失敗しました: {e}"))?;
        } else if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
            let gz = flate2::read::GzDecoder::new(file);
            tar::Archive::new(gz)
                .unpack(&dest)
                .map_err(|e| format!("tar.gz の展開に失敗しました: {e}"))?;
        } else {
            return Err(format!("未対応のアーカイブ形式です: {name}"));
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("展開処理の実行に失敗しました: {e}"))?
}

async fn health_ok() -> bool {
    let Ok(client) = http_client(Duration::from_secs(2)) else {
        return false;
    };
    match client
        .get(format!("http://127.0.0.1:{LLM_PORT}/health"))
        .send()
        .await
    {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

/// LLM 実行環境の状態を返す。
#[tauri::command]
pub async fn llm_status(
    app: AppHandle,
    state: State<'_, LlmState>,
) -> Result<LlmStatus, String> {
    let binary_installed = find_server_binary(&llama_dir(&app)?).is_some();
    let model_installed = model_path(&app)?.exists();
    let running = state.is_running();
    let ready = running && health_ok().await;
    Ok(LlmStatus {
        binary_installed,
        model_installed,
        running,
        ready,
    })
}

/// llama-server バイナリと GGUF モデルをダウンロードしてセットアップする。
#[tauri::command]
pub async fn setup_llm(app: AppHandle) -> Result<(), String> {
    let llama = llama_dir(&app)?;
    fs::create_dir_all(&llama).map_err(|e| format!("ディレクトリを作成できません: {e}"))?;

    if find_server_binary(&llama).is_none() {
        let (asset_name, url) = resolve_llama_asset().await?;
        let archive = llama.join(&asset_name);
        download_file(&app, &url, &archive, "binary").await?;
        extract_archive(archive.clone(), llama.clone()).await?;
        let _ = fs::remove_file(&archive);
        if find_server_binary(&llama).is_none() {
            return Err("展開後に llama-server バイナリが見つかりません".to_string());
        }
    }

    let model = model_path(&app)?;
    if !model.exists() {
        if let Some(parent) = model.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("ディレクトリを作成できません: {e}"))?;
        }
        // 中断に備えて .part にダウンロードしてからリネームする
        let part = model.with_extension("gguf.part");
        download_file(&app, MODEL_URL, &part, "model").await?;
        fs::rename(&part, &model).map_err(|e| format!("モデルの配置に失敗しました: {e}"))?;
    }
    Ok(())
}

/// llama-server を起動し、応答可能になるまで待機する。
#[tauri::command]
pub async fn start_llm(app: AppHandle, state: State<'_, LlmState>) -> Result<(), String> {
    if state.is_running() && health_ok().await {
        return Ok(());
    }

    let binary = find_server_binary(&llama_dir(&app)?)
        .ok_or("llama-server が未セットアップです。先にセットアップを実行してください。")?;
    let model = model_path(&app)?;
    if !model.exists() {
        return Err("モデルが未セットアップです。先にセットアップを実行してください。".to_string());
    }

    let mut cmd = Command::new(&binary);
    cmd.args([
        "-m",
        &model.to_string_lossy(),
        "--host",
        "127.0.0.1",
        "--port",
        &LLM_PORT.to_string(),
        "-c",
        "16384",
        "--jinja",
        // 思考モードを無効化（CPU での応答時間短縮のため）
        "--reasoning-budget",
        "0",
        "--no-webui",
    ])
    .stdout(Stdio::null())
    .stderr(Stdio::null());
    if let Some(dir) = binary.parent() {
        cmd.current_dir(dir);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // コンソールウィンドウを表示しない
        cmd.creation_flags(0x0800_0000);
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("llama-server の起動に失敗しました: {e}"))?;
    if let Ok(mut guard) = state.process.lock() {
        // 既存プロセスが残っていれば置き換え前に停止
        if let Some(mut old) = guard.replace(child) {
            let _ = old.kill();
            let _ = old.wait();
        }
    }

    // モデルのロード完了 (health OK) を最大 3 分待つ
    for _ in 0..360 {
        if health_ok().await {
            return Ok(());
        }
        if !state.is_running() {
            return Err("llama-server が予期せず終了しました".to_string());
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    state.kill();
    Err("llama-server の起動がタイムアウトしました".to_string())
}

/// llama-server を停止する。
#[tauri::command]
pub async fn stop_llm(state: State<'_, LlmState>) -> Result<(), String> {
    state.kill();
    Ok(())
}

const SYSTEM_PROMPT: &str = "あなたは業務履歴書（職務経歴書）を構造化するアシスタントです。\
与えられたテキストから情報を抽出し、指定された JSON スキーマに従って出力してください。\n\
ルール:\n\
- 年月は YYYY-MM 形式で出力する（例: 2024-04）。不明な場合は空文字列にする。\n\
- 記載がない項目は空文字列または空配列にする。推測で埋めない。\n\
- スキルの経験年数は記載から読み取れる場合のみ数値で出力し、不明なら 0 にする。\n\
- プロジェクトは新しい順に出力する。\n\
- 出力はすべて日本語とする（技術名などの固有名詞は原文のまま）。";

/// 履歴書抽出結果の JSON スキーマ（フロントの ResumeData から id / version を除いた形）。
fn extraction_schema() -> serde_json::Value {
    serde_json::json!({
        "type": "object",
        "properties": {
            "profile": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "nameKana": { "type": "string" },
                    "birthMonth": { "type": "string" },
                    "location": { "type": "string" },
                    "education": { "type": "string" },
                    "summary": { "type": "string" }
                },
                "required": ["name", "nameKana", "birthMonth", "location", "education", "summary"]
            },
            "skills": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": { "type": "string" },
                        "category": {
                            "type": "string",
                            "enum": ["言語", "フレームワーク", "データベース", "インフラ・クラウド", "ツール", "その他"]
                        },
                        "years": { "type": "number" },
                        "level": { "type": "string", "enum": ["初級", "中級", "上級"] },
                        "note": { "type": "string" }
                    },
                    "required": ["name", "category", "years", "level", "note"]
                }
            },
            "projects": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": { "type": "string" },
                        "startMonth": { "type": "string" },
                        "endMonth": { "type": "string" },
                        "role": { "type": "string" },
                        "teamSize": { "type": "string" },
                        "description": { "type": "string" },
                        "technologies": { "type": "array", "items": { "type": "string" } },
                        "phases": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": ["要件定義", "基本設計", "詳細設計", "実装", "テスト", "運用・保守"]
                            }
                        },
                        "achievements": { "type": "string" }
                    },
                    "required": ["name", "startMonth", "endMonth", "role", "teamSize", "description", "technologies", "phases", "achievements"]
                }
            }
        },
        "required": ["profile", "skills", "projects"]
    })
}

/// 履歴書テキストを LLM で解析し、構造化された JSON を返す。
#[tauri::command]
pub async fn extract_resume(
    state: State<'_, LlmState>,
    text: String,
) -> Result<serde_json::Value, String> {
    if !state.is_running() || !health_ok().await {
        return Err("LLM サーバーが起動していません。先に起動してください。".to_string());
    }

    // コンテキスト長に収まるよう入力を制限（約 10,000 文字）
    let truncated: String = text.chars().take(10_000).collect();

    let body = serde_json::json!({
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            {
                "role": "user",
                "content": format!("以下の業務履歴書のテキストから情報を抽出してください。\n\n---\n{truncated}\n---")
            }
        ],
        "temperature": 0.1,
        "max_tokens": 4096,
        "response_format": {
            "type": "json_schema",
            "json_schema": { "name": "resume", "schema": extraction_schema() }
        }
    });

    // CPU 推論のため長めのタイムアウトを設定
    let client = http_client(Duration::from_secs(900))?;
    let resp: serde_json::Value = client
        .post(format!("http://127.0.0.1:{LLM_PORT}/v1/chat/completions"))
        .json(&body)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("LLM への問い合わせに失敗しました: {e}"))?
        .json()
        .await
        .map_err(|e| format!("LLM 応答の解析に失敗しました: {e}"))?;

    let content = resp["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("LLM の応答形式が不正です")?;
    serde_json::from_str(content).map_err(|e| format!("抽出結果の JSON 解析に失敗しました: {e}"))
}
