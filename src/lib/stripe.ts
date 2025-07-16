import { loadStripe } from '@stripe/stripe-js';
import { PlanType } from '@/types/subscription';

// Stripe公開可能キー（本来は環境変数から取得）
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

// Stripeインスタンスを作成
export const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// プラン価格マッピング（Stripe Price ID）
export const STRIPE_PRICE_IDS = {
  weekly: 'price_weekly_test_150',
  monthly: 'price_monthly_test_490',
} as const;

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

// Stripe Checkoutセッション作成（モック実装）
export async function createCheckoutSession(data: CreateCheckoutSessionData): Promise<{ url: string; sessionId: string }> {
  // 本来はバックエンドAPIを呼び出す
  // ここではモック実装として遷移URLを返す
  const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Stripe Checkoutの代わりにモック決済処理
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        url: `https://checkout.stripe.com/pay/${sessionId}`,
        sessionId: sessionId
      });
    }, 1000);
  });
}

// 決済セッション検証（モック実装）
export async function verifyPaymentSession(sessionId: string): Promise<PaymentSuccessData> {
  // 本来はバックエンドAPIで決済セッションを検証
  // ここではモック実装
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        sessionId,
        customerId: `cus_${Date.now()}`,
        planType: sessionId.includes('weekly') ? 'weekly' : 'monthly',
        paymentIntent: `pi_${Date.now()}`
      });
    }, 500);
  });
}

// プランタイプからStripe Price IDを取得
export function getPriceId(planType: PlanType): string {
  if (planType === 'free') {
    throw new Error('Free plan does not have a price ID');
  }

  return STRIPE_PRICE_IDS[planType];
}