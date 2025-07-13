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

pub struct CognitoService {
    client: CognitoClient,
    user_pool_id: String,
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
            user_pool_id,
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
        let _result = self
            .client
            .confirm_sign_up()
            .client_id(&self.client_id)
            .username(email)
            .confirmation_code(confirmation_code)
            .send()
            .await
            .map_err(|e| CognitoError {
                error_type: "confirm_sign_up_error".to_string(),
                message: format!("メール認証に失敗しました: {}", e),
            })?;

        Ok(ConfirmSignUpResponse {
            success: true,
            message: "メール認証が完了しました".to_string(),
        })
    }

    pub async fn sign_in(&self, email: &str, password: &str) -> Result<SignInResponse, CognitoError> {
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
            .map_err(|e| CognitoError {
                error_type: "sign_in_error".to_string(),
                message: format!("ログインに失敗しました: {}", e),
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
            })?;

        let refresh_token = auth_result.refresh_token()
            .ok_or_else(|| CognitoError {
                error_type: "token_error".to_string(),
                message: "リフレッシュトークンが取得できませんでした".to_string(),
            })?;

        let id_token = auth_result.id_token()
            .ok_or_else(|| CognitoError {
                error_type: "token_error".to_string(),
                message: "IDトークンが取得できませんでした".to_string(),
            })?;

        let token_type = auth_result.token_type()
            .unwrap_or_default();

        let expires_in_value = auth_result.expires_in();

        Ok(SignInResponse {
            access_token: access_token.to_string(),
            refresh_token: refresh_token.to_string(),
            id_token: id_token.to_string(),
            token_type: token_type.to_string(),
            expires_in: expires_in_value,
        })
    }
}