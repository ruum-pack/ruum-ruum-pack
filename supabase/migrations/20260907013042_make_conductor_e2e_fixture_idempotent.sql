-- El fixture E2E usa un UUID estable, pero el usuario Auth puede recrearse
-- entre ejecuciones de CI. Reutilizar por auth_user_id o por id evita que una
-- corrida posterior choque con conductores_pkey.
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
  v_auth_user_id uuid;
begin
  -- Serializa ejecuciones concurrentes del mismo fixture y de la misma
  -- identidad Auth dentro de la transacción de esta función.
  perform pg_advisory_xact_lock(hashtext('e2e_conductor_fixture:' || p_conductor_id::text));
  perform pg_advisory_xact_lock(hashtext('e2e_conductor_auth:' || p_auth_user_id::text));
  perform set_config('ruum.aprobando_solicitud', 'si', true);

  select c.id, c.auth_user_id
    into v_conductor_id, v_auth_user_id
    from public.conductores c
   where c.auth_user_id = p_auth_user_id
      or c.id = p_conductor_id
   order by (c.auth_user_id = p_auth_user_id) desc,
            (c.id = p_conductor_id) desc
   limit 1;

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
  elsif v_auth_user_id is distinct from p_auth_user_id then
    -- El UUID fijo pertenece a un usuario Auth de una corrida anterior.
    -- La bandera de aprobación permite transferirlo sin abrir un bypass de
    -- producto: la función sólo es ejecutable por service_role.
    update public.conductores
       set auth_user_id = p_auth_user_id
     where id = v_conductor_id;
  end if;

  perform set_config('ruum.aprobando_solicitud', '', true);
  return v_conductor_id;
end;
$$;

revoke all on function public.preparar_conductor_e2e(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.preparar_conductor_e2e(uuid, uuid, jsonb) to service_role;
