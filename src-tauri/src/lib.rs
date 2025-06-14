// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{App, AppHandle, Manager, Emitter};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// メール文章に変換する関数
#[tauri::command]
fn improve_text(text: &str) -> String {
    println!(
        "improve_text関数が呼び出されました: テキスト長さ {}",
        text.len()
    );

    // 簡単な例：改行を修正し、挨拶と締めくくりを追加
    let mut improved = text.trim().to_string();

    // 余分な改行を削除
    improved = improved.replace("\n\n\n", "\n\n");

    // 段落の間に適切な改行を入れる
    if !improved.contains("\n\n") && improved.contains("\n") {
        improved = improved.replace("\n", "\n\n");
    }

    // 文章が短すぎる場合、簡単な挨拶を追加
    if !improved.starts_with("お世話") && !improved.starts_with("いつも") {
        improved = format!("お世話になっております。\n\n{}", improved);
    }

    // 締めくくりがない場合は追加
    if !improved.ends_with("よろしくお願いいたします。")
        && !improved.ends_with("よろしくお願いします。")
    {
        improved = format!("{}\n\n何卒よろしくお願いいたします。", improved);
    }

    println!("テキスト変換完了: 結果の長さ {}", improved.len());
    improved
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
    let improved_text = improve_text(&clipboard_text);
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
                        match process_clipboard_internal(handle_clone).await {
                            Ok((original, improved)) => {
                                println!("process_clipboard 成功: 元テキスト長さ {}, 改善テキスト長さ {}", 
                                         original.len(), improved.len());
                                
                                // ウィンドウを取得してイベントを発行（フロントエンドに通知）
                                if let Some(window) = for_window.get_webview_window("main") {
                                    // ウィンドウを最前面に表示し、フォーカスする
                                    let _ = window.unminimize();
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                    let _ = window.emit("clipboard-processed", 
                                                       (original, improved));
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
    println!("アプリケーション起動");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
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
