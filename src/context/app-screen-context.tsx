import { createContext, useContext, useState, ReactNode } from 'react';

type ScreenType = 'MAIN' | 'LIMIT_EXCEEDED';

interface AppScreenContextType {
  screen: ScreenType;
  setScreen: (screen: ScreenType) => void;
}

const AppScreenContext = createContext<AppScreenContextType | undefined>(
  undefined
);

export const useAppScreen = () => {
  const context = useContext(AppScreenContext);
  if (!context) {
    throw new Error('useAppScreen must be used within an AppScreenProvider');
  }
  return context;
};

export const AppScreenProvider = ({ children }: { children: ReactNode }) => {
  const [screen, setScreen] = useState<ScreenType>('MAIN');

  return (
    <AppScreenContext.Provider value={{ screen, setScreen }}>
      {children}
    </AppScreenContext.Provider>
  );
};
