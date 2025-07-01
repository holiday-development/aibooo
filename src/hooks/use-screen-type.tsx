import { load } from '@tauri-apps/plugin-store';
import { useEffect, useState } from 'react';

type ScreenType = 'MAIN' | 'LIMIT_EXCEEDED' | 'ONBOARDING';

async function loadScreenTypeStore() {
  const store = await load('usage.json');
  const screenType = store.get('screen_type');
  return screenType;
}

async function saveScreenTypeStore(screenType: ScreenType) {
  const store = await load('usage.json');
  store.set('screen_type', screenType);
  store.save();
}

export function useScreenType() {
  const [screenType, setScreenType] = useState<ScreenType>('ONBOARDING');

  useEffect(() => {
    loadScreenTypeStore().then((screenType) => {
      setScreenType(screenType as ScreenType);
    });
  }, []);

  const switchScreenType = (screenType: ScreenType) => {
    setScreenType(screenType);
    saveScreenTypeStore(screenType);
  };

  return { screenType, switchScreenType };
}
