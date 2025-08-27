import { SubscriptionInfo, PlanType, MembershipStatus, SUBSCRIPTION_PLANS } from '@/types/subscription';
import { invoke } from '@tauri-apps/api/core';

// Cognitoとの連携用の型定義
interface CognitoUserAttributes {
  email: string;
  membership_status: string | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
}

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
 * 会員ステータスが有料会員かどうかを判定
 */
export function isPremiumMember(membershipStatus?: MembershipStatus | string | null): boolean {
  if (!membershipStatus) return false;
  return membershipStatus === 'premium' || membershipStatus === 'business';
}

/**
 * プランタイプから会員ステータスを決定
 */
export function planTypeToMembershipStatus(planType: PlanType): MembershipStatus {
  switch (planType) {
    case 'free':
      return 'free';
    case 'weekly':
    case 'monthly':
      return 'premium';
    default:
      return 'free';
  }
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

/**
 * Cognitoからサブスクリプション情報を取得
 */
export async function getSubscriptionFromCognito(accessToken: string): Promise<SubscriptionInfo> {
  try {
    // Tauriアプリが起動していない場合はスキップ
    if (typeof window === 'undefined' || !('__TAURI__' in window)) {
      console.log('Tauri app not available, skipping Cognito subscription fetch');
      return {
        plan_type: 'free',
        expires_at: null,
        stripe_customer_id: null,
        verification_token: null,
        purchased_at: null,
      };
    }

    const userAttributes = await invoke<CognitoUserAttributes>('get_user_subscription_from_cognito', {
      accessToken
    });

    return {
      plan_type: (userAttributes.subscription_plan as PlanType) || 'free',
      expires_at: userAttributes.subscription_expires_at,
      stripe_customer_id: null, // Cognitoからは取得しない
      verification_token: null,
      purchased_at: null, // Cognitoからは取得しない
    };
  } catch (error) {
    console.error('Failed to get subscription from Cognito:', error);
    // エラーの場合は無料プランを返す
    return {
      plan_type: 'free',
      expires_at: null,
      stripe_customer_id: null,
      verification_token: null,
      purchased_at: null,
    };
  }
}

/**
 * Cognitoのサブスクリプション情報を更新
 */
export async function updateSubscriptionInCognito(
  accessToken: string,
  planType: PlanType,
  expiresAt?: string
): Promise<boolean> {
  try {
    // Tauriアプリが起動していない場合はスキップ
    if (typeof window === 'undefined' || !('__TAURI__' in window)) {
      console.log('Tauri app not available, skipping Cognito subscription update');
      return false;
    }

    await invoke('update_user_subscription_in_cognito', {
      accessToken,
      subscriptionPlan: planType === 'free' ? null : planType,
      subscriptionExpiresAt: expiresAt || null
    });
    return true;
  } catch (error) {
    console.error('Failed to update subscription in Cognito:', error);
    return false;
  }
}