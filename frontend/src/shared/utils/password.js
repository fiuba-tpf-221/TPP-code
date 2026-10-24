// Política de contraseña (US-05). El backend es quien manda; esto da feedback inmediato.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;
export const PASSWORD_SPECIALS = '#"!$%&/()=?|+*{}[]-_<>,';
const ALLOWED = /^[A-Za-z0-9#"!$%&/()=?|+*{}[\]\-_<>,]+$/; // solo ASCII de la lista

// Devuelve el mensaje del primer problema, o null si la contraseña es válida.
export function validatePassword(value) {
  if (/\s/.test(value)) return 'La contraseña no puede contener espacios';
  if (value.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (value.length > PASSWORD_MAX) return `La contraseña no puede superar los ${PASSWORD_MAX} caracteres`;
  if (!ALLOWED.test(value)) return 'La contraseña contiene caracteres no permitidos';
  return null;
}
