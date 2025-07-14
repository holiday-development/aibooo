// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use chrono::Local;
use dotenvy_macro::dotenv;
use std::env;
use tauri::{App, AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;

// AWS Cognito関連のimport (必要なものだけ残す)

// Cognitoサービスモジュール
mod cognito;
use cognito::{CognitoService, SignUpResponse, SignInResponse, ConfirmSignUpResponse, CognitoError};

static GENERATION_LIMIT: u64 = 20;
const API_URL: &str = dotenv!("API_URL");

// AWS Cognito設定
const AWS_REGION: &str = dotenv!("AWS_REGION");
const COGNITO_USER_POOL_ID: &str = dotenv!("COGNITO_USER_POOL_ID");
const COGNITO_CLIENT_ID: &str = dotenv!("COGNITO_CLIENT_ID");

// Cognitoサービスのインスタンスを作成するヘルパー関数
async fn create_cognito_service() -> Result<CognitoService, CognitoError> {
    CognitoService::new(
        COGNITO_USER_POOL_ID.to_string(),
        COGNITO_CLIENT_ID.to_string()
    ).await
}

// ユーザー登録用のTauriコマンド
#[tauri::command]
async fn register_user(email: String, password: String) -> Result<SignUpResponse, String> {
    let cognito_service = create_cognito_service().await
        .map_err(|e| format!("Cognitoサービスの初期化に失敗しました: {}", e))?;

    cognito_service.sign_up(&email, &password).await
        .map_err(|e| format!("ユーザー登録に失敗しました: {}", e))
}

// メール認証確認用のTauriコマンド
#[tauri::command]
async fn verify_email(email: String, confirmation_code: String) -> Result<ConfirmSignUpResponse, String> {
    let cognito_service = create_cognito_service().await
        .map_err(|e| format!("Cognitoサービスの初期化に失敗しました: {}", e))?;

    cognito_service.confirm_sign_up(&email, &confirmation_code).await
        .map_err(|e| format!("メール認証に失敗しました: {}", e))
}

// ログイン用のTauriコマンド
#[tauri::command]
async fn login_user(email: String, password: String) -> Result<SignInResponse, String> {
    let cognito_service = create_cognito_service().await
        .map_err(|e| format!("Cognitoサービスの初期化に失敗しました: {}", e))?;

    cognito_service.sign_in(&email, &password).await
        .map_err(|e| format!("ログインに失敗しました: {}", e))
}

// メール認証とログインを同時に行うコマンド
#[derive(serde::Deserialize)]
struct VerifyEmailAndLoginRequest {
    email: String,
    password: String,
    confirmation_code: String,
}

#[tauri::command]
async fn verify_email_and_login(request: VerifyEmailAndLoginRequest) -> Result<SignInResponse, String> {
    let cognito_service = create_cognito_service().await
        .map_err(|e| format!("Cognitoサービスの初期化に失敗しました: {}", e))?;

    cognito_service.confirm_sign_up_and_sign_in(&request.email, &request.password, &request.confirmation_code).await
        .map_err(|e| format!("メール認証とログインに失敗しました: {}", e))
}

// 認証状態をチェックするヘルパー関数
fn is_user_authenticated(app_handle: &tauri::AppHandle) -> bool {
    let store = match app_handle.store("auth.json") {
        Ok(store) => store,
        Err(_) => return false,
    };

    let tokens = match store.get("tokens") {
        Some(tokens) => tokens,
        None => return false,
    };

    // トークンの有効期限をチェック
    if let Some(expires_at) = tokens.get("expires_at").and_then(|v| v.as_u64()) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        expires_at > now
    } else {
        false
    }
}

#[tauri::command]
async fn convert_text(
    text: &str,
    type_: &str,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // 認証済みユーザーは制限をスキップ
    if !is_user_authenticated(&app_handle) {
        // 利用回数制限のためのストア取得
        let store = app_handle.store("usage.json").map_err(|e| {
            serde_json::json!({"type": "store_error", "message": e.to_string()}).to_string()
        })?;
        let today = Local::now().format("%Y-%m-%d").to_string();
        let mut request_count = store
            .get("request_count")
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default();
        let count = request_count
            .get(&today)
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        if count >= GENERATION_LIMIT {
            return Err(serde_json::json!({
                "type": "limit_exceeded",
                "message": format!("本日の利用回数上限（{}回）に達しました", GENERATION_LIMIT)
            })
            .to_string());
        }
        request_count.insert(today.clone(), serde_json::json!(count + 1));
        store.set("request_count", serde_json::json!(request_count));
        store.save().map_err(|e| {
            serde_json::json!({"type": "store_error", "message": e.to_string()}).to_string()
        })?;
    }

    println!(
        "convert_text関数が呼び出されました: テキスト長さ {}",
        text.len()
    );

    let client = reqwest::Client::new();
    // .envや環境変数からURLを取得
    let url = format!("{}/{}", API_URL, type_);
    println!("url: {}", url);
    if url.is_empty() {
        return Err(serde_json::json!({"type": "env_error", "message": "API_URL環境変数が設定されていません"}).to_string());
    }

    let mut map: std::collections::HashMap<&'static str, String> = std::collections::HashMap::new();
    map.insert("prompt", text.to_string());

    let res = client
        .post(url)
        .json(&map)
        .send()
        .await
        .map_err(|e| serde_json::json!({"type": "http_error", "message": format!("HTTPリクエストエラー: {}", e)}).to_string())?;

    let status = res.status();
    let body = res
        .text()
        .await
        .map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;

    if !status.is_success() {
        println!("APIエラー: {} {}", status, body);
        return Err(serde_json::json!({
            "type": "api_error",
            "message": format!("APIエラー: {} {}", status, body)
        })
        .to_string());
    }

    // JSONとしてパースし、generatedTextキーの値を返す
    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| serde_json::json!({"type": "parse_error", "message": format!("JSONパースエラー: {}", e)}).to_string())?;
    if let Some(output_text) = json.get("output_text").and_then(|v| v.as_str()) {
        println!("APIレスポンス受信: {}", output_text.len());
        Ok(output_text.to_string())
    } else {
        println!("APIレスポンスにoutput_textがありません: {}", body);
        Err(serde_json::json!({
            "type": "api_error",
            "message": "APIレスポンスにoutput_textがありません"
        })
        .to_string())
    }
}

// JSからの呼び出し用のエントリーポイント
#[tauri::command]
async fn process_clipboard(app_handle: AppHandle) -> Result<(String, String), String> {
    println!("process_clipboard JSからの呼び出し");
    process_clipboard_internal(app_handle).await
}

fn get_clipboard_text(app: AppHandle) -> Result<String, String> {
    match app.clipboard().read_text() {
        Ok(text) => {
            if text.is_empty() {
                println!("クリップボードが空です");
                Err("クリップボードが空です".to_string())
            } else {
                println!(
                    "クリップボードからテキストを取得しました: 長さ {}",
                    text.len()
                );
                Ok(text)
            }
        }
        Err(e) => {
            let err_msg = format!("クリップボード読み取りエラー: {}", e);
            println!("{}", err_msg);
            Err(err_msg)
        }
    }
}
// クリップボードから文章を取得して改善し、元のテキストと改善後のテキストを返す
async fn process_clipboard_internal(app: AppHandle) -> Result<(String, String), String> {
    println!("process_clipboard_internal 開始");
    let clipboard_text = get_clipboard_text(app.clone())?;

    // storeから変換タイプを取得（なければ'revision'）
    let store = app.store("usage.json").map_err(|e| {
        let msg = format!("store取得エラー: {}", e);
        println!("{}", msg);
        msg
    })?;
    let convert_type = store
        .get("convert_type")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "revision".to_string());
    println!("storeから取得したconvert_type: {}", convert_type);

    // テキストを改善
    let improved_text = match self::convert_text(&clipboard_text, &convert_type, app.clone()).await
    {
        Ok(text) => text,
        Err(e) => {
            println!("校正APIエラー: {}", e);
            return Err(e);
        }
    };
    println!("テキスト変換完了");

    // 元のテキストと改善されたテキストを返す
    println!("元テキストと改善テキストを返します");
    Ok((clipboard_text, improved_text))
}

// アプリの初期化時にショートカットを設定
fn setup_shortcuts(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    println!("ショートカット設定を開始");

    // Command+Shift+I ショートカットを設定
    let handle = app.handle().clone();

    // ショートカットハンドラーを設定
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |_app, shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    println!("Shortcut triggered: {:?}", shortcut);
                    let handle_clone = handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let for_window = handle_clone.clone();
                        // ウィンドウを取得して最初に表示・フォーカス
                        if let Some(window) = for_window.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        } else {
                            eprintln!("メインウィンドウが見つかりません");
                        }
                        if let Some(window) = for_window.get_webview_window("main") {
                            let clipboard_text =
                                get_clipboard_text(for_window.clone()).unwrap_or_default();
                            let _ = window.emit("clipboard-processed", clipboard_text);
                            println!("イベント発行完了");
                        } else {
                            eprintln!("メインウィンドウが見つかりません");
                        }
                    });
                }
            })
            .build(),
    )?;

    // Command+D ショートカットを設定
    #[cfg(target_os = "macos")]
    let hot_key_shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::KeyD);
    #[cfg(target_os = "windows")]
    let hot_key_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyD);

    app.global_shortcut().register(hot_key_shortcut)?;
    println!("ショートカット登録完了");

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("アプリケーション起動");
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            println!("セットアップ開始");
            setup_shortcuts(app)?;
            println!("セットアップ完了");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![convert_text, process_clipboard, register_user, verify_email, login_user, verify_email_and_login])
        .on_window_event(|window, event| {
            use tauri::WindowEvent;
            if let WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
