import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useScreenType } from '@/contexts/use-screen-type';
import { useAuth } from '@/contexts/use-auth';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';

export function EmailVerification() {
  const [email, setEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(true);
  const { switchScreenType } = useScreenType();
  const { checkAuthStatus } = useAuth();

  // コンポーネントマウント時に登録時のメールアドレスを取得
  useEffect(() => {
    const loadEmail = async () => {
      try {
        const store = await load('auth.json');
        const pendingEmail = await store.get('pending_email');
        if (pendingEmail) {
          setEmail(pendingEmail as string);
        } else {
          toast.error('メールアドレスが見つかりません。新規登録からやり直してください。');
          switchScreenType('REGISTER');
        }
      } catch (error) {
        console.error('Failed to load email:', error);
        toast.error('メールアドレスの読み込みに失敗しました。新規登録からやり直してください。');
        switchScreenType('REGISTER');
      } finally {
        setIsLoadingEmail(false);
      }
    };

    loadEmail();
  }, [switchScreenType]);

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !confirmationCode) {
      toast.error('確認コードを入力してください');
      return;
    }

    setIsLoading(true);

    try {
      // 保存されたパスワードを取得
      const store = await load('auth.json');
      const tempPassword = await store.get('temp_password') as string;

      if (!tempPassword) {
        toast.error('保存されたパスワード情報が見つかりません。新規登録からやり直してください。');
        switchScreenType('REGISTER');
        return;
      }

      // パスワードをデコード
      const password = atob(tempPassword);

      // メール認証と同時に認証トークンを取得
      const authResult = await invoke<{
        access_token: string;
        id_token: string;
        refresh_token: string;
        expires_in: number;
      }>('verify_email_and_login', {
        request: {
          email,
          password,
          confirmation_code: confirmationCode
        }
      });

      console.log('Email verification and login successful:', authResult);

      // 認証トークンを保存
      if (authResult.access_token && authResult.id_token && authResult.refresh_token) {
        const expiresAt = Date.now() + (authResult.expires_in * 1000);

        const authTokens = {
          access_token: authResult.access_token,
          id_token: authResult.id_token,
          refresh_token: authResult.refresh_token,
          token_type: 'Bearer',
          expires_in: authResult.expires_in,
          expires_at: expiresAt,
          user_email: email
        };

        await store.set('auth', authTokens);
        // 一時的なデータを削除
        await store.delete('pending_email');
        await store.delete('temp_password');
        await store.save();

        toast.success('メール認証が完了しました。');

        // 認証状態を更新
        await checkAuthStatus();

        // MAIN画面に遷移
        switchScreenType('MAIN');
      } else {
        throw new Error('認証トークンの取得に失敗しました');
      }
    } catch (error) {
      console.error('Email verification error:', error);

      const errorMessage = typeof error === 'string' ? error : 'メール認証に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    switchScreenType('LOGIN');
  };

  const handleBackToRegister = () => {
    switchScreenType('REGISTER');
  };

  if (isLoadingEmail) {
    return (
      <div className="h-full w-full p-4 flex flex-col justify-center items-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">メールアドレス確認中...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-4 flex flex-col justify-center items-center overflow-y-auto">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">メール認証</h1>
          <p className="text-sm text-muted-foreground">
            <strong>{email}</strong> に送信された確認コードを入力してください
          </p>
        </div>

        <form onSubmit={handleVerification} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirmationCode" className="text-sm">確認コード</Label>
            <Input
              id="confirmationCode"
              type="text"
              placeholder="123456"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              required
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              メールに記載されている6桁の確認コードを入力してください
            </p>
          </div>

          <Button
            type="submit"
            className="w-full h-10"
            disabled={isLoading}
          >
            {isLoading ? '認証中...' : '認証を完了'}
          </Button>
        </form>

        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            認証コードが届いていない場合は、
            <Button variant="link" className="p-0 h-auto text-sm underline ml-1" onClick={handleBackToRegister}>
              新規登録
            </Button>
            からやり直してください
          </p>

          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={handleBackToLogin}
              className="w-full h-10"
            >
              ログイン画面に戻る
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}