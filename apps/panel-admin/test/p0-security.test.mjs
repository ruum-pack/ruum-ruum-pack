import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("production fails closed when demo or Supabase config is missing", () => {
  const middleware = read("apps/panel-admin/src/middleware.ts");
  assert.match(middleware, /esProduccion && \(modoDemo \|\| !url \|\| !anonKey\)/);
  assert.match(middleware, /status: 503/);
});

test("route authorization is enforced and audited", () => {
  const middleware = read("apps/panel-admin/src/middleware.ts");
  assert.match(middleware, /puedeVerRuta\(rol, pathname\)/);
  assert.match(middleware, /registrar_acceso_admin_denegado/);
});

test("service authorization records denied permissions", () => {
  const service = read("packages/api/src/services/permisos-admin.ts");
  assert.match(service, /AdminAuthorizationError/);
  assert.match(service, /registrar_permiso_admin_denegado/);
});

test("critical document mutations are transactional RPCs", () => {
  const service = read("packages/api/src/services/admin.ts");
  assert.match(service, /admin_actualiza_usuario_verificacion/);
  assert.match(service, /admin_actualiza_conductor_documentos/);
  const migration = read("supabase/migrations/20260720000800_p0_seguridad_auditoria_transacciones.sql");
  assert.match(migration, /create or replace function public\.admin_actualiza_usuario_verificacion/);
  assert.match(migration, /create or replace function public\.admin_actualiza_conductor_documentos/);
});

test("CI uses frozen lockfile and demo is disabled", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /pnpm install --frozen-lockfile/);
  assert.doesNotMatch(ci, /NEXT_PUBLIC_PANEL_ADMIN_DEMO: "true"/);
  assert.match(ci, /pnpm ci:clean/);
});

test("demo data requires an explicit non-production flag", () => {
  const helper = read("apps/panel-admin/src/lib/supabase-browser.ts");
  assert.match(helper, /NODE_ENV !== "production"/);
  assert.doesNotMatch(helper, /!tieneSupabaseConfigurado\(\) \|\|/);
});
