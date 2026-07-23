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

test("payload modificado durante exportación es detectado por hash SHA-256", () => {
  const route = read("apps/panel-admin/src/app/api/exportaciones/pagos/route.ts");
  assert.match(route, /sha256/);
  assert.match(route, /x-content-sha256/);
  assert.match(route, /p_hash/);
});

test("aprobación reutilizada: versión esperada previene doble ejecución", () => {
  const migracion = read("supabase/migrations/20260720001200_sprint1_bypass_cerrar.sql");
  assert.match(migracion, /APROBACION_PAYLOAD_NO_COINCIDE/);
  assert.match(migracion, /p_version_esperada/);
  assert.match(migracion, /version/);
  const servicio = read("packages/api/src/services/aprobaciones-admin.ts");
  assert.match(servicio, /admin_decidir_aprobacion/);
  assert.match(servicio, /p_version_esperada/);
});

test("fallo de auditoría durante exportación no entrega CSV", () => {
  const route = read("apps/panel-admin/src/app/api/exportaciones/pagos/route.ts");
  assert.match(route, /export_audit_failed/);
  assert.match(route, /no se entrega CSV/);
  assert.match(route, /admin_completar_exportacion/);
  assert.match(route, /status: ?500/);
});

test("invitaciones y revocacion Auth usan backend privilegiado", () => {
  const serviceRole = read("apps/panel-admin/src/lib/supabase-service-role.ts");
  const invitarUsuario = read("apps/panel-admin/src/app/api/admin-auth/invitar-usuario/route.ts");
  const invitarConductor = read("apps/panel-admin/src/app/api/admin-auth/invitar-conductor/route.ts");
  const acceso = read("apps/panel-admin/src/app/api/admin-auth/estado-acceso/route.ts");
  const adminService = read("packages/api/src/services/admin.ts");

  assert.match(serviceRole, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(invitarUsuario, /auth\.admin\.inviteUserByEmail/);
  assert.match(invitarConductor, /auth\.admin\.inviteUserByEmail/);
  assert.match(acceso, /auth\.admin\.updateUserById/);
  assert.match(acceso, /ban_duration/);
  assert.match(adminService, /\/api\/admin-auth\/invitar-usuario/);
  assert.match(adminService, /\/api\/admin-auth\/estado-acceso/);
  assert.doesNotMatch(adminService, /admin_invitar_usuario/);
  assert.doesNotMatch(adminService, /revocarAccesoAuthConductor/);
});

test("alta de conductor no acepta UUID Auth manual", () => {
  const page = read("apps/panel-admin/src/app/conductores/activos/nuevo/page.tsx");
  const service = read("packages/api/src/services/admin.ts");
  assert.match(page, /Correo de invitación/);
  assert.match(page, /Invitar y crear conductor/);
  assert.doesNotMatch(page, /auth_user_id \(UUID\)|00000000-0000-0000-0000-000000000000/);
  assert.match(service, /correo: string/);
  assert.doesNotMatch(service, /ConductorCrearAdmin = \{\s*auth_user_id/s);
});
