import { load } from '@tauri-apps/plugin-store';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useAuth } from '@/contexts/use-auth';

type ScreenType = 'MAIN' | 'LIMIT_EXCEEDED' | 'ONBOARDING' | 'LOGIN' | 'REGISTER' | 'EMAIL_VERIFICATION' | 'SUBSCRIPTION';

const GENERATION_LIMIT = 20;

async function loadScreenTypeStore() {
  const store = await load('usage.json');
  const screenType = store.get('screen_type');
  return screenType;
}

async function loadTodayRequestCount() {
  const store = await load('usage.json');
  const today = new Date().toISOString().slice(0, 10);
  const requestCount = store.get('request_count');
  if (requestCount && typeof requestCount === 'object') {
    return (requestCount as any)[today] || 0;
  }
  return 0;
}

async function saveScreenTypeStore(screenType: ScreenType) {
  const store = await load('usage.json');
  await store.set('screen_type', screenType);
  await store.save();
}

interface ScreenTypeContextProps {
  screenType: ScreenType | undefined;
  switchScreenType: (screenType: ScreenType) => void;
}

const ScreenTypeContext = createContext<ScreenTypeContextProps | undefined>(
  undefined
);

export const ScreenTypeProvider = ({ children }: { children: ReactNode }) => {
  const [screenType, setScreenType] = useState<ScreenType>();
  const { isAuthenticated, loading } = useAuth();

  async function initialScreenType() {
    const store = await load('usage.json');

    // ログイン完了フラグをチェック
    const loginCompleted = await store.get('login_completed') as boolean | undefined;
    const nextScreenAfterLogin = await store.get('next_screen_after_login') as ScreenType | undefined;

    if (loginCompleted && nextScreenAfterLogin) {
      // ログイン完了フラグがある場合は、指定された画面に遷移
      console.log('Login completed, navigating to:', nextScreenAfterLogin);
      setScreenType(nextScreenAfterLogin);
      saveScreenTypeStore(nextScreenAfterLogin);

      // フラグをクリア
      await store.delete('login_completed');
      await store.delete('next_screen_after_login');
      await store.save();
      return;
    }

    // 通常の初期化処理
    const screenType = await loadScreenTypeStore();
    setScreenType((screenType as ScreenType | undefined) || 'ONBOARDING');
    const todayRequestCount = await loadTodayRequestCount();
    if (todayRequestCount >= GENERATION_LIMIT) {
      switchScreenType('LIMIT_EXCEEDED');
    }
    if (
      screenType === 'LIMIT_EXCEEDED' &&
      todayRequestCount < GENERATION_LIMIT
    ) {
      switchScreenType('MAIN');
    }
  }

  useEffect(() => {
    initialScreenType();
  }, []);

  // 認証状態の変化を監視してログイン完了後の画面遷移を処理
  useEffect(() => {
    if (!loading && isAuthenticated) {
      // 認証が完了した場合、ログイン完了フラグをチェック
      const checkLoginCompletion = async () => {
        try {
          const store = await load('usage.json');
          const loginCompleted = await store.get('login_completed') as boolean | undefined;
          const nextScreenAfterLogin = await store.get('next_screen_after_login') as ScreenType | undefined;

          if (loginCompleted && nextScreenAfterLogin) {
            console.log('Authentication completed, navigating to:', nextScreenAfterLogin);
            setScreenType(nextScreenAfterLogin);
            saveScreenTypeStore(nextScreenAfterLogin);

            // フラグをクリア
            await store.delete('login_completed');
            await store.delete('next_screen_after_login');
            await store.save();
          }
        } catch (error) {
          console.error('Error checking login completion:', error);
        }
      };

      checkLoginCompletion();
    }
  }, [isAuthenticated, loading]);

  const switchScreenType = (screenType: ScreenType) => {
    setScreenType(screenType);
    saveScreenTypeStore(screenType);
  };

  return (
    <ScreenTypeContext.Provider value={{ screenType, switchScreenType }}>
      {children}
    </ScreenTypeContext.Provider>
  );
};

export function useScreenType() {
  const context = useContext(ScreenTypeContext);
  if (!context) {
    throw new Error('useScreenType must be used within a ScreenTypeProvider');
  }
  return context;
}
