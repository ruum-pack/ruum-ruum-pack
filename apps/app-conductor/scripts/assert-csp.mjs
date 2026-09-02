#!/usr/bin/env node
// SEC-002 — Aserción de CSP en build (bloqueante)
// Verifica que next.config y middleware están alineados y sin regresiones P2
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
let falhas = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ [assert-csp] ${msg}`);
    falhas++;
  } else {
    console.log(`✅ [assert-csp] ${msg}`);
  }
}

const nextConfig = readFileSync(join(root, "next.config.ts"), "utf-8");
const middleware = readFileSync(join(root, "src/middleware.ts"), "utf-8");
const deuda = existsSync(join(root, "CSP_DEUDA_P2.md")) ? readFileSync(join(root, "CSP_DEUDA_P2.md"), "utf-8") : "";

// 1) next.config cspProd NO debe contener unsafe-eval (P2) — solo cspDev puede tenerlo para HMR
const cspProdBlock = (nextConfig.match(/const cspProd[\s\S]*?\.join\("; "\)/) ?? [""])[0];
assert(!cspProdBlock.includes("'unsafe-eval'"), "next.config cspProd sin 'unsafe-eval' (solo cspDev lo usa para HMR)");

// 2) next.config cspProd script-src debe usar strict-dynamic y NO unsafe-inline
const cspProdMatch = nextConfig.match(/const cspProd[\s\S]*?\.join/);
if (cspProdMatch) {
  const cspProd = cspProdMatch[0];
  assert(cspProd.includes("'strict-dynamic'"), "next.config cspProd script-src usa 'strict-dynamic'");
  // Permitir unsafe-inline solo en style-src (deuda), no en script-src
  const scriptSrc = cspProd.match(/script-src[^"]*"/)?.[0] ?? cspProd;
  assert(!scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes("style-src"), "next.config cspProd script-src sin 'unsafe-inline' (solo style-src lo mantiene como fallback)");
  assert(!scriptSrc.includes("'unsafe-eval'"), "next.config cspProd script-src sin 'unsafe-eval'");
} else {
  console.error("❌ [assert-csp] No se encontró cspProd en next.config.ts");
  falhas++;
}

// 3) middleware debe generar nonce + strict-dynamic en prod
assert(middleware.includes("'nonce-${nonce}'") && middleware.includes("'strict-dynamic'"), "middleware genera nonce + strict-dynamic en prod");

// 4) middleware rama prod no debe contener unsafe-eval (dev sí puede)
const prodBranchMatch = middleware.match(/const scriptSrc[\s\S]*?;/);
if (prodBranchMatch) {
  const prodLine = prodBranchMatch[0].split("\n").find(l => l.includes("isProd") && l.includes("script-src")) ?? prodBranchMatch[0];
  // La línea isProd ? 'nonce...strict-dynamic' : 'unsafe-inline unsafe-eval' — la rama prod es la primera
  const isProdPart = prodBranchMatch[0].split("?")[1]?.split(":")[0] ?? "";
  assert(!isProdPart.includes("'unsafe-eval'"), "middleware prod (isProd ? ...) sin unsafe-eval");
}

// 5) CSP_DEUDA_P2.md debe existir y documentar style-src deuda + flag SEC-003
assert(deuda.includes("style-src") && deuda.includes("2026-11-01"), "CSP_DEUDA_P2.md documenta deuda style-src con fecha objetivo");
assert(deuda.includes("CSP_STRICT_STYLES"), "CSP_DEUDA_P2.md documenta flag CSP_STRICT_STYLES para SEC-003");

// 5b) Si CSP_STRICT_STYLES=true, verificar que next.config y middleware soportan modo estricto (sin unsafe-inline en runtime)
const strictEnv = process.env.CSP_STRICT_STYLES === "true" || process.env.NEXT_PUBLIC_CSP_STRICT_STYLES === "true";
if (strictEnv) {
  assert(nextConfig.includes("CSP_STRICT_STYLES") && nextConfig.includes('style-src \'self\''), "CSP_STRICT_STYLES=true: next.config soporta style-src estricto");
  assert(middleware.includes("CSP_STRICT_STYLES") && middleware.includes("style-src 'self' 'nonce-"), "CSP_STRICT_STYLES=true: middleware soporta style-src estricto");
}

// 6) Verificar que next.config cspProd no tenga 'unsafe-inline' en script-src
const cspProdFull = nextConfig.match(/const cspProd[\s\S]*?\.join\("; "\)/)?.[0] ?? "";
if (cspProdFull.includes("script-src")) {
  // Extraer solo la línea de script-src dentro de cspProd
  const scriptSrcLine = cspProdFull.match(/script-src[^,]*,/)?.[0] ?? "";
  assert(!scriptSrcLine.includes("'unsafe-inline'"), "cspProd sin unsafe-inline en script-src (solo permitido en style-src como fallback)");
}

if (falhas > 0) {
  console.error(`\n❌ [assert-csp] ${falhas} aserción(es) fallaron — bloqueando build. Revisa SEC-002.`);
  process.exit(1);
}
console.log("\n✅ [assert-csp] Todas las aserciones CSP pasaron.");
