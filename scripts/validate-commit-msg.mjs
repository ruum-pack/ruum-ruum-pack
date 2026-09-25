#!/usr/bin/env node
// P0: valida Conventional Commits (feat/fix/docs/chore/refactor/test/ci/build/perf/revert + scope opcional).
const msgPath = process.argv[2];
if (!msgPath) {
  console.error("[commit-msg] falta ruta del mensaje");
  process.exit(1);
}
import { readFileSync } from "node:fs";
const raw = readFileSync(msgPath, "utf8").replace(/^\uFEFF/, "");
const msg = raw.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? "";
const re = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?(!)?: .{8,}/;
if (!re.test(msg)) {
  console.error(`[commit-msg] mensaje inválido: "${msg}"`);
  console.error("Formato: <tipo>(<scope>): <descripción ≥8 chars> — ej: fix(ci): endurece audit a bloqueante");
  process.exit(1);
}
console.log("[commit-msg] OK");
