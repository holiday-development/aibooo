// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use chrono::{Local, Utc, DateTime, Duration};
use dotenvy_macro::dotenv;
use serde::{Deserialize, Serialize};
use std::env;
use tauri::{App, AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;

// AWS Cognito関連のimport (必要なものだけ残す)

// Cognitoサービスモジュール
mod cognito;
use cognito::{CognitoService, SignUpResponse, SignInResponse, ConfirmSignUpResponse, CognitoError, UserAttributesResponse, UpdateAttributesResponse};

// Stripe関連の環境変数
const STRIPE_PUBLISHABLE_KEY: &str = dotenv!("STRIPE_PUBLISHABLE_KEY");
const STRIPE_SECRET_KEY: &str = dotenv!("STRIPE_SECRET_KEY");
const STRIPE_PRICE_WEEKLY: &str = dotenv!("STRIPE_PRICE_WEEKLY");
const STRIPE_PRICE_MONTHLY: &str = dotenv!("STRIPE_PRICE_MONTHLY");

// 会員ステータス列挙型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MembershipStatus {
    Free,
    Premium,
    Business,
}

impl Default for MembershipStatus {
    fn default() -> Self {
        MembershipStatus::Free
    }
}

impl std::fmt::Display for MembershipStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MembershipStatus::Free => write!(f, "free"),
            MembershipStatus::Premium => write!(f, "premium"),
            MembershipStatus::Business => write!(f, "business"),
        }
    }
}

impl std::str::FromStr for MembershipStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "free" => Ok(MembershipStatus::Free),
            "premium" => Ok(MembershipStatus::Premium),
            "business" => Ok(MembershipStatus::Business),
            _ => Err(format!("Unknown membership status: {}", s)),
        }
    }
}

// サブスクリプション関連の構造体
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SubscriptionInfo {
    plan_type: String,
    membership_status: Option<String>,
    expires_at: Option<String>,
    stripe_customer_id: Option<String>,
    verification_token: Option<String>,
    purchased_at: Option<String>,
}

impl Default for SubscriptionInfo {
    fn default() -> Self {
        Self {
            plan_type: "free".to_string(),
            membership_status: Some("free".to_string()),
            expires_at: None,
            stripe_customer_id: None,
            verification_token: None,
            purchased_at: None,
        }
    }
}

#[derive(Debug, Serialize)]
struct SubscriptionStatus {
    plan_type: String,
    is_active: bool,
    days_remaining: i64,
    expires_at: Option<String>,
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

// サブスクリプション情報をストアから取得
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

// サブスクリプション情報をストアに保存
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

// サブスクリプションが有効かチェック
fn is_subscription_active(subscription: &SubscriptionInfo) -> bool {
    if subscription.plan_type == "free" {
        return false;
    }

    if let Some(expires_str) = &subscription.expires_at {
        if let Ok(expires_time) = DateTime::parse_from_rfc3339(expires_str) {
            let now = Utc::now();
            return expires_time > now;
        }
    }

    false
}

// 残り日数を計算
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

// サブスクリプション状態を取得するTauriコマンド
#[tauri::command]
async fn get_subscription_status(app_handle: AppHandle) -> Result<SubscriptionStatus, String> {
    let subscription = get_subscription_from_store(&app_handle)?;
    let is_active = is_subscription_active(&subscription);
    let days_remaining = get_days_remaining(&subscription);

    Ok(SubscriptionStatus {
        plan_type: subscription.plan_type,
        is_active,
        days_remaining,
        expires_at: subscription.expires_at,
    })
}

// サブスクリプションを更新するTauriコマンド
#[tauri::command]
async fn update_subscription(
    app_handle: AppHandle,
    plan_type: String,
    stripe_customer_id: String,
    verification_token: Option<String>
) -> Result<SubscriptionStatus, String> {
    let mut subscription = SubscriptionInfo {
        plan_type: plan_type.clone(),
        membership_status: Some("premium".to_string()),
        stripe_customer_id: Some(stripe_customer_id),
        verification_token,
        purchased_at: Some(Utc::now().to_rfc3339()),
        expires_at: None,
    };

    // 有効期限を計算
    if plan_type == "weekly" {
        let expires_at = Utc::now() + Duration::days(7);
        subscription.expires_at = Some(expires_at.to_rfc3339());
    } else if plan_type == "monthly" {
        let expires_at = Utc::now() + Duration::days(30);
        subscription.expires_at = Some(expires_at.to_rfc3339());
    }

    save_subscription_to_store(&app_handle, &subscription)?;

    let plan_type_result = subscription.plan_type.clone();
    let expires_at_result = subscription.expires_at.clone();
    let is_active = is_subscription_active(&subscription);
    let days_remaining = get_days_remaining(&subscription);

    Ok(SubscriptionStatus {
        plan_type: plan_type_result,
        is_active,
        days_remaining,
        expires_at: expires_at_result,
    })
}

// サブスクリプションをリセットするTauriコマンド
#[tauri::command]
async fn reset_subscription(app_handle: AppHandle) -> Result<SubscriptionStatus, String> {
    let subscription = SubscriptionInfo::default();
    save_subscription_to_store(&app_handle, &subscription)?;

    Ok(SubscriptionStatus {
        plan_type: subscription.plan_type,
        is_active: false,
        days_remaining: 0,
        expires_at: None,
    })
}

// サブスクリプションの有効性をチェックするTauriコマンド
#[tauri::command]
async fn check_subscription_validity(app_handle: AppHandle) -> Result<SubscriptionStatus, String> {
    let subscription = get_subscription_from_store(&app_handle)?;

    // 期限切れの場合は自動的にリセット
    if !is_subscription_active(&subscription) && subscription.plan_type != "free" {
        return reset_subscription(app_handle).await;
    }

    let plan_type = subscription.plan_type.clone();
    let expires_at = subscription.expires_at.clone();
    let is_active = is_subscription_active(&subscription);
    let days_remaining = get_days_remaining(&subscription);

    Ok(SubscriptionStatus {
        plan_type,
        is_active,
        days_remaining,
        expires_at,
    })
}

// Stripe設定を取得するTauriコマンド
#[tauri::command]
fn get_stripe_config() -> Result<StripeConfig, String> {
    println!("get_stripe_config called");
    println!("STRIPE_PUBLISHABLE_KEY: {}", STRIPE_PUBLISHABLE_KEY);
    println!("STRIPE_PRICE_WEEKLY: {}", STRIPE_PRICE_WEEKLY);
    println!("STRIPE_PRICE_MONTHLY: {}", STRIPE_PRICE_MONTHLY);

    let config = StripeConfig {
        publishable_key: STRIPE_PUBLISHABLE_KEY.to_string(),
        price_weekly: STRIPE_PRICE_WEEKLY.to_string(),
        price_monthly: STRIPE_PRICE_MONTHLY.to_string(),
    };

    println!("Returning config: {:?}", config);
    Ok(config)
}

// Stripe Checkout セッションを作成するTauriコマンド
#[tauri::command]
async fn create_checkout_session(request: CreateCheckoutRequest) -> Result<CheckoutSessionResponse, String> {
    let client = reqwest::Client::new();

    // Stripe Checkout Session作成のパラメータ
    let params = [
        ("line_items[0][price]", request.price_id.as_str()),
        ("line_items[0][quantity]", "1"),
        ("mode", "subscription"), // 継続課金に変更
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
            .unwrap_or_default();
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

static GENERATION_LIMIT: u64 = 20;
const API_URL: &str = dotenv!("API_URL");

// AWS Cognito設定
// const AWS_REGION: &str = dotenv!("AWS_REGION"); // 現在未使用のため削除
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

// プレミアム会員かどうかをチェックする関数
async fn check_premium_membership(app_handle: &tauri::AppHandle) -> Result<bool, String> {
    let store = app_handle.store("auth.json").map_err(|e| {
        format!("認証ストアの取得に失敗しました: {}", e)
    })?;

    let auth_data = match store.get("auth") {
        Some(auth) => auth,
        None => return Ok(false), // 認証されていない場合は無料
    };

    let access_token = match auth_data.get("access_token").and_then(|v| v.as_str()) {
        Some(token) => token,
        None => return Ok(false), // アクセストークンがない場合は無料
    };

    // トークンの有効期限をチェック
    if let Some(expires_at) = auth_data.get("expires_at").and_then(|v| v.as_u64()) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        
        if now >= expires_at {
            println!("アクセストークンが期限切れです。無料として処理します。");
            return Ok(false);
        }
    }

    // Cognitoサービスを初期化
    let cognito_service = match create_cognito_service().await {
        Ok(service) => service,
        Err(e) => {
            println!("Cognitoサービスの初期化に失敗: {}", e);
            return Ok(false); // エラーの場合は安全側に倒して無料として扱う
        }
    };

    // ユーザー属性を取得
    let user_attrs = match cognito_service.get_user_attributes(access_token).await {
        Ok(attrs) => attrs,
        Err(e) => {
            let error_str = format!("{:?}", e);
            if error_str.contains("Access Token has expired") || error_str.contains("NotAuthorizedException") {
                println!("認証トークンが無効または期限切れです。無料として処理します。");
            } else {
                println!("ユーザー属性の取得に失敗: {}", e);
            }
            return Ok(false); // エラーの場合は無料として扱う
        }
    };

    // membership_statusをチェック
    if let Some(membership_status) = user_attrs.membership_status {
        if membership_status == "premium" || membership_status == "business" {
            // 有料プランの場合、有効期限もチェック
            if let Some(expires_at) = user_attrs.subscription_expires_at {
                match DateTime::parse_from_rfc3339(&expires_at) {
                    Ok(expiry) => {
                        let now = Utc::now();
                        return Ok(expiry > now);
                    }
                    Err(_) => {
                        println!("無効な有効期限形式: {}", expires_at);
                        return Ok(false);
                    }
                }
            } else {
                // 有効期限が設定されていない有料プランは無効
                return Ok(false);
            }
        }
    }

    Ok(false) // デフォルトは無料
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
    // プレミアム会員は制限をスキップ
    let is_premium = match check_premium_membership(&app_handle).await {
        Ok(is_premium) => is_premium,
        Err(e) => {
            println!("会員ステータスチェックでエラー: {}。無料として処理します。", e);
            false
        }
    };

    if !is_premium {
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

// Cognitoユーザー属性からサブスクリプション情報を取得
#[tauri::command]
async fn get_user_subscription_from_cognito(access_token: String) -> Result<UserAttributesResponse, String> {
    let cognito_service = create_cognito_service().await
        .map_err(|e| format!("Cognitoサービスの初期化に失敗しました: {}", e))?;

    cognito_service.get_user_attributes(&access_token).await
        .map_err(|e| format!("ユーザー属性の取得に失敗しました: {}", e))
}

// Cognitoユーザー属性のサブスクリプション情報を更新
#[tauri::command]
async fn update_user_subscription_in_cognito(
    access_token: String,
    subscription_plan: Option<String>,
    subscription_expires_at: Option<String>
) -> Result<UpdateAttributesResponse, String> {
    let cognito_service = create_cognito_service().await
        .map_err(|e| format!("Cognitoサービスの初期化に失敗しました: {}", e))?;

    // subscription_planに基づいてmembership_statusを決定
    let membership_status = match subscription_plan.as_deref() {
        Some("weekly") | Some("monthly") => Some("premium"),
        _ => Some("free"),
    };

    cognito_service.update_user_attributes(
        &access_token,
        membership_status,
        subscription_plan.as_deref(),
        subscription_expires_at.as_deref()
    ).await
    .map_err(|e| format!("ユーザー属性の更新に失敗しました: {}", e))
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
        .invoke_handler(tauri::generate_handler![convert_text, process_clipboard, register_user, verify_email, login_user, verify_email_and_login, get_user_subscription_from_cognito, update_user_subscription_in_cognito, get_subscription_status, update_subscription, reset_subscription, check_subscription_validity, get_stripe_config, create_checkout_session])
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
