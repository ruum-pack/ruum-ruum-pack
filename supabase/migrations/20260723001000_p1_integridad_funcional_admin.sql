-- P1 integridad funcional: mutaciones atómicas, permisos de vehículos,
-- paginación de solicitudes y finanzas operativas por traslado.

create or replace function public.admin_tiene_permiso(p_permiso text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  with actual as (
    select a.id, a.rol_operativo from public.admins a where a.auth_user_id=auth.uid()
  ), base as (
    select id, replace(p_permiso,'.',':') permiso,
      replace(p_permiso,'.',':') = any(case rol_operativo
        when 'operador' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','vehiculos:leer','incidencias:leer']
        when 'supervisor' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','conductores:validar','conductores:sancionar','vehiculos:leer','vehiculos:gestionar','incidencias:leer','disputas:leer','disputas:resolver','aprobaciones:aprobar','auditoria:leer','configuracion:leer']
        when 'finanzas' then array['dashboard:leer','viajes:leer','pagos:leer','pagos:ejecutar','pagos:exportar','tarifas:leer','tarifas:editar','vehiculos:leer','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','exportaciones:crear','configuracion:leer']
        when 'compliance' then array['dashboard:leer','conductores:leer','conductores:validar','conductores:sancionar','usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar','vehiculos:leer','vehiculos:gestionar','incidencias:leer','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear','configuracion:leer']
        when 'direccion' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','conductores:validar','conductores:sancionar','usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar','vehiculos:leer','vehiculos:gestionar','pagos:leer','pagos:ejecutar','pagos:exportar','tarifas:leer','tarifas:editar','incidencias:leer','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear','capacidades:administrar','configuracion:leer','configuracion:editar']
        else array[]::text[] end) permitido
    from actual
  )
  select coalesce((select ac.concedida from base b join public.admin_capacidades ac on ac.admin_id=b.id and ac.capacidad=b.permiso),
                  (select permitido from base), false)
$$;

create or replace function public.admin_listar_capacidades_catalogo()
returns text[] language sql stable security definer set search_path=public,pg_temp as $$
  select array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar',
    'conductores:leer','conductores:validar','conductores:sancionar',
    'usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar',
    'vehiculos:leer','vehiculos:gestionar',
    'pagos:leer','pagos:ejecutar','pagos:exportar',
    'tarifas:leer','tarifas:editar',
    'incidencias:leer','disputas:leer','disputas:resolver',
    'reclamos_seguro:leer','reclamos_seguro:gestionar',
    'aprobaciones:aprobar','auditoria:leer','exportaciones:crear',
    'capacidades:administrar','configuracion:leer','configuracion:editar']
$$;

drop policy if exists admin_acceso_total_vehiculos on public.vehiculos;
create policy admin_acceso_total_vehiculos on public.vehiculos for all to authenticated
  using (public.admin_tiene_permiso('vehiculos:leer') or public.admin_tiene_permiso('vehiculos:gestionar'))
  with check (public.admin_tiene_permiso('vehiculos:gestionar'));

alter type public.evento_auditable add value if not exists 'actualizacion_usuario';
alter type public.evento_auditable add value if not exists 'actualizacion_conductor';
alter type public.evento_auditable add value if not exists 'accion_masiva_admin';

create table if not exists public.gastos_traslado (
  id uuid primary key default gen_random_uuid(),
  traslado_id uuid not null references public.traslados(id) on delete cascade,
  tipo text not null check (tipo in ('combustible','caseta','maniobra','estadia','penalizacion','otro')),
  monto numeric(10,2) not null check (monto >= 0),
  descripcion text,
  registrado_por uuid references public.admins(id),
  registrado_en timestamptz not null default now()
);
create index if not exists gastos_traslado_traslado_idx on public.gastos_traslado(traslado_id, registrado_en desc);
alter table public.gastos_traslado enable row level security;
drop policy if exists admin_acceso_total_gastos_traslado on public.gastos_traslado;
create policy admin_acceso_total_gastos_traslado on public.gastos_traslado for all to authenticated
  using (public.admin_tiene_permiso('pagos:leer') or public.admin_tiene_permiso('viajes:gestionar'))
  with check (public.admin_tiene_permiso('pagos:ejecutar') or public.admin_tiene_permiso('viajes:gestionar'));

create or replace function public.admin_actualizar_usuario_atomic(p_usuario_id uuid, p_datos jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_admin_id uuid;
  v_version bigint;
  v_key text;
  v_campos text[] := '{}';
begin
  if not public.admin_tiene_permiso('usuarios:validar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  select id into strict v_admin_id from public.admins where auth_user_id=auth.uid();
  perform 1 from public.usuarios where id=p_usuario_id for update;
  if not found then raise exception using errcode='22023', message='USUARIO_NO_ENCONTRADO'; end if;

  for v_key in select jsonb_object_keys(coalesce(p_datos,'{}'::jsonb)) loop
    if v_key in ('nombre','telefono','correo_facturacion','pais','estado','ciudad','codigo_postal','colonia','calle','numero','direccion_principal') then
      v_campos := array_append(v_campos, v_key);
    end if;
  end loop;
  if array_length(v_campos,1) is null then raise exception using errcode='22023', message='SIN_CAMPOS_VALIDOS'; end if;

  execute format('update public.usuarios set %s where id = %L',
    (select string_agg(format('%I = %L', campo, p_datos ->> campo), ', ') from unnest(v_campos) as campo),
    p_usuario_id);

  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('actualizacion_usuario','admin',v_admin_id,jsonb_build_object('entidad_afectada','usuario','usuario_id',p_usuario_id,'campos',to_jsonb(v_campos)));
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
  values(auth.uid(),v_admin_id,'mutacion','usuarios','actualizar',jsonb_build_object('usuario_id',p_usuario_id,'campos',to_jsonb(v_campos)));

  return jsonb_build_object('ejecutado',true,'usuario_id',p_usuario_id);
end $$;

create or replace function public.admin_actualizar_conductor_atomic(p_conductor_id uuid, p_datos jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_admin_id uuid;
  v_key text;
  v_campos text[] := '{}';
begin
  if not public.admin_tiene_permiso('conductores:validar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  select id into strict v_admin_id from public.admins where auth_user_id=auth.uid();
  perform 1 from public.conductores where id=p_conductor_id for update;
  if not found then raise exception using errcode='22023', message='CONDUCTOR_NO_ENCONTRADO'; end if;

  for v_key in select jsonb_object_keys(coalesce(p_datos,'{}'::jsonb)) loop
    if v_key in ('nombre','telefono','curp','licencia_numero','licencia_tipo','licencia_vigencia','codigo_postal','estado_residencia','ciudad_municipio','colonia','calle','numero','referencias','contacto_emergencia_nombre','contacto_emergencia_telefono','foto_perfil_url') then
      v_campos := array_append(v_campos, v_key);
    end if;
  end loop;
  if array_length(v_campos,1) is null then raise exception using errcode='22023', message='SIN_CAMPOS_VALIDOS'; end if;

  execute format('update public.conductores set %s where id = %L',
    (select string_agg(format('%I = %L', campo, p_datos ->> campo), ', ') from unnest(v_campos) as campo),
    p_conductor_id);

  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('actualizacion_conductor','admin',v_admin_id,jsonb_build_object('entidad_afectada','conductor','conductor_id',p_conductor_id,'campos',to_jsonb(v_campos)));
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
  values(auth.uid(),v_admin_id,'mutacion','conductores','actualizar',jsonb_build_object('conductor_id',p_conductor_id,'campos',to_jsonb(v_campos)));

  return jsonb_build_object('ejecutado',true,'conductor_id',p_conductor_id);
end $$;

create or replace function public.admin_actualizar_vehiculo(
  p_vehiculo_id uuid,
  p_datos jsonb,
  p_version_esperada bigint
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_admin_id uuid;
  v_version_actual bigint;
  v_campos_actualizados text[] := '{}';
  v_key text;
begin
  if not public.admin_tiene_permiso('vehiculos:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();
  select version into v_version_actual from public.vehiculos where id = p_vehiculo_id for update;
  if not found then raise exception using errcode='22023', message='VEHICULO_NO_ENCONTRADO'; end if;
  if v_version_actual != p_version_esperada then
    raise exception using errcode='40001', message='CONCURRENCY_CONFLICT';
  end if;
  for v_key in select jsonb_object_keys(coalesce(p_datos,'{}'::jsonb)) loop
    if v_key in ('tiene_tarjeta_circulacion','tiene_verificacion','tiene_placas','permiso_especial_vigente','puede_circular_rodando','transmision','color','placas','vin','estado_general_declarado','categoria_tarifa','gama','condicion','tipo','marca','modelo','anio','alias','usuario_id','conductor_id','empresa_id') then
      v_campos_actualizados := array_append(v_campos_actualizados, v_key);
    end if;
  end loop;
  if array_length(v_campos_actualizados, 1) is null then
    raise exception using errcode='22023', message='SIN_CAMPOS_VALIDOS';
  end if;
  execute format('update public.vehiculos set %s, version = %s where id = %L',
    (select string_agg(format('%I = %L', campo, p_datos ->> campo), ', ') from unnest(v_campos_actualizados) as campo),
    v_version_actual + 1,
    p_vehiculo_id);
  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'vehiculos', 'actualizar',
    jsonb_build_object('vehiculo_id', p_vehiculo_id,'campos_actualizados', to_jsonb(v_campos_actualizados),'version_anterior', v_version_actual,'version_nueva', v_version_actual + 1));
  return jsonb_build_object('ejecutado', true, 'vehiculo_id', p_vehiculo_id, 'version', v_version_actual + 1);
end $$;

create or replace function public.admin_listar_solicitudes_conductor_paginadas(
  p_pagina int default 1,
  p_tamano int default 25,
  p_filtro text default 'todas',
  p_busqueda text default null
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_pagina int := greatest(coalesce(p_pagina,1),1);
  v_tamano int := least(greatest(coalesce(p_tamano,25),1),100);
  v_offset int;
  v_total int;
  v_data jsonb;
  v_busqueda text := lower(nullif(trim(coalesce(p_busqueda,'')),''));
begin
  if not public.admin_tiene_permiso('conductores:leer') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  v_offset := (v_pagina - 1) * v_tamano;

  with base as (
    select s.*,
      coalesce(s.datos_personales->>'nombre','Conductor sin nombre') nombre,
      coalesce(s.datos_personales->>'telefono',s.telefono_normalizado) telefono,
      (select count(*) from public.documentos_conductor d where d.es_actual and coalesce(d.solicitud_id,s.id)=s.id) documentos_vigentes,
      (select count(*) from public.documentos_conductor d where d.es_actual and d.estado='rechazado' and coalesce(d.solicitud_id,s.id)=s.id) documentos_rechazados,
      (select count(distinct c.tipo_documento) from public.consentimientos_usuario c where c.solicitud_id=s.id) consentimientos_registrados,
      (select to_jsonb(h) from public.historial_estados_solicitud_conductor h where h.solicitud_id=s.id order by h.revisado_en desc limit 1) ultima_decision
    from public.solicitudes_conductor s
  ), filtrada as (
    select * from base
    where (coalesce(p_filtro,'todas')='todas'
      or (p_filtro='nuevas' and estado='en_revision')
      or (p_filtro='en_revision' and estado='en_revision')
      or (p_filtro='documentos_rechazados' and documentos_rechazados > 0)
      or (p_filtro='pendientes_correccion' and estado='requiere_correccion')
      or (p_filtro='aprobadas' and estado='aprobado')
      or (p_filtro='rechazadas' and estado='rechazado'))
      and (v_busqueda is null or lower(nombre || ' ' || coalesce(telefono,'') || ' ' || coalesce(curp_normalizada,'') || ' ' || id::text) like '%' || v_busqueda || '%')
  )
  select count(*) into v_total from filtrada;

  with base as (
    select s.*,
      coalesce(s.datos_personales->>'nombre','Conductor sin nombre') nombre,
      coalesce(s.datos_personales->>'telefono',s.telefono_normalizado) telefono,
      (select count(*) from public.documentos_conductor d where d.es_actual and coalesce(d.solicitud_id,s.id)=s.id) documentos_vigentes,
      (select count(*) from public.documentos_conductor d where d.es_actual and d.estado='rechazado' and coalesce(d.solicitud_id,s.id)=s.id) documentos_rechazados,
      (select count(distinct c.tipo_documento) from public.consentimientos_usuario c where c.solicitud_id=s.id) consentimientos_registrados,
      (select to_jsonb(h) from public.historial_estados_solicitud_conductor h where h.solicitud_id=s.id order by h.revisado_en desc limit 1) ultima_decision
    from public.solicitudes_conductor s
  ), filtrada as (
    select * from base
    where (coalesce(p_filtro,'todas')='todas'
      or (p_filtro='nuevas' and estado='en_revision')
      or (p_filtro='en_revision' and estado='en_revision')
      or (p_filtro='documentos_rechazados' and documentos_rechazados > 0)
      or (p_filtro='pendientes_correccion' and estado='requiere_correccion')
      or (p_filtro='aprobadas' and estado='aprobado')
      or (p_filtro='rechazadas' and estado='rechazado'))
      and (v_busqueda is null or lower(nombre || ' ' || coalesce(telefono,'') || ' ' || coalesce(curp_normalizada,'') || ' ' || id::text) like '%' || v_busqueda || '%')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'solicitud', to_jsonb(f),
    'nombre', f.nombre,
    'telefono', f.telefono,
    'curp', f.curp_normalizada,
    'documentosVigentes', f.documentos_vigentes,
    'documentosRechazados', f.documentos_rechazados,
    'consentimientosRegistrados', f.consentimientos_registrados,
    'ultimaDecision', f.ultima_decision
  ) order by f.actualizado_en desc),'[]'::jsonb) into v_data
  from (select * from filtrada order by actualizado_en desc limit v_tamano offset v_offset) f;

  return jsonb_build_object('data',v_data,'paginacion',jsonb_build_object('pagina',v_pagina,'tamano',v_tamano,'total',v_total,'total_paginas',ceil(v_total::numeric / v_tamano)));
end $$;

create or replace function public.admin_finanzas_traslado(p_traslado_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_ingresos numeric := 0;
  v_gastos numeric := 0;
  v_payouts numeric := 0;
  v_precio numeric := 0;
begin
  if not (public.admin_tiene_permiso('viajes:leer') and public.admin_tiene_permiso('pagos:leer')) then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  select coalesce(precio_final, precio_cotizado, 0) into v_precio from public.traslados where id=p_traslado_id;
  if not found then raise exception using errcode='22023', message='TRASLADO_NO_ENCONTRADO'; end if;
  select coalesce(sum(monto) filter (where estado='completado'),0) into v_ingresos from public.pagos where traslado_id=p_traslado_id;
  select coalesce(sum(monto),0) into v_gastos from public.gastos_traslado where traslado_id=p_traslado_id;
  select coalesce(ganancia_conductor_congelada,0) into v_payouts from public.traslados where id=p_traslado_id;
  return jsonb_build_object(
    'precio_operativo', v_precio,
    'ingresos_cobrados', v_ingresos,
    'gastos_operativos', v_gastos,
    'pago_conductor', v_payouts,
    'margen_estimado', v_ingresos - v_gastos - v_payouts,
    'margen_contra_precio', v_precio - v_gastos - v_payouts,
    'corte_en', now()
  );
end $$;

revoke all on function public.admin_actualizar_usuario_atomic(uuid,jsonb) from public;
revoke all on function public.admin_actualizar_conductor_atomic(uuid,jsonb) from public;
revoke all on function public.admin_actualizar_vehiculo(uuid,jsonb,bigint) from public;
revoke all on function public.admin_listar_solicitudes_conductor_paginadas(int,int,text,text) from public;
revoke all on function public.admin_finanzas_traslado(uuid) from public;
grant execute on function public.admin_actualizar_usuario_atomic(uuid,jsonb) to authenticated;
grant execute on function public.admin_actualizar_conductor_atomic(uuid,jsonb) to authenticated;
grant execute on function public.admin_actualizar_vehiculo(uuid,jsonb,bigint) to authenticated;
grant execute on function public.admin_listar_solicitudes_conductor_paginadas(int,int,text,text) to authenticated;
grant execute on function public.admin_finanzas_traslado(uuid) to authenticated;
