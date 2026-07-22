-- Dirección es el único rol superadministrador del panel.
-- Sus capacidades base no pueden quedar bloqueadas por overrides individuales.

create or replace function public.admin_tiene_permiso(p_permiso text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  with actual as (
    select a.id, a.rol_operativo from public.admins a where a.auth_user_id=auth.uid()
  ), base as (
    select id, rol_operativo, replace(p_permiso,'.',':') permiso,
      replace(p_permiso,'.',':') = any(case rol_operativo
        when 'operador' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','incidencias:leer']
        when 'supervisor' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','conductores:validar','conductores:sancionar','incidencias:leer','disputas:leer','disputas:resolver','aprobaciones:aprobar','auditoria:leer']
        when 'finanzas' then array['dashboard:leer','viajes:leer','pagos:leer','pagos:ejecutar','pagos:exportar','tarifas:leer','tarifas:editar','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','exportaciones:crear']
        when 'compliance' then array['dashboard:leer','conductores:leer','conductores:validar','conductores:sancionar','usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar','incidencias:leer','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear']
        else array[]::text[] end) permitido
    from actual
  )
  select case
    when exists (select 1 from actual where rol_operativo = 'direccion') then true
    else coalesce((select ac.concedida from base b join public.admin_capacidades ac on ac.admin_id=b.id and ac.capacidad=b.permiso),
                  (select permitido from base), false)
  end
$$;

create or replace function public.admin_listar_capacidades(p_admin_id uuid default null)
returns table(capacidad text, concedida boolean, origen text, motivo text, otorgada_por uuid, creada_en timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_admin_id uuid;
  v_rol_objetivo public.rol_admin_operativo;
begin
  select id into strict v_admin_id from public.admins where auth_user_id=auth.uid();
  if p_admin_id is null then p_admin_id := v_admin_id; end if;
  if p_admin_id <> v_admin_id and not public.admin_tiene_permiso('capacidades:administrar') then
    raise exception using errcode='42501',message='PERMISO_INSUFICIENTE';
  end if;
  select rol_operativo into strict v_rol_objetivo from public.admins where id = p_admin_id;

  return query
    with catalogo as (
      select unnest(public.admin_listar_capacidades_catalogo()) as cap
    ), rol_base as (
      select cap, true as concedida, 'rol'::text as origen, null::text as motivo,
        null::uuid as otorgada_por, null::timestamptz as creada_en
      from catalogo
      where v_rol_objetivo = 'direccion'
        or cap = any(case v_rol_objetivo
          when 'operador' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','incidencias:leer']
          when 'supervisor' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','conductores:validar','conductores:sancionar','incidencias:leer','disputas:leer','disputas:resolver','aprobaciones:aprobar','auditoria:leer']
          when 'finanzas' then array['dashboard:leer','viajes:leer','pagos:leer','pagos:ejecutar','pagos:exportar','tarifas:leer','tarifas:editar','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','exportaciones:crear']
          when 'compliance' then array['dashboard:leer','conductores:leer','conductores:validar','conductores:sancionar','usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar','incidencias:leer','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear']
          else array[]::text[] end)
    ), overrides as (
      select ac.capacidad, ac.concedida, 'override'::text as origen, ac.motivo, ac.otorgada_por, ac.creada_en
      from public.admin_capacidades ac
      where ac.admin_id = p_admin_id and v_rol_objetivo <> 'direccion'
    )
    select distinct on (capacidad) capacidad, concedida, origen, motivo, otorgada_por, creada_en
    from (select * from overrides union all select * from rol_base) sub
    order by capacidad, origen desc;
end $$;