// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use chrono::{Local, DateTime, Utc};
use dotenvy_macro::dotenv;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::env;
use tauri::{App, AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;

static GENERATION_LIMIT: u64 = 20;
const API_URL: &str = dotenv!("API_URL");

// Stripe関連の環境変数
const STRIPE_PUBLISHABLE_KEY: &str = dotenv!("STRIPE_PUBLISHABLE_KEY");
const STRIPE_SECRET_KEY: &str = dotenv!("STRIPE_SECRET_KEY");
const STRIPE_PRICE_WEEKLY: &str = dotenv!("STRIPE_PRICE_WEEKLY");
const STRIPE_PRICE_MONTHLY: &str = dotenv!("STRIPE_PRICE_MONTHLY");

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SubscriptionInfo {
    plan_type: String,
    expires_at: Option<String>,
    stripe_customer_id: Option<String>,
    verification_token: Option<String>,
    purchased_at: Option<String>,
    checksum: Option<String>, // 整合性チェック用
}

impl Default for SubscriptionInfo {
    fn default() -> Self {
        Self {
            plan_type: "free".to_string(),
            expires_at: None,
            stripe_customer_id: None,
            verification_token: None,
            purchased_at: None,
            checksum: None,
        }
    }
}

#[derive(Debug, Serialize)]
struct SubscriptionStatus {
    plan_type: String,
    is_active: bool,
    days_remaining: i64,
    expires_at: Option<String>,
    today_usage: u64,
    max_daily_usage: u64,
}

#[derive(Debug, Serialize)]
struct StripeConfig {
    publishable_key: String,
    price_weekly: String,
    price_monthly: String,
}

#[derive(Debug, Serialize)]
struct CheckoutSessionResponse {
    session_id: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct CreateCheckoutRequest {
    price_id: String,
    plan_type: String,
    success_url: String,
    cancel_url: String,
}

// サブスクリプション情報のチェックサムを計算
fn calculate_subscription_checksum(subscription: &SubscriptionInfo) -> String {
    let data = format!(
        "{}|{}|{}|{}|{}",
        subscription.plan_type,
        subscription.expires_at.as_deref().unwrap_or(""),
        subscription.stripe_customer_id.as_deref().unwrap_or(""),
        subscription.verification_token.as_deref().unwrap_or(""),
        subscription.purchased_at.as_deref().unwrap_or("")
    );

    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    format!("{:x}", result)
}

// サブスクリプション情報の整合性を検証
fn validate_subscription_integrity(subscription: &SubscriptionInfo) -> bool {
    if subscription.plan_type == "free" {
        return true; // 無料プランは常に有効
    }

    if let Some(stored_checksum) = &subscription.checksum {
        let calculated_checksum = calculate_subscription_checksum(subscription);
        return stored_checksum == &calculated_checksum;
    }

    false // チェックサムがない場合は無効
}

// チェックサム付きでサブスクリプション情報を作成
fn create_subscription_with_checksum(
    plan_type: String,
    expires_at: Option<String>,
    stripe_customer_id: Option<String>,
    verification_token: Option<String>,
    purchased_at: Option<String>,
) -> SubscriptionInfo {
    let mut subscription = SubscriptionInfo {
        plan_type,
        expires_at,
        stripe_customer_id,
        verification_token,
        purchased_at,
        checksum: None,
    };

    subscription.checksum = Some(calculate_subscription_checksum(&subscription));
    subscription
}

fn get_subscription_from_store(app_handle: &AppHandle) -> Result<SubscriptionInfo, String> {
    let store = app_handle.store("usage.json").map_err(|e| {
        format!("Store access error: {}", e)
    })?;

    if let Some(sub_value) = store.get("subscription") {
        if let Ok(subscription) = serde_json::from_value::<SubscriptionInfo>(sub_value.clone()) {
            return Ok(subscription);
        }
    }

    Ok(SubscriptionInfo::default())
}

fn save_subscription_to_store(app_handle: &AppHandle, subscription: &SubscriptionInfo) -> Result<(), String> {
    let store = app_handle.store("usage.json").map_err(|e| {
        format!("Store access error: {}", e)
    })?;

    let sub_value = serde_json::to_value(subscription).map_err(|e| {
        format!("Serialization error: {}", e)
    })?;

    store.set("subscription", sub_value);
    store.save().map_err(|e| {
        format!("Store save error: {}", e)
    })?;

    Ok(())
}

fn is_subscription_active(subscription: &SubscriptionInfo) -> bool {
    if subscription.plan_type == "free" {
        return false;
    }

    // チェックサム検証
    if !validate_subscription_integrity(subscription) {
        println!("Invalid subscription: checksum validation failed");
        return false;
    }

    // 必要なフィールドの整合性チェック
    if subscription.stripe_customer_id.is_none() || subscription.purchased_at.is_none() {
        println!("Invalid subscription: missing required fields");
        return false;
    }

    if let Some(expires_str) = &subscription.expires_at {
        if let Ok(expires_time) = DateTime::parse_from_rfc3339(expires_str) {
            let now = Utc::now();
            if expires_time > now {
                // 購入日のチェック
                if let Some(purchased_str) = &subscription.purchased_at {
                    if let Ok(purchased_time) = DateTime::parse_from_rfc3339(purchased_str) {
                        // 購入日が現在より未来でないかチェック
                        if purchased_time <= now {
                            return true;
                        } else {
                            println!("Invalid subscription: purchased_at is in the future");
                        }
                    }
                }
            }
        }
    }

    false
}

fn get_days_remaining(subscription: &SubscriptionInfo) -> i64 {
    if let Some(expires_str) = &subscription.expires_at {
        if let Ok(expires_time) = DateTime::parse_from_rfc3339(expires_str) {
            let now = Utc::now();
            let diff = expires_time.signed_duration_since(now);
            return diff.num_days().max(0);
        }
    }
    0
}

fn get_today_usage_count(app_handle: &AppHandle) -> Result<u64, String> {
    let store = app_handle.store("usage.json").map_err(|e| {
        format!("Store access error: {}", e)
    })?;

    let today = Local::now().format("%Y-%m-%d").to_string();
    let request_count = store
        .get("request_count")
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default();

    Ok(request_count
        .get(&today)
        .and_then(|v| v.as_u64())
        .unwrap_or(0))
}

#[tauri::command]
async fn convert_text(
    text: &str,
    type_: &str,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // 利用回数制限のためのストア取得
    let store = app_handle.store("usage.json").map_err(|e| {
        serde_json::json!({"type": "store_error", "message": e.to_string()}).to_string()
    })?;

        // サブスクリプション状態を確認
    let subscription = get_subscription_from_store(&app_handle)?;
    let has_active_subscription = is_subscription_active(&subscription);

    // プレミアム会員以外は回数制限をチェック
    if !has_active_subscription {
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

// サブスクリプション状態を取得
#[tauri::command]
async fn get_subscription_status(app_handle: AppHandle) -> Result<SubscriptionStatus, String> {
    let subscription = get_subscription_from_store(&app_handle)?;
    let is_active = is_subscription_active(&subscription);
    let days_remaining = get_days_remaining(&subscription);
    let today_usage = get_today_usage_count(&app_handle)?;

    Ok(SubscriptionStatus {
        plan_type: subscription.plan_type,
        is_active,
        days_remaining,
        expires_at: subscription.expires_at,
        today_usage,
        max_daily_usage: GENERATION_LIMIT,
    })
}

#[tauri::command]
fn get_stripe_config() -> Result<StripeConfig, String> {
    Ok(StripeConfig {
        publishable_key: STRIPE_PUBLISHABLE_KEY.to_string(),
        price_weekly: STRIPE_PRICE_WEEKLY.to_string(),
        price_monthly: STRIPE_PRICE_MONTHLY.to_string(),
    })
}

#[tauri::command]
async fn create_checkout_session(request: CreateCheckoutRequest) -> Result<CheckoutSessionResponse, String> {
    let client = reqwest::Client::new();

    // Stripe Checkout Session作成のパラメータ
    let params = [
        ("line_items[0][price]", request.price_id.as_str()),
        ("line_items[0][quantity]", "1"),
        ("mode", "subscription"),
        ("success_url", &format!("{}?session_id={{CHECKOUT_SESSION_ID}}&plan_type={}", request.success_url, request.plan_type)),
        ("cancel_url", &format!("{}?plan_type={}", request.cancel_url, request.plan_type)),
        // Stripe Link を有効にする設定
        ("payment_method_types[0]", "card"),
        ("payment_method_types[1]", "link"),
        ("allow_promotion_codes", "true"),
    ];

    let response = client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .basic_auth(STRIPE_SECRET_KEY, Some(""))
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Stripe API error: {}", error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let session_id = response_json["id"]
        .as_str()
        .ok_or("Missing session ID in response")?
        .to_string();

    let checkout_url = response_json["url"]
        .as_str()
        .ok_or("Missing URL in response")?
        .to_string();

    Ok(CheckoutSessionResponse {
        session_id,
        url: checkout_url,
    })
}

// サブスクリプション情報を更新
#[tauri::command]
async fn update_subscription(
    plan_type: String,
    stripe_customer_id: String,
    verification_token: Option<String>,
    app_handle: AppHandle,
) -> Result<SubscriptionStatus, String> {
    // 期限を計算
    let duration_days = match plan_type.as_str() {
        "weekly" => 7,
        "monthly" => 30,
        _ => return Err("Invalid plan type".to_string()),
    };

    let expires_at = Utc::now() + chrono::Duration::days(duration_days);
    let expires_str = expires_at.to_rfc3339();
    let purchased_at = Utc::now().to_rfc3339();

    let subscription = create_subscription_with_checksum(
        plan_type.clone(),
        Some(expires_str),
        Some(stripe_customer_id),
        verification_token,
        Some(purchased_at),
    );

    save_subscription_to_store(&app_handle, &subscription)?;

    // 更新された状態を返す
    get_subscription_status(app_handle).await
}

// サブスクリプションをリセット（無料プランに戻す）
#[tauri::command]
async fn reset_subscription(app_handle: AppHandle) -> Result<SubscriptionStatus, String> {
    let default_subscription = SubscriptionInfo::default();
    save_subscription_to_store(&app_handle, &default_subscription)?;

    // リセット後の状態を返す
    get_subscription_status(app_handle).await
}

// サブスクリプションの有効性をチェック（期限切れの場合は自動リセット）
#[tauri::command]
async fn check_subscription_validity(app_handle: AppHandle) -> Result<SubscriptionStatus, String> {
    let mut subscription = get_subscription_from_store(&app_handle)?;

    // 期限切れチェック
    if subscription.plan_type != "free" && !is_subscription_active(&subscription) {
        println!("Subscription expired, resetting to free plan");
        subscription = SubscriptionInfo::default();
        save_subscription_to_store(&app_handle, &subscription)?;
    }

    get_subscription_status(app_handle).await
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
        .invoke_handler(tauri::generate_handler![
            convert_text,
            process_clipboard,
            get_subscription_status,
            update_subscription,
            reset_subscription,
            check_subscription_validity,
            get_stripe_config,
            create_checkout_session
        ])
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
