import { LimitExceeded } from '@/limit-exceeeded';
import { useAppScreen } from '@/context/app-screen-context';
import { Generator } from '@/generator';
import { useCallback } from 'react';

export default function App() {
  const { screen } = useAppScreen();

  const getScreen = useCallback(() => {
    switch (screen) {
      case 'MAIN':
        return <Generator />;
      case 'LIMIT_EXCEEDED':
        return <LimitExceeded />;
      default:
        return <Generator />;
    }
  }, [screen]);

  return <div className="flex gap-5 h-screen p-6 w-full">{getScreen()}</div>;
}
