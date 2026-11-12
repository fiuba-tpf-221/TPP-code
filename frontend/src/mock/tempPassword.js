// Generación de contraseñas temporales (EDH-53). ÚNICO punto de generación: alta (US-01), reactivación (US-03)
// y nueva contraseña temporal (US-08) lo reutilizan; ningún flujo implementa lógica propia.
//  · Longitud fija de 16 caracteres.
//  · Fuente criptográficamente segura (crypto.getRandomValues). Nunca Math.random.
//  · Solo caracteres de la política de contraseñas (US-05), con al menos una mayúscula, una minúscula, un número y un especial.
//  · Nunca se registra en auditoría, logs ni se guarda en texto plano.
import { PASSWORD_SPECIALS } from '../shared/utils/password';

export const TEMP_PASSWORD_LENGTH = 16;
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

// Entero uniforme en [0, max) sin sesgo de módulo.
function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % max;
}
const pick = (set) => set[randomInt(set.length)];

export function generateTemporaryPassword() {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(PASSWORD_SPECIALS)]; // una de cada clase
  const all = UPPER + LOWER + DIGITS + PASSWORD_SPECIALS;
  while (chars.length < TEMP_PASSWORD_LENGTH) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) { // mezcla Fisher-Yates: las clases obligatorias no quedan siempre al principio
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
