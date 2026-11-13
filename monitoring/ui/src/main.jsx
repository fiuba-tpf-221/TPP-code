import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { keycloak, INIT_OPTIONS } from "./keycloak";

const root = createRoot(document.getElementById("root"));

function renderStatus(message, { error = false, onRetry } = {}) {
  root.render(
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", fontFamily: "system-ui, sans-serif", color: error ? "#8a1f11" : "#52666e",
      textAlign: "center", padding: "0 1.5rem",
    }}>
      <div>
        <p>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} style={{ marginTop: ".5rem" }}>
            Reintentar
          </button>
        )}
      </div>
    </div>,
  );
}

renderStatus("Verificando la sesión…");

// login-required: si no hay sesión de Keycloak abierta, redirige a pedir usuario y contraseña;
// si ya hay una (SSO), vuelve con el token sin pedir nada. Sin sesión válida, no se llega a montar la app.
keycloak
  .init(INIT_OPTIONS)
  .then((authenticated) => {
    if (authenticated) root.render(<App />);
    else renderStatus("No se pudo iniciar sesión.");
  })
  .catch(() => {
    renderStatus("No se pudo conectar con el servicio de autenticación.", {
      error: true,
      onRetry: () => window.location.reload(),
    });
  });
