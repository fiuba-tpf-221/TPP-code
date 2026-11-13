const pkg = require('../../package.json');

test('package.json no define "proxy": activa una verificación de hosts que hace fallar `npm start` en máquinas sin red activa', () => {
  expect(pkg.proxy).toBeUndefined();
});

test('cada modo tiene su script, y cross-env hace que funcionen también en Windows', () => {
  expect(pkg.scripts['start:mock']).toBe('cross-env REACT_APP_MODE=mock react-scripts start');
  expect(pkg.scripts['start:keycloak']).toBe('cross-env REACT_APP_MODE=keycloak react-scripts start');
  expect(pkg.devDependencies['cross-env']).toBeDefined();
});

test('el Dockerfile instala devDependencies (la imagen no fija NODE_ENV=production antes de npm install)', () => {
  const dockerfile = require('fs').readFileSync(require('path').join(__dirname, '../../Dockerfile'), 'utf8');
  expect(dockerfile).not.toMatch(/NODE_ENV=production/);
});
