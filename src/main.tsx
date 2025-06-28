import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import { Toaster } from 'sonner';
import { AppScreenProvider } from '@/context/app-screen-context';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppScreenProvider>
      <Toaster position="bottom-left" richColors />
      <App />
    </AppScreenProvider>
  </React.StrictMode>
);
