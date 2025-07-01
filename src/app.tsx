import { LimitExceeded } from '@/views/limit-exceeeded';
import { Generator } from '@/views/generator';
import { useCallback } from 'react';
import { useScreenType } from '@/hooks/use-screen-type';
import { Onboarding } from '@/views/onboarding';

export default function App() {
  const { screenType } = useScreenType();

  const getScreen = useCallback(() => {
    switch (screenType) {
      case 'ONBOARDING':
        return <Onboarding />;
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
