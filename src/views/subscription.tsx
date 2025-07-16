import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscription } from '@/contexts/use-subscription';
import { useScreenType } from '@/contexts/use-screen-type';
import { SUBSCRIPTION_PLANS, PlanType } from '@/types/subscription';
import { Check, Crown, ArrowLeft, CreditCard, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { createCheckoutSession, getPriceId } from '@/lib/stripe';

export function Subscription() {
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { subscription, updatePlan, resetPlan } = useSubscription();
  const isActive = subscription?.is_active || false;
  const daysRemaining = subscription?.days_remaining || 0;
  const { switchScreenType } = useScreenType();

  const handlePlanSelect = (planType: PlanType) => {
    setSelectedPlan(planType);
  };

  const handlePurchase = async (planType: PlanType) => {
    setIsProcessing(true);
    try {
      const priceId = await getPriceId(planType);

      // Stripe Checkout セッションを作成
      await createCheckoutSession({
        priceId,
        planType,
        successUrl: window.location.origin + '/payment-success',
        cancelUrl: window.location.origin + '/payment-cancel'
      });

      // createCheckoutSession内でredirectToCheckoutが実行されるため、
      // 正常時はここに到達しません（ページ遷移が発生）

    } catch (error) {
      console.error('Payment failed:', error);
      toast.error('決済処理中にエラーが発生しました');
      setIsProcessing(false);
    }
    // setIsProcessing(false) は意図的に省略
    // ページ遷移が発生するか、エラー時のみsetIsProcessing(false)を実行
  };

  const handleBack = () => {
    switchScreenType('MAIN');
  };

  const handleCancelSubscription = async () => {
    setIsProcessing(true);
    try {
      await resetPlan();
      toast.success('サブスクリプションをキャンセルしました', {
        description: '無料プランに戻りました。ご利用ありがとうございました。',
      });
      setShowCancelConfirm(false);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      toast.error('キャンセル処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
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

        {/* プラン比較 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id; const isCurrentPlan = subscription?.plan_type === plan.id && isActive; return ( <Card
                key={plan.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isSelected ? 'ring-2 ring-primary' : ''
                } ${isCurrentPlan ? 'border-primary/50' : ''}`}
                onClick={() => handlePlanSelect(plan.id)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    {isCurrentPlan && (
                      <div className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium">
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
                      <Check className="h-4 w-4 text-primary" />
                      <span>無制限の利用回数</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>全ての変換機能</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>優先サポート</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
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
        <Card className="border-muted">
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
                <Check className="h-4 w-4 text-muted-foreground" />
                <span>1日20回まで利用可能</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-muted-foreground" />
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
                {/* 現在のサブスクリプション状態 */}
        {isActive && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Crown className="h-5 w-5" />
                プレミアム会員
              </CardTitle>
              <CardDescription className="text-foreground/80">
                {subscription?.plan_type === 'weekly' ? '週額プラン' : '月額プラン'}が有効です
                {daysRemaining > 0 && `（残り${daysRemaining}日）`}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelConfirm(true)}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                サブスクリプションをキャンセル
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* 解約確認ダイアログ */}
        {showCancelConfirm && (
          <Card className="mb-8 border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">
                サブスクリプションのキャンセル確認
              </CardTitle>
              <CardDescription className="text-foreground/80">
                本当にサブスクリプションをキャンセルしますか？<br />
                キャンセル後は無料プランに戻り、プレミアム機能をご利用いただけなくなります。
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0 gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCancelConfirm(false)}
                disabled={isProcessing}
              >
                キャンセルしない
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelSubscription}
                disabled={isProcessing}
              >
                {isProcessing ? 'キャンセル中...' : 'はい、キャンセルします'}
              </Button>
            </CardFooter>
          </Card>
        )}



        {/* 注意事項 */}
        <div className="mt-8 text-sm text-muted-foreground">
          <p>※ 決済はStripeを通じて安全に処理されます</p>
          <p>※ サブスクリプションはいつでもキャンセル可能です</p>
        </div>
      </div>
    </div>
  );
}