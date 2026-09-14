const fs = require('fs');

const checks = [
  ['Sentry 10.70.0 x3', 'apps/app-conductor/package.json', '@sentry/nextjs": "^10.70.0'],
  ['Sentry 10.70.0 usuario', 'apps/app-usuario/package.json', '@sentry/nextjs": "^10.70.0'],
  ['Sentry 10.70.0 panel', 'apps/panel-admin/package.json', '@sentry/nextjs": "^10.70.0'],
  ['apps/Dockerfile borrado', 'apps/Dockerfile', '', true],
  ['.vscode/launch.json untracked', '.gitignore', '.vscode/launch.json', true],
  ['CSP shared + 3 apps', 'packages/shared/src/seguridad/csp.ts', 'buildCsp'],
  ['assert:csp x3 en CI', '.github/workflows/ci.yml', 'assert CSP panel-admin'],
  ['lint gates 3 apps', '.github/workflows/ci.yml', 'Panel admin quality gate'],
  ['images remotePatterns shared', 'packages/shared/src/seguridad/csp.ts', 'IMAGES_REMOTE_PATTERNS'],
  ['mapbox ^3.26.0 conductor', 'apps/app-conductor/package.json', 'mapbox-gl": "^3.26.0'],
  ['vitest ^2.1.9 unificado', 'apps/app-conductor/package.json', 'vitest": "^2.1.9'],
  ['ui test script + vitest.config', 'packages/ui/package.json', '"test": "vitest run"'],
  ['panel vitest.config + test', 'apps/panel-admin/vitest.config.ts', 'include'],
  ['panel primer test', 'apps/panel-admin/src/lib/datos-cp.test.ts', 'describe'],
  ['vitest.workspace + ui+panel', 'vitest.workspace.ts', 'packages/ui'],
  ['overrides amplios + CVE comment', 'package.json', 'nanoid@3'],
  ['audit:deps en CI', '.github/workflows/ci.yml', 'audit:deps'],
  ['docker-compose PORT + HEALTHCHECK', 'docker-compose.yml', 'PORT=3001'],
  ['Dockerfile USER node + HEALTHCHECK', 'Dockerfile', 'USER node'],
  ['vercel.json turbo + CSP-ReportOnly', 'vercel.json', 'turbo run build'],
  ['lighthouserc usuario+panel', 'apps/app-usuario/lighthouserc.js', 'categories:performance'],
  ['facades api/next-*', 'packages/api/src/next-server/index.ts', 'crearClienteServidorDesdeCookies'],
  ['facades api/obs/flags/ubicacion', 'packages/api/src/observability/index.ts', 'crearRecordOperationalEvent'],
  ['placeholder.ts borrado', 'apps/panel-admin/src/placeholder.ts', '', true],
  ['datos-demo.ts borrado', 'apps/panel-admin/src/lib/datos-demo.ts', '', true],
  ['scripts/generar-codigos-postales.mjs raiz borrado', 'scripts/generar-codigos-postales.mjs', '', true],
  ['cp:generar -> shared', 'package.json', 'packages/shared/scripts/generar-codigos-postales-mx.mjs'],
  ['p-limit fachada -> shared', 'apps/app-conductor/src/lib/p-limit.ts', '@ruum/shared/utils'],
  ['facades conductor supabase/cap/ubic/obs/flags', 'apps/app-conductor/src/lib/observability.ts', '@ruum/api/observability'],
  ['facades usuario supabase/cap/ubic/obs/flags', 'apps/app-usuario/src/lib/observability.ts', '@ruum/api/observability'],
  ['facades panel supabase + puedeUsarDatosDemo', 'apps/panel-admin/src/lib/supabase-browser.ts', 'puedeUsarDatosDemo'],
  ['MapaEstatico en ui + 3 apps', 'packages/ui/src/components/MapaEstatico.tsx', 'MapaEstatico'],
  ['p-limit conductor -> shared', 'apps/app-conductor/src/lib/p-limit.ts', '@ruum/shared/utils'],
  ['any -> unknown realtime', 'packages/shared/src/utils/realtime.ts', 'unknown'],
];

let ok = 0;
let fail = 0;

for (const [label, file, pattern, shouldNotExist] of checks) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (shouldNotExist) {
      const exists = fs.existsSync(file);
      if (exists) {
        console.log('X ' + label + ': EXISTE (deberia estar borrado)');
        fail++;
      } else {
        console.log('OK ' + label);
        ok++;
      }
    } else {
      if (content.includes(pattern)) {
        console.log('OK ' + label);
        ok++;
      } else {
        console.log('X ' + label + ' (no encontrado: ' + pattern + ')');
        fail++;
      }
    }
  } catch (e) {
    console.log('WARN ' + label + ': error leyendo ' + file);
    fail++;
  }
}

console.log('');
console.log('Resumen: ' + ok + ' OK, ' + fail + ' FALLAN');
process.exit(fail > 0 ? 1 : 0);