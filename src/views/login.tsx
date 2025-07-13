import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useScreenType } from '@/contexts/use-screen-type';
import { useAuth } from '@/contexts/use-auth';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { switchScreenType } = useScreenType();
  const { login } = useAuth();

  // コンポーネントマウント時に保存されたメールアドレスを読み込み
  useEffect(() => {
    const loadSavedEmail = async () => {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('auth.json');
        const pendingEmail = await store.get('pending_email');
        if (pendingEmail && typeof pendingEmail === 'string') {
          setEmail(pendingEmail);
        }
      } catch (error) {
        // エラーは無視（初回起動など）
        console.log('No saved email found or failed to load:', error);
      }
    };

    loadSavedEmail();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('メールアドレスとパスワードを入力してください');
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      toast.success('ログインに成功しました');
      switchScreenType('MAIN');
    } catch (error) {
      console.error('Login error:', error);

      const errorMessage = typeof error === 'string' ? error : 'ログインに失敗しました';

      // メール認証が必要な場合の処理
      if (errorMessage.includes('メール認証が完了していません')) {
        toast.error(errorMessage);

        // メールアドレスを認証用にストレージに保存
        try {
          const { load } = await import('@tauri-apps/plugin-store');
          const store = await load('auth.json');
          await store.set('pending_email', email);
          await store.save();

          // メール認証画面に遷移
          setTimeout(() => {
            switchScreenType('EMAIL_VERIFICATION');
          }, 2000); // 2秒後に遷移
        } catch (storeError) {
          console.error('Failed to save email for verification:', storeError);
        }
      } else {
        toast.error(errorMessage);
      }
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