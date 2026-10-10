import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ROUTES } from '../../config/routes';
import { FEATURES } from '../../config/features';
import { APP_NAME } from '../../config/app';
import Alert from '../../shared/components/Alert';
import { LOGIN_ERROR } from './messages';
import Carousel from '../../shared/components/Carousel';
import { AUTH_SLIDES } from './authSlides';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import GoogleButton from './components/GoogleButton';
import './auth.css';

const TABS = [
  { id: 'login', label: 'Iniciar sesión' },
  { id: 'register', label: 'Crear cuenta' },
];

export default function AuthPage() {
  const { isAuthenticated, login, register, loginWithGoogle, notice } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [googleError, setGoogleError] = useState('');

  // Al autenticarse (por cualquier vía) se redirige acá solo.
  if (isAuthenticated) return <Navigate to={location.state?.from?.pathname || ROUTES.HOME} replace />;

  const hasTabs = FEATURES.SELF_REGISTRATION;
  const selectTab = (id) => { setMode(id); setGoogleError(''); };

  const handleGoogle = async (credential) => {
    setGoogleError('');
    try {
      await loginWithGoogle(credential);
    } catch (err) {
      setGoogleError([401, 403].includes(err.status) ? LOGIN_ERROR : err.message);
    }
  };

  return (
    <div className="auth">
      <aside className="auth__aside">
        <Carousel slides={AUTH_SLIDES} label="Sobre el proyecto" />
      </aside>

      <main className="auth__main">
        <div className="auth__brand">
          <strong>{APP_NAME}</strong>
          <span>Predicción de pozos petroleros</span>
        </div>

        {notice && <Alert kind="info">{notice}</Alert>}

        <div className="window">
          {hasTabs && (
            <div className="window__tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} role="tab" type="button" id={`tab-${t.id}`}
                  aria-selected={mode === t.id} aria-controls="auth-panel"
                  className="window__tab" onClick={() => selectTab(t.id)}>
                  {t.label}
                </button>
              ))}
              <span className={`window__indicator${mode === 'register' ? ' is-right' : ''}`} aria-hidden="true" />
            </div>
          )}

          <div key={mode} id="auth-panel" className="window__body"
            {...(hasTabs && { role: 'tabpanel', 'aria-labelledby': `tab-${mode}` })}>
            {!hasTabs && <h1 className="window__title">Iniciar sesión</h1>}
            {mode === 'login' ? <LoginForm onSubmit={login} /> : <RegisterForm onSubmit={register} />}

            <div className="divider"><span>o</span></div>
            <GoogleButton onCredential={handleGoogle} onError={setGoogleError} />
            {googleError && <Alert kind="error">{googleError}</Alert>}
          </div>
        </div>
      </main>
    </div>
  );
}
