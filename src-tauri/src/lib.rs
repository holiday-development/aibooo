// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use chrono::Local;
use dotenv;
use std::env;
use tauri::{App, AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;

#[tauri::command]
async fn improve_text(text: &str, app_handle: tauri::AppHandle) -> Result<String, String> {
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
    if count >= 5 {
        return Err(serde_json::json!({
            "type": "limit_exceeded",
            "message": "本日の利用回数上限（5回）に達しました"
        })
        .to_string());
    }
    request_count.insert(today.clone(), serde_json::json!(count + 1));
    store.set("request_count", serde_json::json!(request_count));
    store.save().map_err(|e| {
        serde_json::json!({"type": "store_error", "message": e.to_string()}).to_string()
    })?;

    println!(
        "improve_text関数が呼び出されました: テキスト長さ {}",
        text.len()
    );

    let client = reqwest::Client::new();
    // .envや環境変数からURLを取得
    let url = env::var("API_URL").map_err(|_| serde_json::json!({"type": "env_error", "message": "API_URL環境変数が設定されていません"}).to_string())?;

    let mut map: std::collections::HashMap<&'static str, &str> = std::collections::HashMap::new();
    // TODO: 受け取ったタイプで、叩くエンドポイントを変える
    let prompt = format!("次の文章を校正してください: {}", text);
    map.insert("prompt", &prompt);

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
    if let Some(generated) = json.get("generatedText").and_then(|v| v.as_str()) {
        println!("APIレスポンス受信: {}", generated.len());
        Ok(generated.to_string())
    } else {
        println!("APIレスポンスにgeneratedTextがありません: {}", body);
        Err(serde_json::json!({
            "type": "api_error",
            "message": "APIレスポンスにgeneratedTextがありません"
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

// クリップボードから文章を取得して改善し、元のテキストと改善後のテキストを返す
async fn process_clipboard_internal(app: AppHandle) -> Result<(String, String), String> {
    println!("process_clipboard_internal 開始");

    // クリップボードからテキストを取得
    let clipboard_text = match app.clipboard().read_text() {
        Ok(text) => {
            if text.is_empty() {
                println!("クリップボードが空です");
                return Err("クリップボードが空です".to_string());
            }
            println!(
                "クリップボードからテキストを取得しました: 長さ {}",
                text.len()
            );
            text
        }
        Err(e) => {
            let err_msg = format!("クリップボード読み取りエラー: {}", e);
            println!("{}", err_msg);
            return Err(err_msg);
        }
    };

    // テキストを改善
    let improved_text = match improve_text(&clipboard_text, app.clone()).await {
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
                        println!("process_clipboard 呼び出し前");
                        let for_window = handle_clone.clone();
                        // ウィンドウを取得して最初に表示・フォーカス
                        if let Some(window) = for_window.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        } else {
                            eprintln!("メインウィンドウが見つかりません");
                        }
                        // その後API処理
                        match process_clipboard_internal(handle_clone).await {
                            Ok((original, improved)) => {
                                println!("process_clipboard 成功: 元テキスト長さ {}, 改善テキスト長さ {}", 
                                         original.len(), improved.len());
                                if let Some(window) = for_window.get_webview_window("main") {
                                    let _ = window.emit("clipboard-processed", original);
                                    println!("イベント発行完了");
                                } else {
                                    eprintln!("メインウィンドウが見つかりません");
                                }
                            }
                            Err(e) => eprintln!("Error processing clipboard: {}", e),
                        }
                        println!("process_clipboard 呼び出し後");
                    });
                }
            })
            .build(),
    )?;

    // Control+N を登録
    #[cfg(target_os = "macos")]
    let cmd_n_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyN);

    app.global_shortcut().register(cmd_n_shortcut)?;
    println!("ショートカット登録完了");

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv::dotenv().ok();
    println!("アプリケーション起動");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            println!("セットアップ開始");
            setup_shortcuts(app)?;
            println!("セットアップ完了");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![improve_text, process_clipboard])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
