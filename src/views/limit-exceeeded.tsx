import { Button } from '@/components/ui/button';
import { useScreenType } from '@/contexts/use-screen-type';
import { Crown } from 'lucide-react';

export function LimitExceeded() {
  const { switchScreenType } = useScreenType();

  const handleUpgrade = () => {
    switchScreenType('SUBSCRIPTION');
  };

  return (
    <div className="h-full w-full p-8 flex flex-col justify-center">
      <h1 className="text-2xl text-center">一日の使用回数制限に達しました</h1>
      <p className="text-md text-center mt-4 text-muted-foreground">
        プレミアムプランで無制限に利用できます
      </p>
      <div className="w-[120px] h-[96px] flex justify-center mt-6 mx-auto">
        <img src="/ai.svg" alt="ai" />
      </div>
      <div className="flex flex-col gap-3 mt-8 max-w-xs mx-auto w-full">
        <Button onClick={handleUpgrade} className="w-full">
          <Crown className="h-4 w-4 mr-2" />
          プレミアムプランを見る
        </Button>
        <Button variant="outline" onClick={() => switchScreenType('MAIN')} className="w-full">
          メインに戻る
        </Button>
      </div>
    </div>
  );
}
