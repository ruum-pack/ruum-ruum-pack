-- Fix E2E — `tests/global-setup.ts` de app-conductor intentaba "limpiar" el
-- estado previo borrando filas de `historial_estados_solicitud_conductor`
-- (bloqueado a propósito por `bloquear_mutacion_historial_solicitud`, ver
-- 20260710000111) y luego intentaba levantar la bandera de sesión
-- `ruum.aprobando_solicitud` con una llamada RPC separada antes de hacer un
-- upsert en `conductores` desde otra request HTTP distinta. Cada llamada a
-- PostgREST abre su propia conexión/transacción, así que `set_config(...,
-- is_local => true)` de una llamada nunca sobrevive a la siguiente: el
-- trigger `validar_auth_conductor_sin_solicitud` volvía a ver la solicitud
-- huérfana (que nunca se pudo borrar) y abortaba con
-- `conductor_duplicado:auth`.
--
-- Esta función agrupa todo el flujo en una sola transacción (igual que ya
-- hace `aprobar_solicitud_conductor_admin`), para que el `set_config` local
-- sí aplique durante el insert/update de `conductores`. No se toca
-- `historial_estados_solicitud_conductor` en ningún momento: el historial de
-- decisiones sigue siendo inmutable, tal como exige el diseño de auditoría.
--
-- Solo puede ejecutarla `service_role`, y solo actúa sobre el auth_user_id y
-- conductor_id fijos que le pase el caller — pensada exclusivamente para
-- inicializar fixtures de Playwright/E2E, nunca para flujos de producto.
create or replace function public.preparar_conductor_e2e(
  p_auth_user_id uuid,
  p_conductor_id uuid,
  p_datos jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conductor_id uuid;
begin
  perform set_config('ruum.aprobando_solicitud', 'si', true);

  select id into v_conductor_id
    from public.conductores
    where auth_user_id = p_auth_user_id;

  if v_conductor_id is null then
    insert into public.conductores (
      id, auth_user_id, nombre, telefono, curp,
      licencia_numero, licencia_tipo, licencia_vigencia
    ) values (
      p_conductor_id, p_auth_user_id,
      coalesce(p_datos->>'nombre', 'Conductor E2E Ruum'),
      p_datos->>'telefono', p_datos->>'curp',
      p_datos->>'licencia_numero', p_datos->>'licencia_tipo',
      (p_datos->>'licencia_vigencia')::date
    )
    returning id into v_conductor_id;
  end if;

  perform set_config('ruum.aprobando_solicitud', '', true);

  return v_conductor_id;
end;
$$;

revoke all on function public.preparar_conductor_e2e(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.preparar_conductor_e2e(uuid, uuid, jsonb) to service_role;

comment on function public.preparar_conductor_e2e(uuid, uuid, jsonb) is
  'Uso exclusivo de fixtures E2E (Playwright, service_role): crea el conductor fixture dentro de la misma transacción que la bandera ruum.aprobando_solicitud, sin tocar el historial inmutable de solicitudes_conductor.';