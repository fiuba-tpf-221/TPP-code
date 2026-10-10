// US-01 (CA 3): quitar espacios de los bordes y colapsar 2+ espacios internos en uno.
export const normalizeSpaces = (value = '') => value.trim().replace(/ {2,}/g, ' ');
// US-01 (CA 5): el email se guarda siempre en minúsculas.
export const normalizeEmail = (value = '') => value.trim().toLowerCase();
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
