#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Cargar variables de entorno desde .env.local y .env
config({ path: resolve(projectRoot, '.env.local') });
config({ path: resolve(projectRoot, '.env') });
const requestedOrigin = process.env.A11Y_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const serverTimeoutMs = 90_000;
const resultsDir = resolve(projectRoot, 'results');
const serverLogPath = resolve(resultsDir, 'a11y-dev-server.log');
const readinessRoutes = ['/login', '/onboarding', '/panel'];
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1' || process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true';

function commandForLocalBin(name) {
  return process.platform === 'win32'
    ? resolve(projectRoot, 'node_modules', '.bin', `${name}.cmd`)
    : resolve(projectRoot, 'node_modules', '.bin', name);
}

async function isServerReady(origin) {
  try {
    for (const route of readinessRoutes) {
      const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
      if (response.status >= 500) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(origin) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < serverTimeoutMs) {
    if (await isServerReady(origin)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  }
  return false;
}

async function pickServerOrigin() {
  if (await isServerReady(requestedOrigin)) {
    return { origin: requestedOrigin, shouldStart: false };
  }

  const requestedUrl = new URL(requestedOrigin);
  const requestedPort = Number(requestedUrl.port || 80);
  for (let port = requestedPort; port <= requestedPort + 10; port += 1) {
    const candidate = `${requestedUrl.protocol}//${requestedUrl.hostname}:${port}`;
    if ((await isPortFree(port)) && !(await isServerReady(candidate))) {
      return { origin: candidate, shouldStart: true };
    }
  }

  return { origin: requestedOrigin, shouldStart: true };
}

function isPortFree(port) {
  return new Promise((resolvePort) => {
    const s4 = createServer();
    s4.once('error', () => resolvePort(false));
    s4.once('listening', () => {
      const s6 = createServer();
      s6.once('error', () => {
        s4.close(() => resolvePort(false));
      });
      s6.once('listening', () => {
        s6.close(() => {
          s4.close(() => resolvePort(true));
        });
      });
      s6.listen(port, '::');
    });
    s4.listen(port, '0.0.0.0');
  });
}

function stopProcessTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // El proceso pudo terminar por su cuenta.
    }
  }
}

async function main() {
  let serverProcess = null;
  let serverLog = null;
  
  // pnpm/npm puede reenviar el separador de argumentos como un literal "--".
  // Playwright no lo necesita y puede interpretarlo como una entrada extra.
  const playwrightArgs = process.argv.slice(2).filter((arg) => arg !== '--');
  const args = playwrightArgs[0] === 'test'
    ? playwrightArgs
    : ['test', 'tests/a11y', ...playwrightArgs];
    
  if (process.env.PLAYWRIGHT_A11Y_PROJECT && !args.some((arg) => arg === '--project' || arg.startsWith('--project='))) {
    args.push(`--project=${process.env.PLAYWRIGHT_A11Y_PROJECT}`);
  }
  if (!args.some((arg) => arg === '--workers' || arg.startsWith('--workers='))) {
    args.push('--workers=1');
  }

  if (args.includes('--list')) {
    const listResult = spawnSync(commandForLocalBin('playwright'), args, {
      cwd: projectRoot,
      env: process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit'
    });
    if (listResult.error) {
      console.error(`[a11y] ${listResult.error.message}`);
    }
    process.exit(listResult.status ?? 1);
  }

  // 🔥 MODIFICACIÓN: En CI o si ya hay servidor, no iniciar uno nuevo
  // Verificar si estamos en CI o si el servidor ya está corriendo
  const isCI = process.env.CI === 'true' || process.env.CI === '1';
  const serverAlreadyRunning = await isServerReady(requestedOrigin);
  
  let server = null;
  
  if (isCI || skipWebServer || serverAlreadyRunning) {
    if (serverAlreadyRunning) {
      console.log(`[a11y] ✅ Servidor ya está corriendo en ${requestedOrigin}`);
    } else {
      console.log('[a11y] 🚀 CI detectado o SKIP_WEBSERVER activado - usando servidor existente');
    }
    
    // Verificar que el servidor está respondiendo
    if (!(await isServerReady(requestedOrigin))) {
      console.error(`[a11y] ❌ Servidor no disponible en ${requestedOrigin}`);
      console.error('[a11y] Asegúrate de que el servidor esté corriendo antes de ejecutar este script');
      process.exit(1);
    }
    server = { origin: requestedOrigin, shouldStart: false };
  } else {
    server = skipWebServer ? null : await pickServerOrigin();
  }
  
  const serverOrigin = server?.origin ?? requestedOrigin;

  // Solo iniciar servidor si no estamos en CI y el servidor no está corriendo
  if (!isCI && !skipWebServer && server && server.shouldStart) {
    const serverUrl = new URL(server.origin);
    const serverPort = serverUrl.port || '3001';

    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }
    serverLog = openSync(serverLogPath, 'w');
    const nextBin = require.resolve('next/dist/bin/next', { paths: [projectRoot] });
    
    // 🔥 MODIFICACIÓN: Usar 'start' en lugar de 'dev' para modo producción
    serverProcess = spawn(process.execPath, [nextBin, 'start', '-p', serverPort], {
      cwd: projectRoot,
      detached: true,
      stdio: ['ignore', serverLog, serverLog]
    });

    if (!(await waitForServer(server.origin))) {
      stopProcessTree(serverProcess.pid);
      closeSync(serverLog);
      console.error(`[a11y] No se pudo iniciar ${server.origin} dentro de ${serverTimeoutMs / 1000}s. Revisa ${serverLogPath}.`);
      process.exit(1);
    }
  }

  // 🔥 NUEVO: Ejecutar el setup de autenticación antes de las pruebas
  console.log('[a11y] 🔑 Ejecutando setup de autenticación...');
  const setupResult = spawnSync(commandForLocalBin('playwright'), ['test', 'auth.setup.ts', '--project=setup'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      A11Y_BASE_URL: serverOrigin,
      PLAYWRIGHT_BASE_URL: serverOrigin,
      PLAYWRIGHT_SKIP_WEBSERVER: '1'
    },
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });

  if (setupResult.status !== 0) {
    console.error('[a11y] ❌ Falló el setup de autenticación');
    process.exit(setupResult.status ?? 1);
  }

  // Verificar que el archivo de sesión se creó
  const authFile = resolve(projectRoot, 'tests/.auth/conductor.json');
  if (!existsSync(authFile)) {
    console.error('[a11y] ❌ No se encontró el archivo de sesión después del setup');
    process.exit(1);
  }
  console.log('[a11y] ✅ Sesión de autenticación creada correctamente');

  // Ejecutar las pruebas
  console.log(`[a11y] 🧪 Ejecutando pruebas en ${serverOrigin}...`);
  const result = spawnSync(commandForLocalBin('playwright'), args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      A11Y_BASE_URL: serverOrigin,
      PLAYWRIGHT_BASE_URL: serverOrigin,
      PLAYWRIGHT_SKIP_WEBSERVER: '1'
    },
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });

  stopProcessTree(serverProcess?.pid);
  if (serverLog !== null) {
    closeSync(serverLog);
  }
  if (result.error) {
    console.error(`[a11y] ${result.error.message}`);
  }
  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(`[a11y] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});