import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import { Toaster } from 'sonner';
import './index.css';
import { ScreenTypeProvider } from '@/contexts/use-screen-type';
import { SubscriptionProvider } from '@/contexts/use-subscription';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SubscriptionProvider>
      <ScreenTypeProvider>
        <Toaster position="bottom-left" richColors />
        <App />
      </ScreenTypeProvider>
    </SubscriptionProvider>
  </React.StrictMode>
);
