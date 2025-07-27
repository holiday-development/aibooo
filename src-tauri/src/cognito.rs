use aws_sdk_cognitoidentityprovider::{
    Client as CognitoClient,
    types::{AttributeType, AuthFlowType},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Cognitoサービスのエラー型
#[derive(Debug, Serialize, Deserialize)]
pub struct CognitoError {
    pub error_type: String,
    pub message: String,
}

impl std::fmt::Display for CognitoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.error_type, self.message)
    }
}

impl std::error::Error for CognitoError {}

// レスポンス型
#[derive(Debug, Serialize, Deserialize)]
pub struct SignUpResponse {
    pub user_sub: String,
    pub code_delivery_medium: Option<String>,
    pub destination: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SignInResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub id_token: String,
    pub token_type: String,
    pub expires_in: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfirmSignUpResponse {
    pub success: bool,
    pub message: String,
}

// ユーザー属性関連のレスポンス型
#[derive(Debug, Serialize, Deserialize)]
pub struct UserAttributesResponse {
    pub email: String,
    pub subscription_plan: Option<String>,
    pub subscription_expires_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateAttributesResponse {
    pub success: bool,
    pub message: String,
}

pub struct CognitoService {
    client: CognitoClient,
    _user_pool_id: String, // 将来の使用のために保持するが、現在は未使用のためアンダースコアを付ける
    client_id: String,
}

impl CognitoService {
    pub async fn new(user_pool_id: String, client_id: String) -> Result<Self, CognitoError> {
        println!("Initializing CognitoService...");
        println!("User Pool ID: {}", user_pool_id);
        println!("Client ID: {}", client_id);

        // AWS SDKは環境変数からregionを自動的に取得するため、手動設定は不要
        let config = aws_config::from_env()
            .load()
            .await;
        println!("AWS config loaded successfully");

        let client = CognitoClient::new(&config);
        println!("Cognito client created successfully");

        Ok(CognitoService {
            client,
            _user_pool_id: user_pool_id,
            client_id,
        })
    }

    pub async fn sign_up(&self, email: &str, password: &str) -> Result<SignUpResponse, CognitoError> {
        println!("Starting sign_up for email: {}", email);

        let email_attribute = AttributeType::builder()
            .name("email")
            .value(email)
            .build();

        println!("Built email attribute, sending request to Cognito...");

        let result = self
            .client
            .sign_up()
            .client_id(&self.client_id)
            .username(email)
            .password(password)
            .user_attributes(email_attribute)
            .send()
            .await
            .map_err(|e| {
                println!("Cognito sign_up error: {:?}", e);

                // エラーメッセージをユーザーフレンドリーに変換
                let error_string = format!("{:?}", e);
                let user_message = if error_string.contains("InvalidPasswordException") {
                    "パスワードが要件を満たしていません。大文字、小文字、数字、特殊文字を含む8文字以上のパスワードを入力してください。"
                } else if error_string.contains("UsernameExistsException") {
                    "このメールアドレスは既に登録されています。"
                } else if error_string.contains("InvalidParameterException") {
                    "入力内容に問題があります。メールアドレスとパスワードを確認してください。"
                } else {
                    "ユーザー登録に失敗しました。しばらく時間をおいてから再度お試しください。"
                };

                CognitoError {
                    error_type: "sign_up_error".to_string(),
                    message: user_message.to_string(),
                }
            })?;

        println!("Sign up successful, processing response...");

        let user_sub = result.user_sub().unwrap_or_default().to_string();
        let code_delivery_medium = result.code_delivery_details()
            .and_then(|details| details.delivery_medium())
            .map(|medium| medium.as_str().to_string());
        let destination = result.code_delivery_details()
            .and_then(|details| details.destination())
            .map(|dest| dest.to_string());

        Ok(SignUpResponse {
            user_sub,
            code_delivery_medium,
            destination,
        })
    }

    pub async fn confirm_sign_up(&self, email: &str, confirmation_code: &str) -> Result<ConfirmSignUpResponse, CognitoError> {
        println!("Starting confirm_sign_up for email: {}", email);

        let _result = self
            .client
            .confirm_sign_up()
            .client_id(&self.client_id)
            .username(email)
            .confirmation_code(confirmation_code)
            .send()
            .await
            .map_err(|e| {
                println!("Cognito confirm_sign_up error: {:?}", e);

                // エラーメッセージをユーザーフレンドリーに変換
                let error_string = format!("{:?}", e);
                let user_message = if error_string.contains("CodeMismatchException") {
                    "確認コードが正しくありません。もう一度確認してください。"
                } else if error_string.contains("ExpiredCodeException") {
                    "確認コードの有効期限が切れています。新規登録からやり直してください。"
                } else if error_string.contains("UserNotFoundException") {
                    "ユーザーが見つかりません。メールアドレスを確認してください。"
                } else if error_string.contains("LimitExceededException") {
                    "試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。"
                } else {
                    "メール認証に失敗しました。確認コードとメールアドレスを確認してください。"
                };

                CognitoError {
                    error_type: "confirm_sign_up_error".to_string(),
                    message: user_message.to_string(),
                }
            })?;

        println!("Confirm sign up successful");

        Ok(ConfirmSignUpResponse {
            success: true,
            message: "メール認証が完了しました。".to_string(),
        })
    }

    pub async fn sign_in(&self, email: &str, password: &str) -> Result<SignInResponse, CognitoError> {
        println!("Starting sign_in for email: {}", email);

        let mut auth_parameters = HashMap::new();
        auth_parameters.insert("USERNAME".to_string(), email.to_string());
        auth_parameters.insert("PASSWORD".to_string(), password.to_string());

        let result = self
            .client
            .initiate_auth()
            .auth_flow(AuthFlowType::UserPasswordAuth)
            .client_id(&self.client_id)
            .set_auth_parameters(Some(auth_parameters))
            .send()
            .await
            .map_err(|e| {
                println!("Cognito sign_in error: {:?}", e);

                // エラーメッセージをユーザーフレンドリーに変換
                let error_string = format!("{:?}", e);
                let user_message = if error_string.contains("UserNotConfirmedException") {
                    "メール認証が完了していません。メールを確認して認証を完了してください。"
                } else if error_string.contains("NotAuthorizedException") {
                    "メールアドレスまたはパスワードが正しくありません。"
                } else if error_string.contains("UserNotFoundException") {
                    "このメールアドレスは登録されていません。"
                } else if error_string.contains("TooManyFailedAttemptsException") {
                    "ログイン試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。"
                } else if error_string.contains("Auth flow not enabled") || error_string.contains("USER_PASSWORD_AUTH") {
                    "認証設定に問題があります。AWS CognitoでALLOW_USER_PASSWORD_AUTHを有効にしてください。"
                } else {
                    "ログインに失敗しました。メールアドレスとパスワードを確認してください。"
                };

                CognitoError {
                    error_type: if error_string.contains("UserNotConfirmedException") {
                        "user_not_confirmed".to_string()
                    } else {
                        "sign_in_error".to_string()
                    },
                    message: user_message.to_string(),
                }
            })?;

        let auth_result = result.authentication_result()
            .ok_or_else(|| CognitoError {
                error_type: "auth_result_error".to_string(),
                message: "認証結果が取得できませんでした".to_string(),
            })?;

        let access_token = auth_result.access_token()
            .ok_or_else(|| CognitoError {
                error_type: "token_error".to_string(),
                message: "アクセストークンが取得できませんでした".to_string(),
            })?.to_string();

        let refresh_token = auth_result.refresh_token()
            .ok_or_else(|| CognitoError {
                error_type: "token_error".to_string(),
                message: "リフレッシュトークンが取得できませんでした".to_string(),
            })?.to_string();

        let id_token = auth_result.id_token()
            .ok_or_else(|| CognitoError {
                error_type: "token_error".to_string(),
                message: "IDトークンが取得できませんでした".to_string(),
            })?.to_string();

        let token_type = auth_result.token_type()
            .unwrap_or_default()
            .to_string();

        let expires_in = auth_result.expires_in();

        println!("Sign in successful");

        Ok(SignInResponse {
            access_token,
            refresh_token,
            id_token,
            token_type,
            expires_in,
        })
    }

    // メール認証完了後に直接サインインを行う
    pub async fn confirm_sign_up_and_sign_in(&self, email: &str, password: &str, confirmation_code: &str) -> Result<SignInResponse, CognitoError> {
        println!("Starting confirm_sign_up_and_sign_in for email: {}", email);

        // 最初にメール認証を完了
        self.confirm_sign_up(email, confirmation_code).await?;

        // メール認証成功後、直接サインインを実行
        self.sign_in(email, password).await
    }

    // ユーザー属性を取得
    pub async fn get_user_attributes(&self, access_token: &str) -> Result<UserAttributesResponse, CognitoError> {
        println!("Getting user attributes...");

        let result = self
            .client
            .get_user()
            .access_token(access_token)
            .send()
            .await
            .map_err(|e| {
                println!("Cognito get_user error: {:?}", e);

                let error_string = format!("{:?}", e);
                let user_message = if error_string.contains("NotAuthorizedException") {
                    "認証が無効です。再度ログインしてください。"
                } else if error_string.contains("UserNotFoundException") {
                    "ユーザーが見つかりません。"
                } else {
                    "ユーザー情報の取得に失敗しました。"
                };

                CognitoError {
                    error_type: "get_user_error".to_string(),
                    message: user_message.to_string(),
                }
            })?;

        let mut email = String::new();
        let mut subscription_plan: Option<String> = None;
        let mut subscription_expires_at: Option<String> = None;

        if let Some(user_attributes) = result.user_attributes() {
            for attr in user_attributes {
                match attr.name() {
                    Some("email") => {
                        email = attr.value().unwrap_or_default().to_string();
                    }
                    Some("custom:subscription_plan") => {
                        subscription_plan = attr.value().map(|v| v.to_string());
                    }
                    Some("custom:subscription_expires_at") => {
                        subscription_expires_at = attr.value().map(|v| v.to_string());
                    }
                    _ => {}
                }
            }
        }

        Ok(UserAttributesResponse {
            email,
            subscription_plan,
            subscription_expires_at,
        })
    }

    // ユーザー属性を更新
    pub async fn update_user_attributes(
        &self,
        access_token: &str,
        subscription_plan: Option<&str>,
        subscription_expires_at: Option<&str>
    ) -> Result<UpdateAttributesResponse, CognitoError> {
        println!("Updating user attributes...");

        let mut attributes = Vec::new();

        if let Some(plan) = subscription_plan {
            attributes.push(
                AttributeType::builder()
                    .name("custom:subscription_plan")
                    .value(plan)
                    .build()
            );
        }

        if let Some(expires_at) = subscription_expires_at {
            attributes.push(
                AttributeType::builder()
                    .name("custom:subscription_expires_at")
                    .value(expires_at)
                    .build()
            );
        }

        let _result = self
            .client
            .update_user_attributes()
            .access_token(access_token)
            .set_user_attributes(Some(attributes))
            .send()
            .await
            .map_err(|e| {
                println!("Cognito update_user_attributes error: {:?}", e);

                let error_string = format!("{:?}", e);
                let user_message = if error_string.contains("NotAuthorizedException") {
                    "認証が無効です。再度ログインしてください。"
                } else if error_string.contains("InvalidParameterException") {
                    "属性の更新に失敗しました。入力値を確認してください。"
                } else {
                    "ユーザー属性の更新に失敗しました。"
                };

                CognitoError {
                    error_type: "update_user_attributes_error".to_string(),
                    message: user_message.to_string(),
                }
            })?;

        println!("User attributes updated successfully");

        Ok(UpdateAttributesResponse {
            success: true,
            message: "ユーザー属性が正常に更新されました。".to_string(),
        })
    }
}