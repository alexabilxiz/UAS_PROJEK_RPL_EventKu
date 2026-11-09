import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {import.meta.env.DEV && import.meta.env.MODE === 'demo' && (
      <p className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950">
        Mode demo lokal · Data simulasi · Gunakan akun dan kata sandi dummy
      </p>
    )}
    <BrowserRouter>
      <AuthProvider><App /></AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
