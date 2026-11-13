import React from 'react';
import { FEATURES } from '../../config/features';

// Deja claro que se está en el ambiente controlado (nada de lo que se ve es del sistema real).
export default function ModeBadge() {
  if (FEATURES.AUTH_PROVIDER !== 'mock') return null;
  return <span className="mode-badge" title="Login, usuarios y panel Sistema simulados en el navegador">Modo simulado</span>;
}
