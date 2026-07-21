import { existsSync, readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (pkg.packageManager !== "pnpm@10.0.0") throw new Error("packageManager debe fijar pnpm@10.0.0");
if (!existsSync("pnpm-lock.yaml")) throw new Error("Falta pnpm-lock.yaml");
if (!pkg.engines?.node?.includes("24")) throw new Error("Node 24 debe estar fijado para CI");
const lock = readFileSync("pnpm-lock.yaml", "utf8");
if (!lock.includes("lockfileVersion")) throw new Error("Lockfile inválido");
console.log("Contrato de instalación limpia validado.");
