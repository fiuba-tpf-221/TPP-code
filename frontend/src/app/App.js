import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import AppRouter from './AppRouter';

// Acá se montan los "providers" globales (auth, tema, i18n, etc.)
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
