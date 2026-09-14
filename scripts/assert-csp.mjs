#!/usr/bin/env node
// SEC-002 — Aserción de CSP en build (bloqueante)
// Uso: node scripts/assert-csp.mjs [conductor|usuario|panel] (default: conductor)
// Verifica que next.config y middleware consumen la fuente única
// @ruum/shared/seguridad y que no hay regresiones (unsafe-* en prod).
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIRS = {
  conductor: "apps/app-conductor",
  usuario: "apps/app-usuario",
  panel: "apps/panel-admin",
};

export function runAssertCsp(app, repoRoot) {
  const dir = APP_DIRS[app];
  if (!dir) {
    console.error(`❌ [assert-csp] app desconocida "${app}" (conductor|usuario|panel)`);
    process.exit(1);
  }
  const root = join(repoRoot, dir);
  let falhas = 0;

  function assert(cond, msg) {
    if (!cond) {
      console.error(`❌ [assert-csp:${app}] ${msg}`);
      falhas++;
    } else {
      console.log(`✅ [assert-csp:${app}] ${msg}`);
    }
  }

  const nextConfig = readFileSync(join(root, "next.config.ts"), "utf-8");
  const middleware = readFileSync(join(root, "src/middleware.ts"), "utf-8");

  const libCspPath = join(root, "src", "lib", "csp.ts");
  const libCsp = existsSync(libCspPath) ? readFileSync(libCspPath, "utf-8") : "";
  // Sin comentarios: los comentarios pueden mencionar 'unsafe-*' al documentar.
  const nextConfigCode = nextConfig.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // 1) Fuente única: next.config (directo o vía src/lib/csp.ts) consume @ruum/shared/seguridad
  assert(
    nextConfig.includes("@ruum/shared/seguridad") || libCsp.includes("@ruum/shared/seguridad"),
    "next.config consume @ruum/shared/seguridad (directo o vía src/lib/csp.ts)",
  );
  assert(
    middleware.includes("@ruum/shared/seguridad") || libCsp.includes("@ruum/shared/seguridad"),
    "middleware (o src/lib/csp.ts) consume @ruum/shared/seguridad",
  );

  // 2) Preset correcto por app
  assert(
    nextConfig.includes(`CSP_PRESETS.${app}`) || libCsp.includes(`CSP_PRESETS.${app}`),
    `next.config/lib usa CSP_PRESETS.${app}`,
  );

  // 3) Sin literales inseguros en next.config: el fallback prod sale del builder.
  // Ningún next.config de app puede declarar script-src con unsafe-inline/eval.
  assert(!nextConfigCode.includes("script-src 'self' 'unsafe-inline'"), "next.config sin script-src 'unsafe-inline' literal");
  assert(!nextConfigCode.includes("'unsafe-eval'"), "next.config sin 'unsafe-eval' literal (solo el builder lo emite en dev)");

  // 4) Middleware genera nonce por request y lo propaga
  assert(middleware.includes("crypto.randomUUID()") && middleware.includes('requestHeaders.set("x-nonce"'), "middleware genera nonce por request y lo propaga");

  // 5) Headers de seguridad presentes (middleware o next.config)
  const conHeaders = middleware + nextConfig;
  for (const h of ["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert(conHeaders.includes(h), `header ${h} presente`);
  }

  // 6) Deuda style-src documentada (solo conductor, dueño del doc)
  if (app === "conductor") {
    const deudaPath = join(root, "CSP_DEUDA_P2.md");
    const deuda = existsSync(deudaPath) ? readFileSync(deudaPath, "utf-8") : "";
    assert(deuda.includes("style-src") && deuda.includes("2026-11-01"), "CSP_DEUDA_P2.md documenta deuda style-src con fecha objetivo");
    assert(deuda.includes("CSP_STRICT_STYLES"), "CSP_DEUDA_P2.md documenta flag CSP_STRICT_STYLES para SEC-003");
  }

  // 7) Invariantes de runtime cubiertas por la suite de @ruum/shared (csp.test.ts)
  assert(
    existsSync(join(repoRoot, "packages", "shared", "src", "seguridad", "csp.test.ts")),
    "existe packages/shared/src/seguridad/csp.test.ts (invariantes de runtime en CI)",
  );

  if (falhas > 0) {
    console.error(`\n❌ [assert-csp:${app}] ${falhas} aserción(es) fallaron — bloqueando build. Revisa SEC-002.`);
    process.exit(1);
  }
  console.log(`\n✅ [assert-csp:${app}] Todas las aserciones CSP pasaron.`);
}

// CLI: node scripts/assert-csp.mjs [conductor|usuario|panel]
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  runAssertCsp(process.argv[2] ?? "conductor", repoRoot);
}
