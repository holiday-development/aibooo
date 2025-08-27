import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { SubscriptionStatus, PlanType } from '@/types/subscription';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { updateSubscriptionInCognito, calculateExpiryDate } from '@/lib/subscription';
import { useAuth } from '@/contexts/use-auth';

interface SubscriptionContextProps {
  subscription: SubscriptionStatus | null;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
  updatePlan: (planType: PlanType, stripeCustomerId: string, verificationToken?: string) => Promise<void>;
  resetPlan: () => Promise<void>;
  checkValidity: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextProps | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { tokens } = useAuth();

  const refreshSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      const status = await invoke<SubscriptionStatus>('get_subscription_status');
      setSubscription(status);
    } catch (error) {
      console.error('Failed to load subscription:', error);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePlan = useCallback(async (
    planType: PlanType,
    stripeCustomerId: string,
    verificationToken?: string
  ) => {
    try {
      setIsLoading(true);

      const updatedStatus = await invoke<SubscriptionStatus>('update_subscription', {
        planType,
        stripeCustomerId,
        verificationToken,
      });

      setSubscription(updatedStatus);

      // Cognitoユーザー属性も更新
      if (tokens?.access_token && planType !== 'free') {
        const expiresAt = calculateExpiryDate(planType);
        await updateSubscriptionInCognito(tokens.access_token, planType, expiresAt);
        console.log('Cognito user attributes updated successfully');
      }
    } catch (error) {
      console.error('Failed to update subscription:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [tokens]);

  const resetPlan = useCallback(async () => {
    try {
      setIsLoading(true);
      const resetStatus = await invoke<SubscriptionStatus>('reset_subscription');
      setSubscription(resetStatus);

      // Cognitoユーザー属性もリセット
      if (tokens?.access_token) {
        await updateSubscriptionInCognito(tokens.access_token, 'free');
        console.log('Cognito user attributes reset successfully');
      }
    } catch (error) {
      console.error('Failed to reset subscription:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [tokens]);

  const checkValidity = useCallback(async () => {
    try {
      const status = await invoke<SubscriptionStatus>('check_subscription_validity');
      setSubscription(status);
    } catch (error) {
      console.error('Failed to check subscription validity:', error);
    }
  }, []);

    useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  // 期限切れチェックと警告（1時間ごと）
  useEffect(() => {
    if (isLoading || !subscription) return;

    const checkExpiry = () => {
      if (!subscription) return;

      // 期限切れの場合（is_activeがfalseで無料プランでない場合） - 自動リセットを削除
      if (!subscription.is_active && subscription.plan_type !== 'free') {
        console.log('Subscription expired, but not auto-resetting to avoid conflicts');
        toast.error('プレミアムプランが期限切れになりました', {
          description: '引き続きご利用いただくには、プレミアムプランを再度ご購入ください。',
          duration: 5000,
        });
        // checkValidity(); を削除 - 自動リセットを防ぐ
        return;
      }

      // 期限が近い場合の警告（3日以内）
      if (subscription.is_active && subscription.days_remaining <= 3 && subscription.plan_type !== 'free') {
        toast.warning('サブスクリプション期限のお知らせ', {
          description: `サブスクリプションの期限が${subscription.days_remaining}日後に切れます`,
          duration: 4000,
        });
      }
    };

    // 初回チェック
    checkExpiry();

    // 1時間ごとにチェック
    const interval = setInterval(checkExpiry, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [subscription, isLoading]); // checkValidityを依存配列から削除

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoading,
        refreshSubscription,
        updatePlan,
        resetPlan,
        checkValidity,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};