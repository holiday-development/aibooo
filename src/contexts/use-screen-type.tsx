import { load } from '@tauri-apps/plugin-store';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

type ScreenType = 'MAIN' | 'LIMIT_EXCEEDED' | 'ONBOARDING';

const GENERATION_LIMIT = 20;

async function loadScreenTypeStore() {
  const store = await load('usage.json');
  const screenType = store.get('screen_type');
  return screenType;
}

async function loadTodayRequestCount() {
  const store = await load('usage.json');
  const requestCount = (await store.get('request_count')) as Record<
    string,
    number
  >;
  const today = new Date().toISOString().split('T')[0];
  const todayRequestCount = requestCount[today] || 0;
  return todayRequestCount;
}

async function saveScreenTypeStore(screenType: ScreenType) {
  const store = await load('usage.json');
  store.set('screen_type', screenType);
  store.save();
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

  async function initialScreenType() {
    const screenType = await loadScreenTypeStore();
    if (screenType) {
      setScreenType(screenType as ScreenType);
    }
    const todayRequestCount = await loadTodayRequestCount();
    if (todayRequestCount >= GENERATION_LIMIT) {
      switchScreenType('LIMIT_EXCEEDED');
    }
  }

  useEffect(() => {
    initialScreenType();
  }, []);

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
