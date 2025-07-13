import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useScreenType } from '@/contexts/use-screen-type';
import { invoke } from '@tauri-apps/api/core';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { switchScreenType } = useScreenType();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword) {
      toast.error('すべての項目を入力してください');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('パスワードが一致しません');
      return;
    }

    if (password.length < 8) {
      toast.error('パスワードは8文字以上で入力してください');
      return;
    }

    // AWS Cognitoのパスワードポリシーチェック
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(password)) {
      toast.error('パスワードは大文字、小文字、数字、特殊文字を含む必要があります');
      return;
    }

    setIsLoading(true);

    try {
      // Cognito新規登録の実装
      const result = await invoke('register_user', {
        email: email,
        password: password
      });

      console.log('Registration successful:', result);

      // 登録成功時の処理
      toast.success('アカウントを作成しました。メールを確認して認証を完了してください。');

      // TODO: メール認証画面に遷移（Phase 7で実装予定）
      // switchScreenType('EMAIL_VERIFICATION');

      // 一時的にログイン画面に戻す
      switchScreenType('LOGIN');
    } catch (error) {
      console.error('Register error:', error);

      // エラーメッセージを適切に表示
      const errorMessage = typeof error === 'string' ? error : 'アカウントの作成に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    switchScreenType('LOGIN');
  };

    return (
    <div className="h-full w-full p-3 flex flex-col justify-center items-center">
      <div className="w-full max-w-sm space-y-3">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">新規登録</h1>
          <p className="text-xs text-muted-foreground">
            プレミアムプランのアカウントを作成して無制限でご利用いただけます
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-8"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs">パスワード</Label>
            <Input
              id="password"
              type="password"
              placeholder="8文字以上のパスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-8"
            />
            <p className="text-xs text-muted-foreground">
              パスワードは8文字以上で、大文字・小文字・数字・特殊文字を含む必要があります
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword" className="text-xs">パスワード（確認）</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="パスワードを再入力"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-8"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-8 mt-3"
            disabled={isLoading}
          >
            {isLoading ? 'アカウント作成中...' : 'アカウントを作成'}
          </Button>
        </form>

        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            すでにアカウントをお持ちの場合は、
            <Button variant="link" className="p-0 h-auto text-xs" onClick={handleBackToLogin}>
              ログイン
            </Button>
          </p>

          <Button
            variant="outline"
            onClick={handleBackToLogin}
            className="w-full h-8"
          >
            戻る
          </Button>
        </div>
      </div>
    </div>
  );
}