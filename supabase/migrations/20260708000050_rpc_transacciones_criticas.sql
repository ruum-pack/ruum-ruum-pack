-- P1/P2: mueve operaciones críticas multi-paso a RPC transaccionales.

drop policy if exists "conductor_acepta_viaje_disponible" on public.traslados;

create or replace function public.admin_actual_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select a.id from public.admins a where a.auth_user_id = auth.uid() limit 1
$$;

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

create or replace function public.admin_resuelve_disputa(
  p_disputa_id uuid,
  p_estado public.estado_disputa,
  p_resolucion public.resolucion_disputa,
  p_detalle text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_disputa record;
  v_es_resuelta boolean;
begin
  v_admin_id := public.admin_actual_id();
  if v_admin_id is null then
    raise exception 'No se encontró un admin autenticado.';
  end if;

  select * into v_disputa
  from public.disputas
  where id = p_disputa_id
  for update;

  if v_disputa.id is null then
    raise exception 'No se encontró la disputa.';
  end if;

  v_es_resuelta := p_estado in ('resuelta', 'resuelta_senior');
  if v_es_resuelta and p_resolucion is null then
    raise exception 'Selecciona una resolución para cerrar la disputa.';
  end if;

  update public.disputas
    set estado = p_estado,
        resolucion = case when v_es_resuelta then p_resolucion else null end,
        resolucion_detalle = nullif(btrim(coalesce(p_detalle, '')), ''),
        resuelta_en = case when v_es_resuelta then now() else null end
  where id = p_disputa_id;

  if v_es_resuelta then
    update public.traslados
      set estado = 'disputa_resuelta'
    where id = v_disputa.traslado_id
      and estado = 'disputa_abierta';
  end if;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    v_disputa.traslado_id,
    'resolucion_disputa',
    'admin',
    v_admin_id,
    jsonb_build_object(
      'disputa_id', p_disputa_id,
      'estado', p_estado,
      'resolucion', p_resolucion,
      'detalle', nullif(btrim(coalesce(p_detalle, '')), '')
    )
  );
end;
$$;

create or replace function public.admin_actualiza_reclamo_seguro(
  p_reclamo_id uuid,
  p_estado public.estado_reclamo_seguro,
  p_responsable_pago text,
  p_notas_admin text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_reclamo record;
begin
  v_admin_id := public.admin_actual_id();
  if v_admin_id is null then
    raise exception 'No se encontró un admin autenticado.';
  end if;

  if p_responsable_pago is not null and p_responsable_pago not in ('aplicacion', 'conductor') then
    raise exception 'Responsable de pago inválido.';
  end if;

  if p_estado = 'resuelto' and p_responsable_pago is null then
    raise exception 'Selecciona responsable de pago antes de resolver el reclamo.';
  end if;

  select * into v_reclamo
  from public.reclamos_seguro
  where id = p_reclamo_id
  for update;

  if v_reclamo.id is null then
    raise exception 'No se encontró el reclamo.';
  end if;

  update public.reclamos_seguro
    set estado = p_estado,
        responsable_pago = p_responsable_pago,
        notas_admin = nullif(btrim(coalesce(p_notas_admin, '')), ''),
        resuelto_en = case when p_estado = 'resuelto' then now() else null end
  where id = p_reclamo_id;

  if p_estado = 'resuelto' then
    update public.traslados
      set estado = 'reclamo_resuelto'
    where id = v_reclamo.traslado_id
      and estado = 'reclamo_abierto';
  end if;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    v_reclamo.traslado_id,
    case when p_estado = 'resuelto' then 'resolucion_reclamo_seguro' else 'apertura_reclamo_seguro' end,
    'admin',
    v_admin_id,
    jsonb_build_object(
      'reclamo_id', p_reclamo_id,
      'estado', p_estado,
      'responsable_pago', p_responsable_pago,
      'notas', nullif(btrim(coalesce(p_notas_admin, '')), '')
    )
  );
end;
$$;

create or replace function public.admin_asigna_conductor(
  p_traslado_id uuid,
  p_conductor_id uuid
)
returns public.estado_traslado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_estado public.estado_traslado;
  v_estado_anterior public.estado_traslado;
  v_cadena public.estado_traslado[] := array[
    'solicitud_creada',
    'documentacion_pendiente',
    'documentacion_en_revision',
    'documentacion_validada',
    'cotizacion_generada',
    'servicio_confirmado',
    'pendiente_de_conductor',
    'conductor_asignado'
  ]::public.estado_traslado[];
  v_indice int;
  i int;
begin
  v_admin_id := public.admin_actual_id();
  if v_admin_id is null then
    raise exception 'No se encontró un admin autenticado.';
  end if;

  if not exists (select 1 from public.conductores where id = p_conductor_id) then
    raise exception 'No se encontró el conductor.';
  end if;

  select estado into v_estado
  from public.traslados
  where id = p_traslado_id
  for update;

  if v_estado is null then
    raise exception 'No se encontró el traslado.';
  end if;

  v_estado_anterior := v_estado;

  if v_estado = 'conductor_asignado' then
    update public.traslados set conductor_id = p_conductor_id where id = p_traslado_id;
  else
    select idx into v_indice
    from generate_subscripts(v_cadena, 1) as idx
    where v_cadena[idx] = v_estado;

    if v_indice is null then
      raise exception 'No se puede asignar conductor desde el estado %.', v_estado;
    end if;

    for i in v_indice..array_length(v_cadena, 1) - 1 loop
      update public.traslados
        set estado = v_cadena[i + 1],
            conductor_id = case when i = v_indice then p_conductor_id else conductor_id end
      where id = p_traslado_id;
    end loop;
  end if;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    p_traslado_id,
    'asignacion_conductor',
    'admin',
    v_admin_id,
    jsonb_build_object(
      'conductor_id', p_conductor_id,
      'estado_anterior', v_estado_anterior,
      'estado_nuevo', 'conductor_asignado'
    )
  );

  return 'conductor_asignado';
end;
$$;

create or replace function public.admin_marca_traslado_fallido(
  p_traslado_id uuid,
  p_causa public.causa_fallido,
  p_cargo_aplica_cliente boolean,
  p_requiere_reagendamiento boolean,
  p_porcentaje_descuento_segundo_intento numeric,
  p_mensaje text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_traslado record;
begin
  v_admin_id := public.admin_actual_id();
  if v_admin_id is null then
    raise exception 'No se encontró un admin autenticado.';
  end if;

  select id, estado, precio_cotizado, precio_final
    into v_traslado
  from public.traslados
  where id = p_traslado_id
  for update;

  if v_traslado.id is null then
    raise exception 'No se encontró el traslado.';
  end if;

  update public.traslados
    set estado = 'traslado_fallido',
        causa_fallido = p_causa
  where id = p_traslado_id
    and estado = v_traslado.estado;

  if p_cargo_aplica_cliente then
    insert into public.pagos (traslado_id, monto, momento, estado, metodo)
    values (
      p_traslado_id,
      coalesce(v_traslado.precio_final, v_traslado.precio_cotizado, 0),
      'al_cierre',
      'pendiente',
      'cargo_traslado_fallido'
    );
  end if;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    p_traslado_id,
    'modificacion_traslado_activo',
    'admin',
    v_admin_id,
    jsonb_build_object(
      'tipo', 'traslado_fallido',
      'causa', p_causa,
      'estado_anterior', v_traslado.estado,
      'estado_nuevo', 'traslado_fallido',
      'cargo_aplica_cliente', p_cargo_aplica_cliente,
      'requiere_reagendamiento', p_requiere_reagendamiento,
      'porcentaje_descuento_segundo_intento', p_porcentaje_descuento_segundo_intento,
      'mensaje', p_mensaje
    )
  );
end;
$$;

revoke all on function public.admin_actual_id() from public;
revoke all on function public.conductor_acepta_viaje(uuid) from public;
revoke all on function public.admin_resuelve_disputa(uuid, public.estado_disputa, public.resolucion_disputa, text) from public;
revoke all on function public.admin_actualiza_reclamo_seguro(uuid, public.estado_reclamo_seguro, text, text) from public;
revoke all on function public.admin_asigna_conductor(uuid, uuid) from public;
revoke all on function public.admin_marca_traslado_fallido(uuid, public.causa_fallido, boolean, boolean, numeric, text) from public;

grant execute on function public.conductor_acepta_viaje(uuid) to authenticated;
grant execute on function public.admin_resuelve_disputa(uuid, public.estado_disputa, public.resolucion_disputa, text) to authenticated;
grant execute on function public.admin_actualiza_reclamo_seguro(uuid, public.estado_reclamo_seguro, text, text) to authenticated;
grant execute on function public.admin_asigna_conductor(uuid, uuid) to authenticated;
grant execute on function public.admin_marca_traslado_fallido(uuid, public.causa_fallido, boolean, boolean, numeric, text) to authenticated;
