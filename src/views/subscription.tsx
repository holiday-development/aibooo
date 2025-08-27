import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscription } from '@/contexts/use-subscription';
import { useScreenType } from '@/contexts/use-screen-type';
import { useAuth } from '@/contexts/use-auth';
import { SUBSCRIPTION_PLANS, PlanType } from '@/types/subscription';
import { Check, Crown, ArrowLeft, CreditCard, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { createCheckoutSession, getPriceId } from '@/lib/stripe';
import { getSubscriptionFromCognito } from '@/lib/subscription';
import { invoke } from '@tauri-apps/api/core';

export function Subscription() {
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { subscription, updatePlan: _updatePlan, resetPlan, refreshSubscription } = useSubscription();
  const { tokens } = useAuth();
  const isActive = subscription?.is_active || false;
  const daysRemaining = subscription?.days_remaining || 0;
  const { switchScreenType } = useScreenType();

  // Cognitoから最新のサブスクリプション状態を取得
  const refreshFromCognito = async (showSuccessMessage = false) => {
    if (!tokens?.access_token) return;

    try {
      setIsRefreshing(true);
      console.log('Cognitoからサブスクリプション状態を更新中...');

      // Cognitoから最新のサブスクリプション情報を取得
      const cognitoSubscription = await getSubscriptionFromCognito(tokens.access_token);
      console.log('Cognito subscription data:', cognitoSubscription);

      // ローカルサブスクリプション状態を更新
      await refreshSubscription();

      if (showSuccessMessage) {
        toast.success('プラン情報を更新しました');
      }
    } catch (error) {
      console.error('Failed to refresh from Cognito:', error);
      toast.error('プラン情報の更新に失敗しました');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 画面表示時とトークン更新時にCognitoから状態を取得
  useEffect(() => {
    if (tokens?.access_token) {
      refreshFromCognito();
    }
  }, [tokens?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stripe決済完了時の処理（URL hash や localStorage を監視）
  useEffect(() => {
    const checkPaymentCompletion = async () => {
      try {
        // URLハッシュから決済完了情報を確認
        const hash = window.location.hash;
        if (hash.includes('payment-success')) {
          console.log('決済完了を検知しました');

          // URLハッシュからプラン情報を取得
          const urlParams = new URLSearchParams(hash.substring(1));
          const planType = urlParams.get('plan') as PlanType;
          const sessionId = urlParams.get('session_id');

          if (planType && sessionId) {
            console.log('決済完了処理開始:', { planType, sessionId });

            // update_subscriptionを実行
            try {
              await _updatePlan(planType, sessionId);
              toast.success(`${planType}プランの決済が完了しました！`);

              // ハッシュをクリア
              window.location.hash = '';

              // サブスクリプション状態を更新
              await refreshSubscription();
            } catch (error) {
              console.error('決済完了処理エラー:', error);
              toast.error('決済は完了しましたが、プラン設定に失敗しました。サポートにお問い合わせください。');
            }
          }
        }

        // LocalStorageからの決済完了フラグもチェック
        const paymentCompleted = localStorage.getItem('stripe_payment_completed');
        const completedPlan = localStorage.getItem('stripe_completed_plan');
        const completedCustomerId = localStorage.getItem('stripe_customer_id');

        if (paymentCompleted === 'true' && completedPlan && completedCustomerId) {
          console.log('localStorage決済完了を検知:', { completedPlan, completedCustomerId });

          try {
            await _updatePlan(completedPlan as PlanType, completedCustomerId);
            toast.success(`${completedPlan}プランの決済が完了しました！`);

            // LocalStorageをクリア
            localStorage.removeItem('stripe_payment_completed');
            localStorage.removeItem('stripe_completed_plan');
            localStorage.removeItem('stripe_customer_id');

            await refreshSubscription();
          } catch (error) {
            console.error('決済完了処理エラー:', error);
            toast.error('決済は完了しましたが、プラン設定に失敗しました。サポートにお問い合わせください。');
          }
        }
      } catch (error) {
        console.error('決済完了チェックエラー:', error);
      }
    };

    // 画面表示時に決済完了をチェック
    checkPaymentCompletion();

    // hashchange イベントで決済完了を監視
    const handleHashChange = () => {
      checkPaymentCompletion();
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [_updatePlan, refreshSubscription]); // eslint-disable-line react-hooks/exhaustive-deps



  const handlePlanSelect = (planType: PlanType) => {
    setSelectedPlan(planType);
  };

  const handlePurchase = async (planType: PlanType) => {
    setIsProcessing(true);
    try {
      console.log('プラン選択:', planType);
      const priceId = await getPriceId(planType);
      console.log('価格ID取得成功:', priceId);

      // 決済情報をLocalStorageに保存（決済完了時の検知用）
      localStorage.setItem('stripe_pending_plan', planType);

      // Stripe Checkout セッションを作成
      const checkoutResult = await createCheckoutSession({
        priceId,
        planType,
        successUrl: window.location.origin + '/#payment-success?plan=' + planType,
        cancelUrl: window.location.origin + '/#payment-cancel'
      });

      console.log('Stripe Checkout セッション作成完了:', checkoutResult);

      // createCheckoutSession内でredirectToCheckoutが実行されるため、
      // 正常時はここに到達しません（ページ遷移が発生）

    } catch (error) {
      console.error('Payment failed:', error);

      // エラーメッセージを詳細化
      let errorMessage = '決済処理中にエラーが発生しました';
      if (error instanceof Error) {
        if (error.message.includes('環境変数')) {
          errorMessage = 'Stripe設定が不完全です。管理者にお問い合わせください。';
        } else if (error.message.includes('price')) {
          errorMessage = 'プラン設定に問題があります。管理者にお問い合わせください。';
        } else {
          errorMessage = `決済エラー: ${error.message}`;
        }
      }

      toast.error(errorMessage, {
        description: '設定を確認してから再度お試しください。',
        duration: 5000,
      });
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

                {/* デバッグ用ツール */}
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-medium text-red-800 mb-2">🔧 デバッグ用ツール</h3>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={async () => {
              try {
                const result = await invoke('debug_storage_state');
                console.log('ストレージ状態:', result);
                toast.success('ストレージ状態をコンソールに出力しました');
              } catch (error) {
                console.error('ストレージ確認エラー:', error);
                toast.error('ストレージ確認に失敗');
              }
            }}>
              ストレージ確認
            </Button>
            <Button size="sm" variant="outline" onClick={async () => {
              try {
                const result = await invoke('test_set_premium', { planType: 'weekly' });
                console.log('テスト設定結果:', result);
                toast.success('Weeklyプレミアム設定完了');
                await refreshSubscription();
              } catch (error) {
                console.error('テスト設定エラー:', error);
                toast.error('テスト設定に失敗');
              }
            }}>
              テストプレミアム設定
            </Button>
            <Button size="sm" variant="outline" onClick={async () => {
              await refreshSubscription();
              toast.success('サブスクリプション状態をリフレッシュしました');
            }}>
              状態リフレッシュ
            </Button>
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