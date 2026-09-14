import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/shared",
  "packages/api",
  "packages/ui",
  "apps/app-conductor",
  "apps/app-usuario",
  "apps/panel-admin"
]);
