import { SubscriptionInfo } from '@/types/subscription';
import { isSubscriptionActive, getSubscriptionDaysRemaining } from '@/lib/subscription';

export interface SubscriptionValidationResult {
  isValid: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  message?: string;
}

/**
 * サブスクリプションの詳細バリデーション
 */
export function validateSubscription(subscription: SubscriptionInfo): SubscriptionValidationResult {
  const isActive = isSubscriptionActive(subscription);
  const daysRemaining = getSubscriptionDaysRemaining(subscription);

  // 無料プランの場合
  if (subscription.plan_type === 'free') {
    return {
      isValid: false,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 0,
      message: '無料プランです'
    };
  }

  // 期限切れの場合
  if (!isActive) {
    return {
      isValid: false,
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: 0,
      message: 'サブスクリプションが期限切れです'
    };
  }

  // 期限が近い場合（3日以内）
  const isExpiringSoon = daysRemaining <= 3;

  return {
    isValid: true,
    isExpired: false,
    isExpiringSoon,
    daysRemaining,
    message: isExpiringSoon
      ? `サブスクリプションの期限が${daysRemaining}日後に切れます`
      : undefined
  };
}

/**
 * アクション実行前のサブスクリプションチェック
 */
export function canPerformPremiumAction(subscription: SubscriptionInfo): boolean {
  const validation = validateSubscription(subscription);
  return validation.isValid;
}

/**
 * 期限切れ警告が必要かチェック
 */
export function shouldShowExpirationWarning(subscription: SubscriptionInfo): boolean {
  const validation = validateSubscription(subscription);
  return validation.isExpiringSoon;
}

/**
 * サブスクリプション期限切れ時の自動処理
 */
export interface ExpirationHandlers {
  onExpired: () => void;
  onExpiringSoon: (daysRemaining: number) => void;
}

export function handleSubscriptionExpiration(
  subscription: SubscriptionInfo,
  handlers: ExpirationHandlers
): void {
  const validation = validateSubscription(subscription);

  if (validation.isExpired) {
    handlers.onExpired();
  } else if (validation.isExpiringSoon) {
    handlers.onExpiringSoon(validation.daysRemaining);
  }
}

/**
 * 日付フォーマット用ヘルパー
 */
export function formatExpirationDate(expiresAt: string | null): string {
  if (!expiresAt) return '';

  const date = new Date(expiresAt);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * サブスクリプション状態の説明テキストを生成
 */
export function getSubscriptionStatusText(subscription: SubscriptionInfo): string {
  const validation = validateSubscription(subscription);

  if (subscription.plan_type === 'free') {
    return '無料プラン（1日20回まで利用可能）';
  }

  if (validation.isExpired) {
    return 'プレミアムプランが期限切れです';
  }

  if (validation.isExpiringSoon) {
    return `プレミアムプラン（残り${validation.daysRemaining}日）`;
  }

  const planName = subscription.plan_type === 'weekly' ? '週額プラン' : '月額プラン';
  return `${planName}（残り${validation.daysRemaining}日）`;
}