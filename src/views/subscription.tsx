import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscription } from '@/contexts/use-subscription';
import { useScreenType } from '@/contexts/use-screen-type';
import { SUBSCRIPTION_PLANS, PlanType } from '@/types/subscription';
import { Check, Crown, ArrowLeft, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { createCheckoutSession, getPriceId } from '@/lib/stripe';

export function Subscription() {
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { subscription, updatePlan } = useSubscription();
  const isActive = subscription?.is_active || false;
  const daysRemaining = subscription?.days_remaining || 0;
  const { switchScreenType } = useScreenType();

  const handlePlanSelect = (planType: PlanType) => {
    setSelectedPlan(planType);
  };

  const handlePurchase = async (planType: PlanType) => {
    setIsProcessing(true);
    try {
      const priceId = getPriceId(planType);

      // Stripe Checkout セッションを作成
      const { url, sessionId } = await createCheckoutSession({
        priceId,
        planType,
        successUrl: window.location.origin + '/payment-success',
        cancelUrl: window.location.origin + '/payment-cancel'
      });

      // モック決済処理（実際の決済の代わり）
      toast.success('決済処理を開始しています...', {
        duration: 2000,
      });

      // 実際の環境では window.location.href = url; で Stripe Checkout に遷移
      // ここではモック処理として直接決済完了処理を実行
      setTimeout(async () => {
        try {
          // モック決済成功として処理
          const customerId = `customer_${Date.now()}`;
          const verificationToken = `token_${sessionId}`;

          // サブスクリプションを更新
          await updatePlan(planType, customerId, verificationToken);

          toast.success(`${planType === 'weekly' ? '週額' : '月額'}プランの決済が完了しました！`);
          switchScreenType('MAIN');
        } catch (updateError) {
          console.error('Subscription update failed:', updateError);
          toast.error('サブスクリプションの更新に失敗しました');
        }
      }, 2000);

    } catch (error) {
      console.error('Payment failed:', error);
      toast.error('決済処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    switchScreenType('MAIN');
  };

  return (
    <div className="h-full w-full p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">プレミアムプラン</h1>
            <p className="text-muted-foreground">無制限でAIboooを利用しましょう</p>
          </div>
        </div>

        {/* 現在のサブスクリプション状態 */}
        {isActive && (
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Crown className="h-5 w-5" />
                プレミアム会員
              </CardTitle>
              <CardDescription className="text-green-700">
                                 {subscription?.plan_type === 'weekly' ? '週額プラン' : '月額プラン'}が有効です
                {daysRemaining > 0 && `（残り${daysRemaining}日）`}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* プラン比較 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
                         const isCurrentPlan = subscription?.plan_type === plan.id && isActive;

            return (
              <Card
                key={plan.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isSelected ? 'ring-2 ring-primary' : ''
                } ${isCurrentPlan ? 'border-green-400' : ''}`}
                onClick={() => handlePlanSelect(plan.id)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    {isCurrentPlan && (
                      <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        利用中
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">¥{plan.price}</span>
                    <span className="text-muted-foreground">
                      /{plan.id === 'weekly' ? '週' : '月'}
                    </span>
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>無制限の利用回数</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>全ての変換機能</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>優先サポート</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{plan.duration}日間有効</span>
                    </li>
                  </ul>
                </CardContent>

                <CardFooter>
                                    <Button
                    className="w-full"
                    variant={isSelected ? "default" : "outline"}
                    disabled={isCurrentPlan || isProcessing}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePurchase(plan.id);
                    }}
                  >
                    {isCurrentPlan ? (
                      <span className="flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        利用中
                      </span>
                    ) : isProcessing ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                        決済処理中...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        {plan.name}で始める
                      </span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* 無料プラン */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-xl">無料プラン</CardTitle>
            <CardDescription>基本的な機能をお試しいただけます</CardDescription>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">¥0</span>
              <span className="text-muted-foreground">/月</span>
            </div>
          </CardHeader>

          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-gray-400" />
                <span>1日20回まで利用可能</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-gray-400" />
                <span>基本的な変換機能</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              disabled={!isActive}
              onClick={handleBack}
            >
              {!isActive ? '現在利用中' : 'メインに戻る'}
            </Button>
          </CardFooter>
        </Card>

        {/* 注意事項 */}
        <div className="mt-8 text-sm text-muted-foreground">
          <p>※ 決済はStripeを通じて安全に処理されます</p>
          <p>※ サブスクリプションはいつでもキャンセル可能です</p>
        </div>
      </div>
    </div>
  );
}