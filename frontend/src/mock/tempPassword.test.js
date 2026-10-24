import { generateTemporaryPassword, TEMP_PASSWORD_LENGTH } from './tempPassword';
import { validatePassword, PASSWORD_SPECIALS } from '../shared/utils/password';

const SAMPLES = 400;
const samples = Array.from({ length: SAMPLES }, generateTemporaryPassword);

test('mide siempre 16 caracteres (EDH-53)', () => {
  expect(TEMP_PASSWORD_LENGTH).toBe(16);
  samples.forEach((p) => expect(p).toHaveLength(16));
});

test('cumple siempre la política de contraseñas de la US-05', () => {
  samples.forEach((p) => expect(validatePassword(p)).toBeNull());
});

test('siempre trae mayúscula, minúscula, número y un carácter especial permitido', () => {
  samples.forEach((p) => {
    expect(p).toMatch(/[A-Z]/);
    expect(p).toMatch(/[a-z]/);
    expect(p).toMatch(/[0-9]/);
    expect([...p].some((c) => PASSWORD_SPECIALS.includes(c))).toBe(true);
  });
});

test('no se repiten (fuente criptográfica) y los caracteres obligatorios no quedan siempre al principio', () => {
  expect(new Set(samples).size).toBe(SAMPLES);
  const startsWithUpper = samples.filter((p) => /[A-Z]/.test(p[0])).length;
  expect(startsWithUpper).toBeLessThan(SAMPLES * 0.7); // mezcla real: no es "mayúscula, minúscula, número, especial, ..."
});

test('usa generación criptográfica: el módulo no usa Math.random', () => {
  const source = require('fs').readFileSync(require('path').join(__dirname, 'tempPassword.js'), 'utf8');
  expect(source.replace(/\/\/.*$/gm, '')).not.toMatch(/Math\.random/); // los comentarios mencionan la regla, el código no
  expect(source).toMatch(/crypto\.getRandomValues/);
});

test('es el único generador de contraseñas: ningún otro flujo define el suyo', () => {
  const fs = require('fs');
  const path = require('path');
  ['usersApi.js', 'authApi.js', 'db.js'].forEach((file) => {
    const code = fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/function\s+generate\w*Password/); // sin funciones propias de generación
    expect(code).not.toMatch(/ALPHABET/); // sin alfabetos propios
  });
  const users = fs.readFileSync(path.join(__dirname, 'usersApi.js'), 'utf8');
  expect(users).toMatch(/from '\.\/tempPassword'/); // alta, reactivación y nueva contraseña temporal lo reutilizan
});
