import { validatePassword } from './password';

test.each([
  ['Abcdef1!', null], ['a'.repeat(64), null], ['Con-guion_y,coma', null],
  ['corta1!', 'al menos'], ['a'.repeat(65), 'superar'],
  ['con espacio 1', 'espacios'], ['con\ttab12345', 'espacios'],
  ['contraseñaÑ1', 'no permitidos'], ['Abc123;;;', 'no permitidos'], ['Abc123@@@', 'no permitidos'],
])('validatePassword(%j)', (value, expected) => {
  const result = validatePassword(value);
  if (expected === null) expect(result).toBeNull(); else expect(result).toContain(expected);
});
