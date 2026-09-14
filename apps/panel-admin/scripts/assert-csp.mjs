#!/usr/bin/env node
// SEC-002 — wrapper: la lógica vive en scripts/assert-csp.mjs (fuente única).
import { runAssertCsp } from "../../../scripts/assert-csp.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

runAssertCsp("panel", join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."));
