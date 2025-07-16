import { LimitExceeded } from '@/views/limit-exceeeded';
import { Generator } from '@/views/generator';
import { Subscription } from '@/views/subscription';
import { useCallback, useEffect } from 'react';
import { useScreenType } from '@/contexts/use-screen-type';
import { useSubscription } from '@/contexts/use-subscription';
import { Onboarding } from '@/views/onboarding';
import { checkForUpdate } from '@/lib/checkForUpdate';
import { handleCheckoutSuccess } from '@/lib/stripe';
import { PlanType } from '@/types/subscription';
import { toast } from 'sonner';

export default function App() {
  const { screenType, switchScreenType } = useScreenType();
  const { updatePlan } = useSubscription();

  // URLパラメータを監視して決済成功/キャンセルを処理
  useEffect(() => {
    const handlePaymentResult = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      const planType = urlParams.get('plan_type') as PlanType;

      // 決済成功時の処理
      if (window.location.pathname === '/payment-success' && sessionId && planType) {
        try {
          toast.success('決済が完了しました！処理中...');

          // Stripe Checkoutセッションを検証
          const paymentData = await handleCheckoutSuccess(sessionId, planType);

          // サブスクリプションを更新
          await updatePlan(planType, paymentData.customerId, paymentData.paymentIntent);

          toast.success(`${planType === 'weekly' ? '週額' : '月額'}プランの設定が完了しました！`);

          // メイン画面に戻る
          switchScreenType('MAIN');

          // URLをクリーンアップ
          window.history.replaceState({}, document.title, '/');

        } catch (error) {
          console.error('Payment verification failed:', error);
          toast.error('決済の処理中にエラーが発生しました');
          switchScreenType('SUBSCRIPTION');
        }
      }

      // 決済キャンセル時の処理
      if (window.location.pathname === '/payment-cancel') {
        toast.info('決済がキャンセルされました');
        switchScreenType('SUBSCRIPTION');

        // URLをクリーンアップ
        window.history.replaceState({}, document.title, '/');
      }
    };

    handlePaymentResult();
  }, [updatePlan, switchScreenType]);

  useEffect(() => {
    if (screenType === 'MAIN') {
      checkForUpdate();
    }
  }, [screenType]);

  const getScreen = useCallback(() => {
    switch (screenType) {
      case 'ONBOARDING':
        return <Onboarding />;
      case 'MAIN':
        return <Generator />;
      case 'LIMIT_EXCEEDED':
        return <LimitExceeded />;
      case 'SUBSCRIPTION':
        return <Subscription />;
      default:
        return <Generator />;
    }
  }, [screenType]);

  return (
    <div className="flex gap-5 h-screen p-6 w-full overflow-hidden">
      {getScreen()}
    </div>
  );
}
