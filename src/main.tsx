import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '.';
import { Toaster } from 'sonner';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Toaster position="bottom-left" richColors />
    <App />
  </React.StrictMode>
);
