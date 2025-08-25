import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import './index.css';
import { Toaster } from '@/components/ui/sonner';
import { ScreenTypeProvider } from '@/contexts/use-screen-type';
import { AuthProvider } from '@/contexts/use-auth';
import { SubscriptionProvider } from '@/contexts/use-subscription';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <SubscriptionProvider>
        <ScreenTypeProvider>
          <App />
          <Toaster />
        </ScreenTypeProvider>
      </SubscriptionProvider>
    </AuthProvider>
  </React.StrictMode>
);
