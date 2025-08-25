export type PlanType = 'free' | 'weekly' | 'monthly';

export interface SubscriptionInfo {
  plan_type: PlanType;
  expires_at: string | null; // ISO 8601 format
  stripe_customer_id: string | null;
  verification_token: string | null;
  purchased_at: string | null; // ISO 8601 format
}

// Rust側から返される型
export interface SubscriptionStatus {
  plan_type: string;
  is_active: boolean;
  days_remaining: number;
  expires_at: string | null;
}

export interface SubscriptionPlan {
  id: PlanType;
  name: string;
  price: number; // 円
  duration: number; // 日数
  description: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'weekly',
    name: '週額プラン',
    price: 150,
    duration: 7,
    description: '7日間無制限利用'
  },
  {
    id: 'monthly',
    name: '月額プラン',
    price: 490,
    duration: 30,
    description: '30日間無制限利用'
  }
];



export const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
  plan_type: 'free',
  expires_at: null,
  stripe_customer_id: null,
  verification_token: null,
  purchased_at: null,
};