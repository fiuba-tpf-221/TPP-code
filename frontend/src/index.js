import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import keycloak from './keycloak.js';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
    <h2>Conectando con el servicio de autenticación...</h2>
  </div>
);

keycloak
  .init({
    onLoad: 'login-required',
    checkLoginIframe: false,
    pkceMethod: 'S256',
  })
  .then((authenticated) => {
    if (authenticated) {
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    } else {
      window.location.reload();
    }
  })
  .catch((err) => {
    console.error('Error al inicializar Keycloak:', err);
    root.render(
      <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#d32f2f', textAlign: 'center' }}>
        <h2>Error de autenticación</h2>
        <p>No se pudo conectar con Keycloak en http://localhost:8080</p>
      </div>
    );
  });
