import React from 'react';

// Pantalla provisoria para módulos que todavía no se desarrollaron.
export default function PlaceholderPage({ title }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="muted">Este módulo está en construcción.</p>
    </>
  );
}
