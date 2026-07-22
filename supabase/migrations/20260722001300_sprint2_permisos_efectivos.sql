-- Sprint 2 — Permisos efectivos y exportaciones seguras.
-- 1. Catálogo único de capacidades
-- 2. Gestión de capacidades (conceder/revocar con motivo, auditoría, anti-escalamiento)
-- 3. RLS granular reemplaza es_admin() en tablas principales
-- 4. pagos:exportar en la matriz de permisos

-- ═════════════════════════════════════════════════════════════════════════
-- 1. Agrega pagos:exportar a la matriz de admin_tiene_permiso
-- ═════════════════════════════════════════════════════════════════════════
create or replace function public.admin_tiene_permiso(p_permiso text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  with actual as (
    select a.id, a.rol_operativo from public.admins a where a.auth_user_id=auth.uid()
  ), base as (
    select id, replace(p_permiso,'.',':') permiso,
      replace(p_permiso,'.',':') = any(case rol_operativo
        when 'operador' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','incidencias:leer']
        when 'supervisor' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','conductores:validar','conductores:sancionar','incidencias:leer','disputas:leer','disputas:resolver','aprobaciones:aprobar','auditoria:leer']
        when 'finanzas' then array['dashboard:leer','viajes:leer','pagos:leer','pagos:ejecutar','pagos:exportar','tarifas:leer','tarifas:editar','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','exportaciones:crear']
        when 'compliance' then array['dashboard:leer','conductores:leer','conductores:validar','conductores:sancionar','usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar','incidencias:leer','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear']
        when 'direccion' then array['dashboard:leer','viajes:leer','viajes:gestionar','pagos:leer','pagos:ejecutar','pagos:exportar','tarifas:leer','tarifas:editar','incidencias:leer','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear','capacidades:administrar']
        else array[]::text[] end) permitido
    from actual
  )
  select coalesce((select ac.concedida from base b join public.admin_capacidades ac on ac.admin_id=b.id and ac.capacidad=b.permiso),
                  (select permitido from base), false)
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- 2. RPCs de gestión de capacidades
-- ═════════════════════════════════════════════════════════════════════════

-- Catálogo completo de capacidades conocidas (fuente única de verdad)
create or replace function public.admin_listar_capacidades_catalogo()
returns text[] language sql stable security definer set search_path=public,pg_temp as $$
  select array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar',
    'conductores:leer','conductores:validar','conductores:sancionar',
    'usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar',
    'pagos:leer','pagos:ejecutar','pagos:exportar',
    'tarifas:leer','tarifas:editar',
    'incidencias:leer','disputas:leer','disputas:resolver',
    'reclamos_seguro:leer','reclamos_seguro:gestionar',
    'aprobaciones:aprobar','auditoria:leer','exportaciones:crear',
    'capacidades:administrar']
$$;

-- Lista las capacidades efectivas de un admin (rol base + overrides)
create or replace function public.admin_listar_capacidades(p_admin_id uuid default null)
returns table(capacidad text, concedida boolean, origen text, motivo text, otorgada_por uuid, creada_en timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_admin_id uuid;
begin
  select id into strict v_admin_id from public.admins where auth_user_id=auth.uid();
  if p_admin_id is null then p_admin_id := v_admin_id; end if;
  if p_admin_id <> v_admin_id and not public.admin_tiene_permiso('capacidades:administrar') then
    raise exception using errcode='42501',message='PERMISO_INSUFICIENTE';
  end if;
  return query
    with catalogo as (
      select unnest(public.admin_listar_capacidades_catalogo()) as cap
    ), rol_base as (
      select cap, true as concedida, 'rol'::text as origen, null::text as motivo, null::uuid as otorgada_por, null::timestamptz as creada_en
      from catalogo where public.admin_tiene_permiso(cap)
    ), overrides as (
      select ac.capacidad, ac.concedida, 'override'::text as origen, ac.motivo, ac.otorgada_por, ac.creada_en
      from public.admin_capacidades ac where ac.admin_id = p_admin_id
    )
    select distinct on (capacidad) capacidad, concedida, origen, motivo, otorgada_por, creada_en
    from (select * from overrides union all select * from rol_base) sub
    order by capacidad, origen desc;
end $$;

-- Concede o deniega una capacidad a un admin (requiere capacidades:administrar)
create or replace function public.admin_conceder_capacidad(
  p_admin_id uuid, p_capacidad text, p_concedida boolean, p_motivo text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin_id uuid; v_admin_self boolean;
begin
  if not public.admin_tiene_permiso('capacidades:administrar') then
    raise exception using errcode='42501',message='PERMISO_INSUFICIENTE';
  end if;
  if p_capacidad !~ '^[a-z0-9_]+:[a-z0-9_]+$' then
    raise exception using errcode='22023',message='CAPACIDAD_FORMATO_INVALIDO';
  end if;
  if nullif(trim(p_motivo),'') is null then
    raise exception using errcode='22023',message='MOTIVO_OBLIGATORIO';
  end if;
  select id into strict v_admin_id from public.admins where auth_user_id=auth.uid();
  if not exists (select 1 from public.admins where id = p_admin_id) then
    raise exception using errcode='22023',message='ADMIN_NO_ENCONTRADO';
  end if;
  v_admin_self := (v_admin_id = p_admin_id);
  if v_admin_self and p_capacidad = 'capacidades:administrar' then
    raise exception using errcode='42501',message='NO_PUEDES_OTORGARTE_CAPACIDADES_ADMINISTRAR';
  end if;
  insert into public.admin_capacidades(admin_id,capacidad,concedida,motivo,otorgada_por)
  values(p_admin_id,p_capacidad,p_concedida,trim(p_motivo),v_admin_id)
  on conflict (admin_id, capacidad) do update set
    concedida = excluded.concedida, motivo = trim(excluded.motivo),
    otorgada_por = excluded.otorgada_por, creada_en = now();
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
  values(auth.uid(),v_admin_id,'mutacion','admin_capacidades',
    case when p_concedida then 'conceder' else 'revocar' end,
    jsonb_build_object('admin_id',p_admin_id,'capacidad',p_capacidad,'motivo',trim(p_motivo)));
end $$;

-- ═════════════════════════════════════════════════════════════════════════
-- 3. RLS granular — reemplaza es_admin() con admin_tiene_permiso()
-- ═════════════════════════════════════════════════════════════════════════

do $$ begin
  -- pagos
  drop policy if exists admin_acceso_total_pagos on public.pagos;
  create policy admin_acceso_total_pagos on public.pagos for all to authenticated
    using (public.admin_tiene_permiso('pagos:leer') or public.admin_tiene_permiso('pagos:ejecutar') or public.admin_tiene_permiso('pagos:exportar'));

  -- conductores
  drop policy if exists admin_acceso_total_conductores on public.conductores;
  create policy admin_acceso_total_conductores on public.conductores for all to authenticated
    using (public.admin_tiene_permiso('conductores:leer') or public.admin_tiene_permiso('conductores:validar') or public.admin_tiene_permiso('conductores:sancionar'));

  -- usuarios
  drop policy if exists admin_acceso_total_usuarios on public.usuarios;
  create policy admin_acceso_total_usuarios on public.usuarios for all to authenticated
    using (public.admin_tiene_permiso('usuarios:leer') or public.admin_tiene_permiso('usuarios:validar'));

  -- vehiculos
  drop policy if exists admin_acceso_total_vehiculos on public.vehiculos;
  create policy admin_acceso_total_vehiculos on public.vehiculos for all to authenticated
    using (public.admin_tiene_permiso('conductores:leer'));

  -- traslados
  drop policy if exists admin_acceso_total_traslados on public.traslados;
  create policy admin_acceso_total_traslados on public.traslados for all to authenticated
    using (public.admin_tiene_permiso('viajes:leer') or public.admin_tiene_permiso('viajes:gestionar'));

  -- empresas
  drop policy if exists admin_acceso_total_empresas on public.empresas;
  create policy admin_acceso_total_empresas on public.empresas for all to authenticated
    using (public.admin_tiene_permiso('empresas:leer') or public.admin_tiene_permiso('empresas:gestionar'));

  -- incidencias
  drop policy if exists admin_acceso_total_incidencias on public.incidencias;
  create policy admin_acceso_total_incidencias on public.incidencias for all to authenticated
    using (public.admin_tiene_permiso('incidencias:leer'));

  -- disputas
  drop policy if exists admin_acceso_total_disputas on public.disputas;
  create policy admin_acceso_total_disputas on public.disputas for all to authenticated
    using (public.admin_tiene_permiso('disputas:leer') or public.admin_tiene_permiso('disputas:resolver'));

  -- reclamos_seguro
  drop policy if exists admin_acceso_total_reclamos_seguro on public.reclamos_seguro;
  create policy admin_acceso_total_reclamos_seguro on public.reclamos_seguro for all to authenticated
    using (public.admin_tiene_permiso('reclamos_seguro:leer') or public.admin_tiene_permiso('reclamos_seguro:gestionar'));

  -- tarifas_v2 tables (tarifas_admin fue reemplazada por modelo_tarifas_v2)
  drop policy if exists admin_acceso_total_tarifas_vehiculo on public.tarifas_vehiculo;
  create policy admin_acceso_total_tarifas_vehiculo on public.tarifas_vehiculo for all to authenticated
    using (public.admin_tiene_permiso('tarifas:leer') or public.admin_tiene_permiso('tarifas:editar'))
    with check (public.admin_tiene_permiso('tarifas:editar'));

  drop policy if exists admin_acceso_total_tarifas_gama on public.tarifas_gama;
  create policy admin_acceso_total_tarifas_gama on public.tarifas_gama for all to authenticated
    using (public.admin_tiene_permiso('tarifas:leer') or public.admin_tiene_permiso('tarifas:editar'))
    with check (public.admin_tiene_permiso('tarifas:editar'));

  drop policy if exists admin_acceso_total_tarifas_condicion on public.tarifas_condicion;
  create policy admin_acceso_total_tarifas_condicion on public.tarifas_condicion for all to authenticated
    using (public.admin_tiene_permiso('tarifas:leer') or public.admin_tiene_permiso('tarifas:editar'))
    with check (public.admin_tiene_permiso('tarifas:editar'));

  drop policy if exists admin_acceso_total_tarifas_horario on public.tarifas_horario;
  create policy admin_acceso_total_tarifas_horario on public.tarifas_horario for all to authenticated
    using (public.admin_tiene_permiso('tarifas:leer') or public.admin_tiene_permiso('tarifas:editar'))
    with check (public.admin_tiene_permiso('tarifas:editar'));

  drop policy if exists admin_acceso_total_tarifas_dia on public.tarifas_dia;
  create policy admin_acceso_total_tarifas_dia on public.tarifas_dia for all to authenticated
    using (public.admin_tiene_permiso('tarifas:leer') or public.admin_tiene_permiso('tarifas:editar'))
    with check (public.admin_tiene_permiso('tarifas:editar'));

  drop policy if exists admin_acceso_total_tarifas_config on public.tarifas_config;
  create policy admin_acceso_total_tarifas_config on public.tarifas_config for all to authenticated
    using (public.admin_tiene_permiso('tarifas:leer') or public.admin_tiene_permiso('tarifas:editar'))
    with check (public.admin_tiene_permiso('tarifas:editar'));
end $$;

-- ═════════════════════════════════════════════════════════════════════════
-- 4. Grants
-- ═════════════════════════════════════════════════════════════════════════
revoke all on function public.admin_listar_capacidades_catalogo() from public;
revoke all on function public.admin_listar_capacidades(uuid) from public;
revoke all on function public.admin_conceder_capacidad(uuid,text,boolean,text) from public;
grant execute on function public.admin_listar_capacidades_catalogo() to authenticated;
grant execute on function public.admin_listar_capacidades(uuid) to authenticated;
grant execute on function public.admin_conceder_capacidad(uuid,text,boolean,text) to authenticated;
