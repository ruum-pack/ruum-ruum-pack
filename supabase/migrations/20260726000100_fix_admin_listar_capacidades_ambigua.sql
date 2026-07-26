-- Corrige ambigüedad entre columnas de retorno y columnas internas del RPC.
create or replace function public.admin_listar_capacidades(p_admin_id uuid default null)
returns table(capacidad text, concedida boolean, origen text, motivo text, otorgada_por uuid, creada_en timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_admin_id uuid;
  v_rol_objetivo public.rol_admin_operativo;
begin
  select a.id into strict v_admin_id from public.admins a where a.auth_user_id = auth.uid();

  if p_admin_id is null then
    p_admin_id := v_admin_id;
  end if;

  if p_admin_id <> v_admin_id and not public.admin_tiene_permiso('capacidades:administrar') then
    raise exception using errcode = '42501', message = 'PERMISO_INSUFICIENTE';
  end if;

  select a.rol_operativo into strict v_rol_objetivo from public.admins a where a.id = p_admin_id;

  return query
    with catalogo as (
      select unnest(public.admin_listar_capacidades_catalogo()) as cap
    ), rol_base as (
      select
        c.cap as capacidad,
        true as concedida,
        'rol'::text as origen,
        null::text as motivo,
        null::uuid as otorgada_por,
        null::timestamptz as creada_en
      from catalogo c
      where v_rol_objetivo = 'direccion'
        or c.cap = any(case v_rol_objetivo
          when 'operador' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','incidencias:leer']
          when 'supervisor' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','conductores:validar','conductores:sancionar','incidencias:leer','disputas:leer','disputas:resolver','aprobaciones:aprobar','auditoria:leer']
          when 'finanzas' then array['dashboard:leer','viajes:leer','pagos:leer','pagos:ejecutar','pagos:exportar','tarifas:leer','tarifas:editar','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','exportaciones:crear']
          when 'compliance' then array['dashboard:leer','conductores:leer','conductores:validar','conductores:sancionar','usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar','incidencias:leer','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear']
          else array[]::text[]
        end)
    ), overrides as (
      select
        ac.capacidad,
        ac.concedida,
        'override'::text as origen,
        ac.motivo,
        ac.otorgada_por,
        ac.creada_en
      from public.admin_capacidades ac
      where ac.admin_id = p_admin_id and v_rol_objetivo <> 'direccion'
    ), efectivas as (
      select o.capacidad, o.concedida, o.origen, o.motivo, o.otorgada_por, o.creada_en from overrides o
      union all
      select rb.capacidad, rb.concedida, rb.origen, rb.motivo, rb.otorgada_por, rb.creada_en from rol_base rb
    )
    select distinct on (e.capacidad)
      e.capacidad,
      e.concedida,
      e.origen,
      e.motivo,
      e.otorgada_por,
      e.creada_en
    from efectivas e
    order by e.capacidad, e.origen desc;
end $$;

revoke all on function public.admin_listar_capacidades(uuid) from public;
grant execute on function public.admin_listar_capacidades(uuid) to authenticated;
