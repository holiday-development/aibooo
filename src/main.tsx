import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import { Toaster } from 'sonner';
import './index.css';
import { ScreenTypeProvider } from '@/contexts/use-screen-type';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ScreenTypeProvider>
      <Toaster position="bottom-left" richColors />
      <App />
    </ScreenTypeProvider>
  </React.StrictMode>
);
