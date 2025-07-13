import { Button } from '@/components/ui/button';
import { useScreenType } from '@/contexts/use-screen-type';

export function LimitExceeded() {
  const { switchScreenType } = useScreenType();

  const handleLoginClick = () => {
    switchScreenType('LOGIN');
  };

  return (
    <div className="h-full w-full p-8 flex flex-col justify-center">
      <h1 className="text-2xl text-center">一日の使用回数制限に達しました</h1>
      <p className="text-md text-center mt-4 text-primary">
        有料プランにアップグレードして無制限でご利用いただけます
      </p>
      <div className="w-[120px] h-[96px] flex justify-center mt-6 mx-auto">
        <img src="/ai.svg" alt="ai" />
      </div>
      <div className="flex flex-col gap-3 mt-8 mx-auto w-full max-w-xs">
        <Button
          onClick={handleLoginClick}
          className="w-full"
          size="lg"
        >
          有料プランにアップグレード
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          無制限の利用と有料機能をご利用いただけます
        </p>
      </div>
    </div>
  );
}
