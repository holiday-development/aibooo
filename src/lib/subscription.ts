import { SubscriptionInfo, PlanType, SUBSCRIPTION_PLANS } from '@/types/subscription';

/**
 * サブスクリプションが有効かどうかを判定
 */
export function isSubscriptionActive(subscription: SubscriptionInfo): boolean {
  if (subscription.plan_type === 'free') {
    return false;
  }

  if (!subscription.expires_at) {
    return false;
  }

  const expiresAt = new Date(subscription.expires_at);
  const now = new Date();

  return expiresAt > now;
}

/**
 * サブスクリプションの残り日数を取得
 */
export function getSubscriptionDaysRemaining(subscription: SubscriptionInfo): number {
  if (!subscription.expires_at) {
    return 0;
  }

  const expiresAt = new Date(subscription.expires_at);
  const now = new Date();
  const diffTime = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * プランIDからプラン情報を取得
 */
export function getPlanInfo(planType: PlanType) {
  return SUBSCRIPTION_PLANS.find(plan => plan.id === planType);
}

/**
 * 新しいサブスクリプション期限を計算
 */
export function calculateExpiryDate(planType: PlanType, fromDate?: Date): string {
  const plan = getPlanInfo(planType);
  if (!plan) {
    throw new Error(`Invalid plan type: ${planType}`);
  }

  const startDate = fromDate || new Date();
  const expiryDate = new Date(startDate);
  expiryDate.setDate(expiryDate.getDate() + plan.duration);

  return expiryDate.toISOString();
}

/**
 * サブスクリプション情報を作成
 */
export function createSubscription(
  planType: PlanType,
  stripeCustomerId: string,
  verificationToken?: string
): SubscriptionInfo {
  if (planType === 'free') {
    throw new Error('Cannot create subscription for free plan');
  }

  return {
    plan_type: planType,
    expires_at: calculateExpiryDate(planType),
    stripe_customer_id: stripeCustomerId,
    verification_token: verificationToken || null,
    purchased_at: new Date().toISOString(),
  };
}