import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/shared",
  "packages/api",
  "apps/app-conductor",
  "apps/app-usuario"
]);
