// jsdom no trae TextEncoder ni WebCrypto: se toman de Node.
const { TextEncoder } = require('util');
const { webcrypto } = require('crypto');

if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

// Las pruebas del mock (usuarios, permisos, login simulado) corren con el proveedor simulado.
// Las de Keycloak lo cambian puntualmente.
require('./config/features').FEATURES.AUTH_PROVIDER = 'mock';
require('./config/features').FEATURES.SIMULATE_INFRA = false; // las pruebas del panel Sistema controlan `fetch` a mano

// jsdom no implementa <dialog>.showModal()/close(): se simula lo mínimo para probar los modales.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
}
