#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const requestedOrigin = process.env.A11Y_BASE_URL || 'http://localhost:3001';
const serverTimeoutMs = 90_000;
const resultsDir = resolve(projectRoot, 'results');
const serverLogPath = resolve(resultsDir, 'a11y-dev-server.log');
const readinessRoutes = ['/login', '/onboarding', '/panel'];

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
    const server = createServer();
    server.once('error', () => resolvePort(false));
    server.once('listening', () => {
      server.close(() => resolvePort(true));
    });
    server.listen(port, '::');
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
  const server = await pickServerOrigin();
  const serverUrl = new URL(server.origin);
  const serverPort = serverUrl.port || '3001';

  if (server.shouldStart) {
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }
    serverLog = openSync(serverLogPath, 'w');
    serverProcess = spawn(`"${commandForLocalBin('next')}" dev -p ${serverPort}`, {
      cwd: projectRoot,
      detached: true,
      shell: true,
      stdio: ['ignore', serverLog, serverLog]
    });

    if (!(await waitForServer(server.origin))) {
      stopProcessTree(serverProcess.pid);
      closeSync(serverLog);
      console.error(`[a11y] No se pudo iniciar ${server.origin} dentro de ${serverTimeoutMs / 1000}s. Revisa ${serverLogPath}.`);
      process.exit(1);
    }
  }

  const playwrightArgs = process.argv.slice(2);
  const args = playwrightArgs[0] === 'test'
    ? playwrightArgs
    : ['test', 'tests/a11y', ...playwrightArgs];
  const result = spawnSync(commandForLocalBin('playwright'), args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      A11Y_BASE_URL: server.origin,
      PLAYWRIGHT_BASE_URL: server.origin,
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
