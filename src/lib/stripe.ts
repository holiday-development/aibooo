import { loadStripe } from '@stripe/stripe-js';
import { invoke } from '@tauri-apps/api/core';
import { PlanType } from '@/types/subscription';

// Stripe設定の型定義
interface StripeConfig {
  publishable_key: string;
  price_weekly: string;
  price_monthly: string;
}

// Checkout Session Response型定義
interface CheckoutSessionResponse {
  session_id: string;
  url: string;
}

// Checkout Session Request型定義
interface CreateCheckoutRequest {
  price_id: string;
  plan_type: string;
  success_url: string;
  cancel_url: string;
}

// Stripe設定をキャッシュ
let stripeConfig: StripeConfig | null = null;

// Rust側からStripe設定を取得
async function getStripeConfig(): Promise<StripeConfig> {
  if (!stripeConfig) {
    try {
      stripeConfig = await invoke<StripeConfig>('get_stripe_config');
    } catch (error) {
      console.error('Stripe設定の取得に失敗しました:', error);
      throw new Error('Stripe設定を読み込めませんでした');
    }
  }
  return stripeConfig;
}

// Stripeインスタンスを作成（遅延初期化）
let stripePromiseCache: Promise<any> | null = null;
export const getStripePromise = async () => {
  if (!stripePromiseCache) {
    const config = await getStripeConfig();
    stripePromiseCache = loadStripe(config.publishable_key);
  }
  return stripePromiseCache;
};

// 決済セッション作成データ
export interface CreateCheckoutSessionData {
  priceId: string;
  planType: PlanType;
  successUrl: string;
  cancelUrl: string;
}

// 決済成功後のデータ
export interface PaymentSuccessData {
  sessionId: string;
  customerId: string;
  planType: PlanType;
  paymentIntent: string;
}

// Stripe Checkout Session作成（Rust経由）
export async function createCheckoutSession(data: CreateCheckoutSessionData): Promise<{ url: string; sessionId: string }> {
  try {
    const request: CreateCheckoutRequest = {
      price_id: data.priceId,
      plan_type: data.planType,
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
    };

    const response = await invoke<CheckoutSessionResponse>('create_checkout_session', { request });

    // Stripe Checkoutページに直接遷移
    window.location.href = response.url;

    return {
      url: response.url,
      sessionId: response.session_id
    };

  } catch (error) {
    console.error('Stripe Checkout エラー:', error);
    throw error;
  }
}

// プランタイプからStripe Price IDを取得
export async function getPriceId(planType: PlanType): Promise<string> {
  if (planType === 'free') {
    throw new Error('Free plan does not have a price ID');
  }

  const config = await getStripeConfig();

  switch (planType) {
    case 'weekly':
      return config.price_weekly;
    case 'monthly':
      return config.price_monthly;
    default:
      throw new Error(`Unknown plan type: ${planType}`);
  }
}

// テスト用の決済セッション検証（将来的にはバックエンドで実装）
export async function verifyPaymentSession(sessionId: string): Promise<PaymentSuccessData> {
  // TODO: 実際の環境では、バックエンドAPIでセッションを検証
  // 現在はテスト用の実装
  return {
    sessionId,
    customerId: `cus_test_${Date.now()}`,
    planType: sessionId.includes('weekly') ? 'weekly' : 'monthly',
    paymentIntent: `pi_test_${Date.now()}`
  };
}

// Stripe Checkoutから戻ってきた時の処理
export async function handleCheckoutSuccess(sessionId: string, planType: PlanType): Promise<PaymentSuccessData> {
  try {
    // 実際の環境では、バックエンドAPIでセッション情報を取得・検証
    // ここではテスト用の実装
    const paymentData = await verifyPaymentSession(sessionId);

    return {
      ...paymentData,
      planType // URLパラメータから取得したプラン情報を使用
    };
  } catch (error) {
    console.error('決済検証エラー:', error);
    throw new Error('決済の検証に失敗しました');
  }
}