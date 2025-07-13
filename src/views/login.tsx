import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useScreenType } from '@/contexts/use-screen-type';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';

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
      // Cognito認証の実装
      const result = await invoke('login_user', {
        email: email,
        password: password
      }) as {
        access_token: string;
        refresh_token: string;
        id_token: string;
        token_type: string;
        expires_in: number;
      };

      console.log('Login successful:', result);

      // トークンを保存
      const store = await load('auth.json');
      await store.set('tokens', {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        id_token: result.id_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        expires_at: Date.now() + (result.expires_in * 1000),
        user_email: email
      });
      await store.save();

      // 認証成功時の処理
      toast.success('ログインに成功しました');
      switchScreenType('MAIN');
    } catch (error) {
      console.error('Login error:', error);

      // エラーメッセージを適切に表示
      const errorMessage = typeof error === 'string' ? error : 'ログインに失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLimit = () => {
    switchScreenType('LIMIT_EXCEEDED');
  };

  const handleRegisterClick = () => {
    switchScreenType('REGISTER');
  };

    return (
    <div className="h-full w-full p-4 flex flex-col justify-center items-center">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">ログイン</h1>
          <p className="text-sm text-muted-foreground">
            プレミアムプランにアップグレードして無制限でご利用いただけます
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-sm">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-sm">パスワード</Label>
            <Input
              id="password"
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-9"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-9"
            disabled={isLoading}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            アカウントをお持ちでない場合は、
            <Button variant="link" className="p-0 h-auto text-xs" onClick={handleRegisterClick}>
              新規登録
            </Button>
          </p>

          <Button
            variant="outline"
            onClick={handleBackToLimit}
            className="w-full h-9"
          >
            戻る
          </Button>
        </div>
      </div>
    </div>
  );
}