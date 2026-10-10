// jsdom no trae TextEncoder ni WebCrypto: se toman de Node.
const { TextEncoder } = require('util');
const { webcrypto } = require('crypto');

if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
