import { LimitExceeded } from '@/views/limit-exceeeded';
import { Generator } from '@/views/generator';
import { Login } from '@/views/login';
import { Register } from '@/views/register';
import { useCallback, useEffect } from 'react';
import { useScreenType } from '@/contexts/use-screen-type';
import { useAuth } from '@/contexts/use-auth';
import { Onboarding } from '@/views/onboarding';
import { checkForUpdate } from '@/lib/checkForUpdate';

export default function App() {
  const { screenType } = useScreenType();
  const { loading } = useAuth();

  useEffect(() => {
    if (screenType === 'MAIN') {
      checkForUpdate();
    }
  }, [screenType]);

  const getScreen = useCallback(() => {
    console.log('App: getScreen called with screenType:', screenType);
    switch (screenType) {
      case 'ONBOARDING':
        console.log('App: Rendering Onboarding');
        return <Onboarding />;
      case 'MAIN':
        console.log('App: Rendering Generator');
        return <Generator />;
      case 'LIMIT_EXCEEDED':
        console.log('App: Rendering LimitExceeded');
        return <LimitExceeded />;
      case 'LOGIN':
        console.log('App: Rendering Login');
        return <Login />;
      case 'REGISTER':
        console.log('App: Rendering Register');
        return <Register />;
      default:
        console.log('App: Rendering default Generator, screenType was:', screenType);
        return <Generator />;
    }
  }, [screenType]);

  // 認証状態のロード中は何も表示しない
  if (loading) {
    console.log('App: showing loading screen');
    return (
      <div className="flex items-center justify-center h-screen w-full bg-white">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">aibooo</div>
          <div className="text-sm text-gray-600">読み込み中...</div>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-5 h-screen p-6 w-full overflow-hidden">
      {getScreen()}
    </div>
  );
}
