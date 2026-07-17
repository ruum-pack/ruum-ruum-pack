-- Un conductor no aprobado no debe ver oportunidades ni aceptarlas por llamada
-- directa a la API. La UI ya muestra el estado de revisión, pero la fuente de
-- verdad debe estar en RLS/RPC.

create or replace function public.conductor_operativamente_aprobado(p_auth_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.conductores c
    where c.auth_user_id = p_auth_user_id
      and c.estado_expediente = 'aprobado'
      and c.estado in ('activo', 'modo_prueba_supervisada')
      and c.documentos_vigentes
      and coalesce(c.suspensiones_activas, 0) = 0
      and coalesce(c.incidencias_graves_6m, 0) = 0
  )
$$;

revoke all on function public.conductor_operativamente_aprobado(uuid) from public;
grant execute on function public.conductor_operativamente_aprobado(uuid) to authenticated;

drop policy if exists "conductor_ve_viajes_disponibles" on public.traslados;
create policy "conductor_ve_viajes_disponibles"
  on public.traslados for select
  using (
    estado = 'pendiente_de_conductor'
    and conductor_id is null
    and public.conductor_operativamente_aprobado()
  );

drop policy if exists "conductor_ve_vehiculos_de_traslados_relevantes" on public.vehiculos;
create policy "conductor_ve_vehiculos_de_traslados_relevantes"
  on public.vehiculos for select
  using (
    exists (select 1 from public.conductores c where c.auth_user_id = auth.uid())
    and id in (
      select t.vehiculo_id
      from public.traslados t
      where (
        t.estado = 'pendiente_de_conductor'
        and t.conductor_id is null
        and public.conductor_operativamente_aprobado()
      )
      or t.conductor_id in (
        select c.id from public.conductores c where c.auth_user_id = auth.uid()
      )
    )
  );

create or replace function public.conductor_acepta_viaje(p_traslado_id uuid)
returns public.estado_traslado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conductor record;
  v_traslado record;
  v_tipo_ruta text;
  v_nivel_orden int;
  v_nivel_requerido int;
begin
  select *
    into v_conductor
  from public.conductores
  where auth_user_id = auth.uid()
    and estado_expediente = 'aprobado'
    and estado in ('activo', 'modo_prueba_supervisada')
    and documentos_vigentes
    and coalesce(suspensiones_activas, 0) = 0
    and coalesce(incidencias_graves_6m, 0) = 0
  limit 1;

  if v_conductor.id is null then
    raise exception 'Conductor no elegible para aceptar viajes.';
  end if;

  select t.id, t.estado, t.conductor_id, t.tipo_ruta, v.tipo as vehiculo_tipo
    into v_traslado
  from public.traslados t
  join public.vehiculos v on v.id = t.vehiculo_id
  where t.id = p_traslado_id
  for update of t;

  if v_traslado.id is null then
    raise exception 'Traslado no encontrado.';
  end if;

  if v_traslado.estado <> 'pendiente_de_conductor' or v_traslado.conductor_id is not null then
    raise exception 'El viaje ya no está disponible para aceptación.';
  end if;

  v_tipo_ruta := case v_traslado.tipo_ruta
    when 'foraneo' then 'interurbana_mas_100km'
    else 'intraurbana'
  end;

  v_nivel_orden := case v_conductor.nivel_operativo_vigente
    when 'basico' then 1
    when 'ejecutivo' then 2
    when 'luxury' then 3
    when 'coleccion' then 4
    else 0
  end;

  v_nivel_requerido := case
    when v_traslado.vehiculo_tipo = 'coleccion' then 4
    when v_traslado.vehiculo_tipo = 'luxury' then 3
    when v_tipo_ruta = 'interurbana_mas_100km' then 2
    else 1
  end;

  if v_nivel_orden < v_nivel_requerido then
    raise exception 'El nivel operativo del conductor no cubre este viaje.';
  end if;

  update public.traslados
    set estado = 'conductor_asignado',
        conductor_id = v_conductor.id
  where id = p_traslado_id
    and estado = 'pendiente_de_conductor'
    and conductor_id is null;

  if not found then
    raise exception 'El viaje ya no está disponible para aceptación.';
  end if;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    p_traslado_id,
    'aceptacion_traslado_conductor',
    'conductor',
    v_conductor.id,
    jsonb_build_object('estado_nuevo', 'conductor_asignado')
  );

  return 'conductor_asignado';
end;
$$;

revoke all on function public.conductor_acepta_viaje(uuid) from public;
grant execute on function public.conductor_acepta_viaje(uuid) to authenticated;
