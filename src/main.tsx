import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import { Toaster } from 'sonner';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Toaster position="bottom-left" richColors />
    <App />
  </React.StrictMode>
);
