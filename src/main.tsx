import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import { Toaster } from 'sonner';
import './index.css';
import { ScreenTypeProvider } from '@/contexts/use-screen-type';
import { AuthProvider } from '@/contexts/use-auth';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ScreenTypeProvider>
      <AuthProvider>
        <Toaster position="bottom-left" richColors />
        <App />
      </AuthProvider>
    </ScreenTypeProvider>
  </React.StrictMode>
);
