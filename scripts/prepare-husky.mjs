#!/usr/bin/env node
// Prepara hooks husky sin depender de binario husky instalado
import { mkdirSync, copyFileSync, chmodSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const huskyDir = join(root, ".husky");
const gitHooksDir = join(root, ".git", "hooks");

mkdirSync(huskyDir, { recursive: true });
mkdirSync(join(huskyDir, "_"), { recursive: true });
if (!existsSync(join(huskyDir, "_", "husky.sh"))) {
  writeFileSync(join(huskyDir, "_", "husky.sh"), `#!/usr/bin/env sh\nif [ -f "$(dirname "$0")/../../node_modules/husky/lib/husky.sh" ]; then\n  . "$(dirname "$0")/../../node_modules/husky/lib/husky.sh"\nfi\n`);
}

mkdirSync(gitHooksDir, { recursive: true });
const preCommitSrc = join(huskyDir, "pre-commit");
const preCommitDest = join(gitHooksDir, "pre-commit");
try {
  copyFileSync(preCommitSrc, preCommitDest);
  chmodSync(preCommitDest, 0o755);
  console.log("✅ Husky hook instalado en .git/hooks/pre-commit");
} catch (e) {
  console.error("⚠️ No se pudo instalar hook:", e.message);
  process.exit(1);
}
