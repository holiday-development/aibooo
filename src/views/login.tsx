import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useScreenType } from '@/contexts/use-screen-type';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { switchScreenType } = useScreenType();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('メールアドレスとパスワードを入力してください');
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Cognito認証の実装
      // 現在は仮実装
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 認証成功時の処理
      toast.success('ログインに成功しました');
      switchScreenType('MAIN');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLimit = () => {
    switchScreenType('LIMIT_EXCEEDED');
  };

  return (
    <div className="h-full w-full p-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">ログイン</h1>
          <p className="text-muted-foreground">
            プレミアムプランにアップグレードして無制限でご利用いただけます
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            アカウントをお持ちでない場合は、
            <Button variant="link" className="p-0 h-auto text-sm">
              新規登録
            </Button>
          </p>

          <Button
            variant="outline"
            onClick={handleBackToLimit}
            className="w-full"
          >
            戻る
          </Button>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <div className="w-[80px] h-[64px]">
          <img src="/ai.svg" alt="ai" />
        </div>
      </div>
    </div>
  );
}