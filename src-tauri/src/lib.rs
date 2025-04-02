// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{App, AppHandle};
use tauri_plugin_clipboard_manager::ClipboardExt;
// 後で実装するためにコメントアウト
// use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutManager};

// メール文章に変換する関数
#[tauri::command]
fn improve_text(text: &str) -> String {
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

    improved
}

// クリップボードから文章を取得して改善し、再度クリップボードにコピーする
#[tauri::command]
async fn process_clipboard(app: AppHandle) -> Result<(), String> {
    // クリップボードからテキストを取得
    let clipboard_text = app.clipboard().read_text()
        .map_err(|e| e.to_string())?;

    // テキストを改善
    let improved_text = improve_text(&clipboard_text);

    // 改善されたテキストをクリップボードに書き込む
    app.clipboard().write_text(improved_text.clone())
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ショートカット設定関数は後で実装
/*
// アプリの初期化時にショートカットを設定
fn setup_shortcuts(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    // 後で実装
    Ok(())
}
*/

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        // 後で実装するためコメントアウト
        // .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // setup_shortcuts(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![improve_text, process_clipboard])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
