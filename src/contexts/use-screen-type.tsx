import { load } from '@tauri-apps/plugin-store';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

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

// Contextの型
interface ScreenTypeContextProps {
  screenType: ScreenType | undefined;
  switchScreenType: (screenType: ScreenType) => void;
}

// Context作成
const ScreenTypeContext = createContext<ScreenTypeContextProps | undefined>(
  undefined
);

// Providerコンポーネント
export const ScreenTypeProvider = ({ children }: { children: ReactNode }) => {
  const [screenType, setScreenType] = useState<ScreenType>();

  useEffect(() => {
    loadScreenTypeStore().then((screenType) => {
      if (screenType) {
        setScreenType(screenType as ScreenType);
      }
    });
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
