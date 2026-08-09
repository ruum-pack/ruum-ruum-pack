drop extension if exists "pg_net";

drop trigger if exists "proteger_verificacion_usuario" on "public"."usuarios";

drop policy "titular_actualiza_su_empresa" on "public"."empresas";

drop policy "usuario_ve_y_administra_sus_vehiculos_existentes" on "public"."vehiculos";

alter table "public"."registro_auditoria" drop constraint "registro_auditoria_traslado_id_fkey";

alter table "public"."vehiculos" drop constraint "vehiculos_transmision_check";

alter table "public"."verificaciones_identidad_didit" drop constraint "verificaciones_identidad_didit_estado_check";

drop function if exists "public"."admin_actualizar_estado_cuenta_usuario"(p_usuario_id uuid, p_estado text, p_motivo text);

alter type "public"."evento_auditable" rename to "evento_auditable__old_version_to_be_dropped";

create type "public"."evento_auditable" as enum ('creacion_cuenta', 'verificacion_cuenta', 'carga_documentos', 'validacion_documentos', 'creacion_solicitud_traslado', 'generacion_cotizacion', 'confirmacion_servicio', 'asignacion_conductor', 'aceptacion_traslado_conductor', 'llegada_conductor_origen', 'captura_evidencia_inicial', 'confirmacion_vehiculo_recibido', 'inicio_traslado', 'reporte_incidencia', 'llegada_destino', 'captura_evidencia_final', 'confirmacion_entrega', 'registro_pago', 'cierre_traslado', 'cancelacion_traslado', 'apertura_disputa', 'resolucion_disputa', 'apertura_reclamo_seguro', 'resolucion_reclamo_seguro', 'suspension_conductor', 'modificacion_traslado_activo', 'activacion_soporte_emergencia', 'comunicacion_usuario_conductor', 'calificacion_conductor', 'exportacion_pasaporte_pdf', 'asignacion_modo_prueba_supervisada', 'resultado_modo_prueba_supervisada', 'aceptacion_terminos', 'carga_documento_identidad', 'actualizacion_datos_bancarios_conductor', 'modificacion_masiva_traslados', 'modificacion_vehiculo', 'consulta_evidencia_vehiculo', 'actualizacion_usuario', 'actualizacion_conductor', 'accion_masiva_admin');

alter table "public"."registro_auditoria" alter column evento type "public"."evento_auditable" using evento::text::"public"."evento_auditable";

drop type "public"."evento_auditable__old_version_to_be_dropped";

alter table "public"."estado_transiciones_validas" enable row level security;

alter table "public"."registro_auditoria" add constraint "registro_auditoria_traslado_id_fkey" FOREIGN KEY (traslado_id) REFERENCES public.traslados(id) ON DELETE CASCADE not valid;

alter table "public"."registro_auditoria" validate constraint "registro_auditoria_traslado_id_fkey";

alter table "public"."vehiculos" add constraint "vehiculos_transmision_check" CHECK (((transmision IS NULL) OR (transmision = ANY (ARRAY['manual'::text, 'automatica'::text])))) not valid;

alter table "public"."vehiculos" validate constraint "vehiculos_transmision_check";

alter table "public"."verificaciones_identidad_didit" add constraint "verificaciones_identidad_didit_estado_check" CHECK ((estado = ANY (ARRAY['pendiente'::text, 'en_revision'::text, 'aprobado'::text, 'rechazado'::text, 'error'::text]))) not valid;

alter table "public"."verificaciones_identidad_didit" validate constraint "verificaciones_identidad_didit_estado_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_actualizar_usuario_atomic(p_usuario_id uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_actualizar_vehiculo(p_vehiculo_id uuid, p_datos jsonb, p_version_esperada bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_procesa_carga_traslados_masivos(p_carga_id uuid, p_limite integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_admin_id uuid;
  v_carga public.cargas_traslados_masivos%rowtype;
  v_fila public.filas_carga_traslados_masivos%rowtype;
  v_procesadas int := 0;
  v_vehiculo_id uuid;
  v_traslado_id uuid;
  v_datos jsonb;
  v_placas text;
  v_vin text;
  v_modalidad text;
  v_fecha_programada timestamptz;
begin
  if not public.admin_tiene_permiso('masivos:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  select * into strict v_carga
  from public.cargas_traslados_masivos
  where id = p_carga_id
  for update;

  if v_carga.estado = 'cancelada' then raise exception 'La carga está cancelada'; end if;
  if v_carga.estado in ('procesada','procesada_con_errores','rechazada') then
    return jsonb_build_object('carga_id', v_carga.id, 'estado', v_carga.estado, 'procesadas_en_esta_corrida', 0);
  end if;

  update public.cargas_traslados_masivos
  set estado = 'procesando',
      iniciado_en = coalesce(iniciado_en, now()),
      mensaje_estado = 'Procesando filas pendientes'
  where id = p_carga_id;

  for v_fila in
    select *
    from public.filas_carga_traslados_masivos
    where carga_id = p_carga_id and estado = 'pendiente'
    order by numero_fila
    limit greatest(coalesce(p_limite, 50), 1)
    for update skip locked
  loop
    v_datos := v_fila.datos;
    v_vehiculo_id := null;
    v_traslado_id := null;
    begin
      if exists (select 1 from public.traslados where usuario_id = v_carga.usuario_id and clave_idempotencia = v_fila.clave_idempotencia) then
        select id into v_traslado_id from public.traslados where usuario_id = v_carga.usuario_id and clave_idempotencia = v_fila.clave_idempotencia;
        update public.filas_carga_traslados_masivos
        set estado = 'creada', traslado_id = v_traslado_id, procesado_en = now()
        where id = v_fila.id;
        v_procesadas := v_procesadas + 1;
        continue;
      end if;

      v_placas := nullif(upper(btrim(coalesce(v_datos->>'vehiculo_placas', ''))), '');
      v_vin := nullif(upper(btrim(coalesce(v_datos->>'vehiculo_vin', ''))), '');
      v_modalidad := coalesce(nullif(v_datos->>'modalidad_programacion', ''), 'lo_antes_posible');
      v_fecha_programada := nullif(v_datos->>'fecha_hora_programada', '')::timestamptz;

      select id into v_vehiculo_id
      from public.vehiculos
      where usuario_id = v_carga.usuario_id
        and (
          (v_placas is not null and upper(coalesce(placas, '')) = v_placas)
          or (v_vin is not null and upper(coalesce(vin, '')) = v_vin)
        )
      order by creado_en desc
      limit 1;

      if v_vehiculo_id is null then
        insert into public.vehiculos (
          usuario_id, tipo, marca, modelo, anio, color, placas, vin,
          alias, transmision, estado_general_declarado,
          tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando,
          categoria_tarifa, gama, condicion
        ) values (
          v_carga.usuario_id,
          (v_datos->>'vehiculo_tipo')::public.tipo_vehiculo,
          btrim(v_datos->>'vehiculo_marca'),
          btrim(v_datos->>'vehiculo_modelo'),
          (v_datos->>'vehiculo_anio')::int,
          nullif(v_datos->>'vehiculo_color', ''),
          v_placas,
          v_vin,
          nullif(v_datos->>'vehiculo_alias', ''),
          nullif(v_datos->>'vehiculo_transmision', ''),
          coalesce(nullif(v_datos->>'estado_general_declarado', ''), 'Carga masiva corporativa'),
          coalesce((nullif(v_datos->>'tiene_tarjeta_circulacion', ''))::boolean, false),
          coalesce((nullif(v_datos->>'tiene_verificacion', ''))::boolean, false),
          v_placas is not null,
          coalesce((nullif(v_datos->>'puede_circular_rodando', ''))::boolean, true),
          (v_datos->>'categoria_tarifa')::public.categoria_tarifa_vehiculo,
          (v_datos->>'gama')::public.gama_vehiculo,
          (v_datos->>'condicion')::public.condicion_vehiculo
        )
        returning id into v_vehiculo_id;
      else
        update public.vehiculos
        set categoria_tarifa = coalesce((nullif(v_datos->>'categoria_tarifa', ''))::public.categoria_tarifa_vehiculo, categoria_tarifa),
            gama = coalesce((nullif(v_datos->>'gama', ''))::public.gama_vehiculo, gama),
            condicion = coalesce((nullif(v_datos->>'condicion', ''))::public.condicion_vehiculo, condicion)
        where id = v_vehiculo_id;
      end if;

      insert into public.traslados (
        usuario_id, vehiculo_id,
        contacto_entrega_nombre, contacto_entrega_telefono,
        contacto_recepcion_nombre, contacto_recepcion_telefono,
        origen_lat, origen_lng, origen_direccion, origen_ciudad, origen_referencias,
        destino_lat, destino_lng, destino_direccion, destino_ciudad, destino_referencias,
        instrucciones_especiales, modalidad_programacion, fecha_hora_programada,
        tipo_ruta, ventana_recoleccion, ventana_entrega, tipo_servicio, motivo_servicio,
        distancia_km, tiempo_estimado_horas, tipo_pago, clave_idempotencia
      ) values (
        v_carga.usuario_id, v_vehiculo_id,
        btrim(coalesce(nullif(v_datos->>'contacto_entrega_nombre', ''), 'Contacto corporativo')),
        btrim(coalesce(nullif(v_datos->>'contacto_entrega_telefono', ''), '+520000000000')),
        btrim(coalesce(nullif(v_datos->>'contacto_recepcion_nombre', ''), 'Contacto destino')),
        btrim(coalesce(nullif(v_datos->>'contacto_recepcion_telefono', ''), '+520000000001')),
        (v_datos->>'origen_lat')::numeric,
        (v_datos->>'origen_lng')::numeric,
        btrim(coalesce(nullif(v_datos->>'origen_direccion', ''), 'Origen corporativo')),
        btrim(coalesce(nullif(v_datos->>'origen_ciudad', ''), 'Sin ciudad')),
        nullif(v_datos->>'origen_referencias', ''),
        (v_datos->>'destino_lat')::numeric,
        (v_datos->>'destino_lng')::numeric,
        btrim(coalesce(nullif(v_datos->>'destino_direccion', ''), 'Destino corporativo')),
        btrim(coalesce(nullif(v_datos->>'destino_ciudad', ''), 'Sin ciudad')),
        nullif(v_datos->>'destino_referencias', ''),
        concat_ws(' | ',
          nullif(v_datos->>'instrucciones_especiales', ''),
          case when nullif(v_datos->>'referencia_externa', '') is not null then 'Ref. corporativa: ' || nullif(v_datos->>'referencia_externa', '') end
        ),
        v_modalidad,
        v_fecha_programada,
        coalesce(nullif(v_datos->>'tipo_ruta', ''), 'local'),
        nullif(v_datos->>'ventana_recoleccion', ''),
        nullif(v_datos->>'ventana_entrega', ''),
        coalesce(nullif(v_datos->>'tipo_servicio', ''), 'flotilla'),
        coalesce(nullif(v_datos->>'motivo_servicio', ''), 'traslado_especial'),
        (nullif(v_datos->>'distancia_km', ''))::numeric,
        (nullif(v_datos->>'tiempo_estimado_horas', ''))::numeric,
        coalesce(nullif(v_datos->>'tipo_pago', ''), 'al_cierre')::public.tipo_pago,
        v_fila.clave_idempotencia
      )
      returning id into v_traslado_id;

      update public.filas_carga_traslados_masivos
      set estado = 'creada', vehiculo_id = v_vehiculo_id, traslado_id = v_traslado_id, errores = '{}', procesado_en = now()
      where id = v_fila.id;
      v_procesadas := v_procesadas + 1;
    exception when others then
      update public.filas_carga_traslados_masivos
      set estado = 'error', errores = array[sqlerrm], procesado_en = now()
      where id = v_fila.id;
      v_procesadas := v_procesadas + 1;
    end;
  end loop;

  update public.cargas_traslados_masivos
  set filas_creadas = (select count(*) from public.filas_carga_traslados_masivos where carga_id = p_carga_id and estado = 'creada'),
      filas_error = (select count(*) from public.filas_carga_traslados_masivos where carga_id = p_carga_id and estado = 'error'),
      filas_procesadas = (select count(*) from public.filas_carga_traslados_masivos where carga_id = p_carga_id and estado in ('creada','error','cancelada')),
      reporte_errores_csv = public.masivo_reporte_errores_csv(p_carga_id),
      estado = case
        when exists (select 1 from public.filas_carga_traslados_masivos where carga_id = p_carga_id and estado = 'pendiente') then 'procesando'
        when (select count(*) from public.filas_carga_traslados_masivos where carga_id = p_carga_id and estado = 'creada') = 0 then 'rechazada'
        when exists (select 1 from public.filas_carga_traslados_masivos where carga_id = p_carga_id and estado = 'error') then 'procesada_con_errores'
        else 'procesada'
      end,
      finalizado_en = case
        when exists (select 1 from public.filas_carga_traslados_masivos where carga_id = p_carga_id and estado = 'pendiente') then null
        else now()
      end,
      mensaje_estado = case
        when exists (select 1 from public.filas_carga_traslados_masivos where carga_id = p_carga_id and estado = 'pendiente') then 'Procesamiento parcial; quedan filas pendientes'
        else 'Procesamiento finalizado'
      end
  where id = p_carga_id;

  return (
    select jsonb_build_object(
      'carga_id', id,
      'total_filas', total_filas,
      'filas_creadas', filas_creadas,
      'filas_error', filas_error,
      'filas_procesadas', filas_procesadas,
      'estado', estado,
      'procesadas_en_esta_corrida', v_procesadas
    )
    from public.cargas_traslados_masivos
    where id = p_carga_id
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.listar_viajes_admin_paginados(p_pagina integer DEFAULT 1, p_tamano integer DEFAULT 25, p_filtro_estado text DEFAULT 'todos'::text, p_busqueda text DEFAULT NULL::text, p_orden_columna text DEFAULT 'creado_en'::text, p_orden_direccion text DEFAULT 'desc'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_offset int;
  v_limit int;
  v_total bigint;
  v_filas jsonb;
  v_where text := 'true';
  v_order text;
begin
  if not public.admin_tiene_permiso('viajes:leer') then
    raise exception using errcode = '42501', message = 'PERMISO_INSUFICIENTE';
  end if;

  v_limit := least(greatest(coalesce(p_tamano, 25), 1), 100);
  v_offset := (greatest(coalesce(p_pagina, 1), 1) - 1) * v_limit;

  if p_filtro_estado is not null and p_filtro_estado <> 'todos' then
    v_where := v_where || ' AND p.estado = ' || quote_literal(p_filtro_estado) || '::public.estado_traslado';
  end if;

  if p_busqueda is not null and btrim(p_busqueda) <> '' then
    v_where := v_where || ' AND (
      p.traslado_id::text ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.origen_ciudad ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.destino_ciudad ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.vehiculo_marca ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.vehiculo_modelo ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.vehiculo_placas ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.conductor_nombre ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
    )';
  end if;

  v_order := case
    when p_orden_columna = 'folio' then 'p.traslado_id'
    when p_orden_columna = 'inicio_programado' then 'coalesce(p.fecha_hora_programada, p.creado_en)'
    when p_orden_columna = 'ruta' then 'p.origen_ciudad'
    when p_orden_columna = 'vehiculo' then 'p.vehiculo_marca'
    when p_orden_columna = 'conductor' then 'p.conductor_nombre'
    when p_orden_columna = 'estatus' then 'p.estado'
    else 'p.creado_en'
  end || case when lower(coalesce(p_orden_direccion, 'desc')) = 'asc' then ' ASC' else ' DESC' end;

  execute format('select count(*) from public.pasaporte_digital p where %s', v_where)
    into v_total;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(f)), ''[]''::jsonb)
     from (
       select p.*
       from public.pasaporte_digital p
       where %s
       order by %s
       limit %L offset %L
     ) f',
    v_where,
    v_order,
    v_limit,
    v_offset
  ) into v_filas;

  return jsonb_build_object(
    'data', coalesce(v_filas, '[]'::jsonb),
    'paginacion', jsonb_build_object(
      'pagina', greatest(coalesce(p_pagina, 1), 1),
      'tamano', v_limit,
      'total', coalesce(v_total, 0),
      'total_paginas', case
        when coalesce(v_total, 0) = 0 then 0
        else ceil(v_total::numeric / v_limit)::int
      end
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.masivo_validar_fila(p_fila jsonb)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_errores text[] := '{}';
  v_modalidad text;
  v_num numeric;
  v_key text;
  v_permitidos text[] := array[
    'referencia_externa','vehiculo_placas','vehiculo_vin','vehiculo_marca','vehiculo_modelo','vehiculo_anio','vehiculo_tipo',
    'vehiculo_color','vehiculo_alias','vehiculo_transmision','estado_general_declarado','tiene_tarjeta_circulacion','tiene_verificacion',
    'puede_circular_rodando','categoria_tarifa','gama','condicion','contacto_entrega_nombre','contacto_entrega_telefono',
    'contacto_recepcion_nombre','contacto_recepcion_telefono','origen_direccion','origen_ciudad','origen_lat','origen_lng',
    'origen_referencias','destino_direccion','destino_ciudad','destino_lat','destino_lng','destino_referencias',
    'modalidad_programacion','fecha_hora_programada','tipo_pago','tipo_ruta','tipo_servicio','motivo_servicio',
    'distancia_km','tiempo_estimado_horas','instrucciones_especiales'
  ];
begin
  if p_fila is null or jsonb_typeof(p_fila) <> 'object' then return array['La fila debe ser objeto JSON']; end if;
  for v_key in select jsonb_object_keys(p_fila)
  loop
    if v_key <> all(v_permitidos) then v_errores := array_append(v_errores, 'Columna no permitida: ' || v_key); end if;
  end loop;

  if nullif(p_fila->>'vehiculo_marca', '') is null then v_errores := array_append(v_errores, 'vehiculo_marca es requerido'); end if;
  if nullif(p_fila->>'vehiculo_modelo', '') is null then v_errores := array_append(v_errores, 'vehiculo_modelo es requerido'); end if;
  if nullif(p_fila->>'vehiculo_anio', '') is null then v_errores := array_append(v_errores, 'vehiculo_anio es requerido'); end if;
  if nullif(p_fila->>'vehiculo_tipo', '') is null then v_errores := array_append(v_errores, 'vehiculo_tipo es requerido'); end if;
  if nullif(p_fila->>'vehiculo_placas', '') is null and nullif(p_fila->>'vehiculo_vin', '') is null then v_errores := array_append(v_errores, 'vehiculo_placas o vehiculo_vin es requerido'); end if;
  if nullif(p_fila->>'categoria_tarifa', '') is null then v_errores := array_append(v_errores, 'categoria_tarifa es requerida'); end if;
  if nullif(p_fila->>'gama', '') is null then v_errores := array_append(v_errores, 'gama es requerida'); end if;
  if nullif(p_fila->>'condicion', '') is null then v_errores := array_append(v_errores, 'condicion es requerida'); end if;
  if nullif(p_fila->>'origen_lat', '') is null or nullif(p_fila->>'origen_lng', '') is null then v_errores := array_append(v_errores, 'coordenadas de origen requeridas'); end if;
  if nullif(p_fila->>'destino_lat', '') is null or nullif(p_fila->>'destino_lng', '') is null then v_errores := array_append(v_errores, 'coordenadas de destino requeridas'); end if;

  foreach v_key in array array['vehiculo_anio','origen_lat','origen_lng','destino_lat','destino_lng','distancia_km','tiempo_estimado_horas']
  loop
    begin
      if nullif(p_fila->>v_key, '') is not null then v_num := (p_fila->>v_key)::numeric; end if;
    exception when others then
      v_errores := array_append(v_errores, v_key || ' debe ser numérico');
    end;
  end loop;

  v_modalidad := coalesce(nullif(p_fila->>'modalidad_programacion', ''), 'lo_antes_posible');
  if v_modalidad not in ('lo_antes_posible','programado') then v_errores := array_append(v_errores, 'modalidad_programacion inválida'); end if;
  if v_modalidad = 'programado' and nullif(p_fila->>'fecha_hora_programada', '') is null then v_errores := array_append(v_errores, 'fecha_hora_programada requerida para programado'); end if;
  if v_modalidad = 'lo_antes_posible' and nullif(p_fila->>'fecha_hora_programada', '') is not null then v_errores := array_append(v_errores, 'fecha_hora_programada no aplica para lo_antes_posible'); end if;

  return v_errores;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.usuario_crea_traslado(p_vehiculo_id uuid, p_vehiculo jsonb, p_traslado jsonb, p_clave_idempotencia uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_usuario_id uuid;
  v_estado_verificacion public.estado_verificacion;
  v_tipo_pago public.tipo_pago;
  v_vehiculo_id uuid;
  v_tipo_vehiculo public.tipo_vehiculo;
  v_traslado_id uuid;
  v_anio int;
  v_anio_maximo int := extract(year from now())::int + 1;
  v_modalidad text;
  v_fecha_programada timestamptz;
  v_tiene_tarjeta boolean;
  v_tiene_verificacion boolean;
  v_tiene_placas boolean;
  v_puede_circular boolean;
  v_distancia_km numeric;
  v_tiempo_estimado_horas numeric;
  v_categoria_tarifa public.categoria_tarifa_vehiculo;
  v_gama public.gama_vehiculo;
  v_condicion public.condicion_vehiculo;
  v_precio_cotizado numeric;
  v_estado_inicial public.estado_traslado := 'solicitud_creada';
  v_momento timestamptz;
begin
  select id, estado_verificacion
  into v_usuario_id, v_estado_verificacion
  from public.usuarios
  where auth_user_id = auth.uid();
  if v_usuario_id is null then
    raise exception 'Usuario no encontrado';
  end if;

  if v_estado_verificacion <> 'verificado' then
    raise exception 'Tu cuenta debe estar verificada para solicitar un traslado';
  end if;

  if p_clave_idempotencia is null then raise exception 'La clave de idempotencia es obligatoria'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_usuario_id::text || p_clave_idempotencia::text, 0));
  select id, tipo_pago into v_traslado_id, v_tipo_pago
  from public.traslados where usuario_id = v_usuario_id and clave_idempotencia = p_clave_idempotencia;
  if v_traslado_id is not null then
    return jsonb_build_object('id', v_traslado_id, 'tipo_pago', v_tipo_pago);
  end if;

  v_tipo_pago := public.determinar_tipo_pago_usuario(v_usuario_id);
  v_modalidad := p_traslado->>'modalidad_programacion';
  if v_modalidad not in ('lo_antes_posible', 'programado') then raise exception 'Modalidad de programación inválida'; end if;
  v_fecha_programada := nullif(p_traslado->>'fecha_hora_programada', '')::timestamptz;
  if v_modalidad = 'programado' then
    if v_fecha_programada is null then raise exception 'La fecha programada es obligatoria'; end if;
    if v_fecha_programada < now() + interval '2 hours' then raise exception 'La fecha no cumple con la anticipación mínima de 2 horas'; end if;
  elsif v_fecha_programada is not null then
    raise exception 'La modalidad inmediata no admite fecha programada';
  end if;

  if p_vehiculo_id is not null then
    select id, tipo, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando,
           categoria_tarifa, gama, condicion
    into v_vehiculo_id, v_tipo_vehiculo, v_tiene_tarjeta, v_tiene_verificacion, v_tiene_placas, v_puede_circular,
         v_categoria_tarifa, v_gama, v_condicion
    from public.vehiculos
    where id = p_vehiculo_id
      and usuario_id = v_usuario_id;

    if v_vehiculo_id is null then
      raise exception 'El vehículo indicado no existe o no pertenece al usuario.';
    end if;
  else
    if p_vehiculo is null then
      raise exception 'Debes indicar un vehículo guardado (p_vehiculo_id) o los datos de un vehículo nuevo (p_vehiculo).';
    end if;

    v_anio := (p_vehiculo->>'anio')::int;
    if v_anio is null or v_anio < 1980 or v_anio > v_anio_maximo then
      raise exception 'El año del vehículo debe ser un número entre 1980 y %.', v_anio_maximo;
    end if;

    v_tipo_vehiculo := (p_vehiculo->>'tipo')::public.tipo_vehiculo;
    v_tiene_tarjeta := coalesce((p_vehiculo->>'tiene_tarjeta_circulacion')::boolean, false);
    v_tiene_verificacion := coalesce((p_vehiculo->>'tiene_verificacion')::boolean, false);
    v_tiene_placas := coalesce((p_vehiculo->>'tiene_placas')::boolean, false);
    v_puede_circular := coalesce((p_vehiculo->>'puede_circular_rodando')::boolean, false);

    -- Autoasignación (RT-13): categoría/gama por catálogo marca+modelo,
    -- condición fija en 'seminueva' -- el usuario nunca escribe ninguna de
    -- las tres. Torre de Control puede corregirlas después si detecta algo
    -- distinto durante la verificación física, sin que eso reabra la tarifa
    -- ya mostrada y confirmada.
    select categoria_tarifa, gama into v_categoria_tarifa, v_gama
    from public.catalogar_vehiculo_para_tarifa(p_vehiculo->>'marca', p_vehiculo->>'modelo');
    v_condicion := 'seminueva';

    insert into public.vehiculos (
      usuario_id, tipo, transmision, marca, modelo, anio, color, placas, vin,
      estado_general_declarado, tiene_tarjeta_circulacion, tiene_verificacion,
      tiene_placas, puede_circular_rodando, categoria_tarifa, gama, condicion
    ) values (
      v_usuario_id,
      v_tipo_vehiculo,
      p_vehiculo->>'transmision',
      p_vehiculo->>'marca',
      p_vehiculo->>'modelo',
      v_anio,
      p_vehiculo->>'color',
      p_vehiculo->>'placas',
      p_vehiculo->>'vin',
      p_vehiculo->>'estado_general_declarado',
      coalesce((p_vehiculo->>'tiene_tarjeta_circulacion')::boolean, false),
      coalesce((p_vehiculo->>'tiene_verificacion')::boolean, false),
      coalesce((p_vehiculo->>'tiene_placas')::boolean, false),
      coalesce((p_vehiculo->>'puede_circular_rodando')::boolean, false),
      v_categoria_tarifa,
      v_gama,
      v_condicion
    )
    returning id into v_vehiculo_id;
  end if;

  if not (v_tiene_tarjeta and v_tiene_verificacion and v_tiene_placas and v_puede_circular) then
    raise exception 'El MVP solo admite vehículos que encienden, tienen documentación vigente y pueden circular rodando';
  end if;

  v_distancia_km := nullif(p_traslado->>'distancia_km', '')::numeric;
  v_tiempo_estimado_horas := nullif(p_traslado->>'tiempo_estimado_horas', '')::numeric;
  if (v_distancia_km is null) <> (v_tiempo_estimado_horas is null) then
    raise exception 'La distancia y el tiempo estimado de ruta deben enviarse juntos.';
  end if;
  if v_distancia_km is not null and (v_distancia_km < 0 or v_distancia_km > 20000) then
    raise exception 'La distancia estimada de ruta es inválida.';
  end if;
  if v_tiempo_estimado_horas is not null and (v_tiempo_estimado_horas < 0 or v_tiempo_estimado_horas > 720) then
    raise exception 'El tiempo estimado de ruta es inválido.';
  end if;

  -- Tarifa automática (RT-13): si el vehículo ya tiene categoría/gama/condición
  -- y llegó distancia/tiempo de Mapbox, se calcula y se guarda de una vez --
  -- el usuario no espera a que un admin le teclee un precio.
  if v_categoria_tarifa is not null and v_gama is not null and v_condicion is not null
     and v_distancia_km is not null and v_tiempo_estimado_horas is not null then
    v_momento := coalesce(v_fecha_programada, now());
    v_precio_cotizado := public.calcular_tarifa_traslado(
      v_categoria_tarifa, public.rango_desde_distancia(v_distancia_km), v_gama, v_condicion,
      public.horario_desde_timestamp(v_momento), public.dia_desde_timestamp(v_momento),
      v_distancia_km, v_tiempo_estimado_horas
    );
    v_estado_inicial := 'cotizacion_generada';
  end if;

  insert into public.traslados (
    usuario_id, vehiculo_id, estado,
    contacto_entrega_nombre, contacto_entrega_telefono,
    contacto_recepcion_nombre, contacto_recepcion_telefono,
    origen_lat, origen_lng, origen_direccion, origen_ciudad, origen_referencias,
    destino_lat, destino_lng, destino_direccion, destino_ciudad, destino_referencias,
    instrucciones_especiales, modalidad_programacion, fecha_hora_programada,
    tipo_ruta, ventana_recoleccion, ventana_entrega, tipo_servicio, motivo_servicio,
    presupuesto_usuario, precio_cotizado, precio_final, tipo_pago, clave_idempotencia,
    distancia_km, tiempo_estimado_horas,
    cotizacion_expira_en
  ) values (
    v_usuario_id, v_vehiculo_id, v_estado_inicial,
    p_traslado->>'contacto_entrega_nombre',
    p_traslado->>'contacto_entrega_telefono',
    p_traslado->>'contacto_recepcion_nombre',
    p_traslado->>'contacto_recepcion_telefono',
    nullif(p_traslado->>'origen_lat', '')::numeric,
    nullif(p_traslado->>'origen_lng', '')::numeric,
    p_traslado->>'origen_direccion',
    p_traslado->>'origen_ciudad',
    p_traslado->>'origen_referencias',
    nullif(p_traslado->>'destino_lat', '')::numeric,
    nullif(p_traslado->>'destino_lng', '')::numeric,
    p_traslado->>'destino_direccion',
    p_traslado->>'destino_ciudad',
    p_traslado->>'destino_referencias',
    p_traslado->>'instrucciones_especiales',
    p_traslado->>'modalidad_programacion',
    v_fecha_programada,
    p_traslado->>'tipo_ruta',
    p_traslado->>'ventana_recoleccion',
    p_traslado->>'ventana_entrega',
    p_traslado->>'tipo_servicio',
    p_traslado->>'motivo_servicio',
    null, v_precio_cotizado, null, v_tipo_pago, p_clave_idempotencia,
    v_distancia_km, v_tiempo_estimado_horas,
    case when v_precio_cotizado is not null then now() + interval '72 hours' else null end
  )
  returning id into v_traslado_id;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    v_traslado_id,
    'creacion_solicitud_traslado',
    'usuario',
    v_usuario_id,
    jsonb_build_object(
      'vehiculo_id', v_vehiculo_id,
      'vehiculo_reutilizado', p_vehiculo_id is not null,
      'tipo_pago', v_tipo_pago,
      'distancia_km', v_distancia_km,
      'tiempo_estimado_horas', v_tiempo_estimado_horas,
      'precio_cotizado_automatico', v_precio_cotizado
    )
  );

  return jsonb_build_object('id', v_traslado_id, 'tipo_pago', v_tipo_pago, 'precio_cotizado', v_precio_cotizado);
end;
$function$;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mi_rol_admin') then
    create role "mi_rol_admin";
  end if;
end;
$$;

grant delete on table "public"."admin_capacidades" to "mi_rol_admin";

grant insert on table "public"."admin_capacidades" to "mi_rol_admin";

grant references on table "public"."admin_capacidades" to "mi_rol_admin";

grant select on table "public"."admin_capacidades" to "mi_rol_admin";

grant trigger on table "public"."admin_capacidades" to "mi_rol_admin";

grant truncate on table "public"."admin_capacidades" to "mi_rol_admin";

grant update on table "public"."admin_capacidades" to "mi_rol_admin";

grant delete on table "public"."admin_capacidades" to "service_role";

grant insert on table "public"."admin_capacidades" to "service_role";

grant select on table "public"."admin_capacidades" to "service_role";

grant update on table "public"."admin_capacidades" to "service_role";

grant delete on table "public"."admins" to "anon";

grant insert on table "public"."admins" to "anon";

grant select on table "public"."admins" to "anon";

grant update on table "public"."admins" to "anon";

grant delete on table "public"."admins" to "authenticated";

grant insert on table "public"."admins" to "authenticated";

grant update on table "public"."admins" to "authenticated";

grant delete on table "public"."admins" to "mi_rol_admin";

grant insert on table "public"."admins" to "mi_rol_admin";

grant references on table "public"."admins" to "mi_rol_admin";

grant select on table "public"."admins" to "mi_rol_admin";

grant trigger on table "public"."admins" to "mi_rol_admin";

grant truncate on table "public"."admins" to "mi_rol_admin";

grant update on table "public"."admins" to "mi_rol_admin";

grant delete on table "public"."admins" to "service_role";

grant insert on table "public"."admins" to "service_role";

grant select on table "public"."admins" to "service_role";

grant update on table "public"."admins" to "service_role";

grant delete on table "public"."alertas_sla_historial" to "anon";

grant insert on table "public"."alertas_sla_historial" to "anon";

grant select on table "public"."alertas_sla_historial" to "anon";

grant update on table "public"."alertas_sla_historial" to "anon";

grant delete on table "public"."alertas_sla_historial" to "authenticated";

grant insert on table "public"."alertas_sla_historial" to "authenticated";

grant update on table "public"."alertas_sla_historial" to "authenticated";

grant delete on table "public"."alertas_sla_historial" to "service_role";

grant insert on table "public"."alertas_sla_historial" to "service_role";

grant select on table "public"."alertas_sla_historial" to "service_role";

grant update on table "public"."alertas_sla_historial" to "service_role";

grant delete on table "public"."alertas_sla_operacionales" to "anon";

grant insert on table "public"."alertas_sla_operacionales" to "anon";

grant select on table "public"."alertas_sla_operacionales" to "anon";

grant update on table "public"."alertas_sla_operacionales" to "anon";

grant delete on table "public"."alertas_sla_operacionales" to "authenticated";

grant insert on table "public"."alertas_sla_operacionales" to "authenticated";

grant update on table "public"."alertas_sla_operacionales" to "authenticated";

grant delete on table "public"."alertas_sla_operacionales" to "service_role";

grant insert on table "public"."alertas_sla_operacionales" to "service_role";

grant select on table "public"."alertas_sla_operacionales" to "service_role";

grant update on table "public"."alertas_sla_operacionales" to "service_role";

grant delete on table "public"."auditoria_admin_seguridad" to "mi_rol_admin";

grant insert on table "public"."auditoria_admin_seguridad" to "mi_rol_admin";

grant references on table "public"."auditoria_admin_seguridad" to "mi_rol_admin";

grant select on table "public"."auditoria_admin_seguridad" to "mi_rol_admin";

grant trigger on table "public"."auditoria_admin_seguridad" to "mi_rol_admin";

grant truncate on table "public"."auditoria_admin_seguridad" to "mi_rol_admin";

grant update on table "public"."auditoria_admin_seguridad" to "mi_rol_admin";

grant delete on table "public"."auditoria_admin_seguridad" to "service_role";

grant insert on table "public"."auditoria_admin_seguridad" to "service_role";

grant select on table "public"."auditoria_admin_seguridad" to "service_role";

grant update on table "public"."auditoria_admin_seguridad" to "service_role";

grant delete on table "public"."calificaciones_traslado" to "anon";

grant insert on table "public"."calificaciones_traslado" to "anon";

grant select on table "public"."calificaciones_traslado" to "anon";

grant update on table "public"."calificaciones_traslado" to "anon";

grant delete on table "public"."calificaciones_traslado" to "authenticated";

grant insert on table "public"."calificaciones_traslado" to "authenticated";

grant select on table "public"."calificaciones_traslado" to "authenticated";

grant update on table "public"."calificaciones_traslado" to "authenticated";

grant delete on table "public"."calificaciones_traslado" to "mi_rol_admin";

grant insert on table "public"."calificaciones_traslado" to "mi_rol_admin";

grant references on table "public"."calificaciones_traslado" to "mi_rol_admin";

grant select on table "public"."calificaciones_traslado" to "mi_rol_admin";

grant trigger on table "public"."calificaciones_traslado" to "mi_rol_admin";

grant truncate on table "public"."calificaciones_traslado" to "mi_rol_admin";

grant update on table "public"."calificaciones_traslado" to "mi_rol_admin";

grant delete on table "public"."calificaciones_traslado" to "service_role";

grant insert on table "public"."calificaciones_traslado" to "service_role";

grant select on table "public"."calificaciones_traslado" to "service_role";

grant update on table "public"."calificaciones_traslado" to "service_role";

grant delete on table "public"."cargas_traslados_masivos" to "anon";

grant insert on table "public"."cargas_traslados_masivos" to "anon";

grant select on table "public"."cargas_traslados_masivos" to "anon";

grant update on table "public"."cargas_traslados_masivos" to "anon";

grant delete on table "public"."cargas_traslados_masivos" to "authenticated";

grant insert on table "public"."cargas_traslados_masivos" to "authenticated";

grant update on table "public"."cargas_traslados_masivos" to "authenticated";

grant delete on table "public"."cargas_traslados_masivos" to "mi_rol_admin";

grant insert on table "public"."cargas_traslados_masivos" to "mi_rol_admin";

grant references on table "public"."cargas_traslados_masivos" to "mi_rol_admin";

grant select on table "public"."cargas_traslados_masivos" to "mi_rol_admin";

grant trigger on table "public"."cargas_traslados_masivos" to "mi_rol_admin";

grant truncate on table "public"."cargas_traslados_masivos" to "mi_rol_admin";

grant update on table "public"."cargas_traslados_masivos" to "mi_rol_admin";

grant delete on table "public"."cargas_traslados_masivos" to "service_role";

grant insert on table "public"."cargas_traslados_masivos" to "service_role";

grant select on table "public"."cargas_traslados_masivos" to "service_role";

grant update on table "public"."cargas_traslados_masivos" to "service_role";

grant delete on table "public"."catalogo_vehiculos_tarifa" to "anon";

grant insert on table "public"."catalogo_vehiculos_tarifa" to "anon";

grant select on table "public"."catalogo_vehiculos_tarifa" to "anon";

grant update on table "public"."catalogo_vehiculos_tarifa" to "anon";

grant delete on table "public"."catalogo_vehiculos_tarifa" to "authenticated";

grant insert on table "public"."catalogo_vehiculos_tarifa" to "authenticated";

grant select on table "public"."catalogo_vehiculos_tarifa" to "authenticated";

grant update on table "public"."catalogo_vehiculos_tarifa" to "authenticated";

grant delete on table "public"."catalogo_vehiculos_tarifa" to "mi_rol_admin";

grant insert on table "public"."catalogo_vehiculos_tarifa" to "mi_rol_admin";

grant references on table "public"."catalogo_vehiculos_tarifa" to "mi_rol_admin";

grant select on table "public"."catalogo_vehiculos_tarifa" to "mi_rol_admin";

grant trigger on table "public"."catalogo_vehiculos_tarifa" to "mi_rol_admin";

grant truncate on table "public"."catalogo_vehiculos_tarifa" to "mi_rol_admin";

grant update on table "public"."catalogo_vehiculos_tarifa" to "mi_rol_admin";

grant delete on table "public"."catalogo_vehiculos_tarifa" to "service_role";

grant insert on table "public"."catalogo_vehiculos_tarifa" to "service_role";

grant select on table "public"."catalogo_vehiculos_tarifa" to "service_role";

grant update on table "public"."catalogo_vehiculos_tarifa" to "service_role";

grant delete on table "public"."certificacion_pago_conductor" to "anon";

grant insert on table "public"."certificacion_pago_conductor" to "anon";

grant select on table "public"."certificacion_pago_conductor" to "anon";

grant update on table "public"."certificacion_pago_conductor" to "anon";

grant delete on table "public"."certificacion_pago_conductor" to "authenticated";

grant insert on table "public"."certificacion_pago_conductor" to "authenticated";

grant select on table "public"."certificacion_pago_conductor" to "authenticated";

grant update on table "public"."certificacion_pago_conductor" to "authenticated";

grant delete on table "public"."certificacion_pago_conductor" to "mi_rol_admin";

grant insert on table "public"."certificacion_pago_conductor" to "mi_rol_admin";

grant references on table "public"."certificacion_pago_conductor" to "mi_rol_admin";

grant select on table "public"."certificacion_pago_conductor" to "mi_rol_admin";

grant trigger on table "public"."certificacion_pago_conductor" to "mi_rol_admin";

grant truncate on table "public"."certificacion_pago_conductor" to "mi_rol_admin";

grant update on table "public"."certificacion_pago_conductor" to "mi_rol_admin";

grant delete on table "public"."certificacion_pago_conductor" to "service_role";

grant insert on table "public"."certificacion_pago_conductor" to "service_role";

grant select on table "public"."certificacion_pago_conductor" to "service_role";

grant update on table "public"."certificacion_pago_conductor" to "service_role";

grant delete on table "public"."claves_idempotencia" to "anon";

grant insert on table "public"."claves_idempotencia" to "anon";

grant select on table "public"."claves_idempotencia" to "anon";

grant update on table "public"."claves_idempotencia" to "anon";

grant delete on table "public"."claves_idempotencia" to "authenticated";

grant insert on table "public"."claves_idempotencia" to "authenticated";

grant select on table "public"."claves_idempotencia" to "authenticated";

grant update on table "public"."claves_idempotencia" to "authenticated";

grant delete on table "public"."claves_idempotencia" to "service_role";

grant insert on table "public"."claves_idempotencia" to "service_role";

grant select on table "public"."claves_idempotencia" to "service_role";

grant update on table "public"."claves_idempotencia" to "service_role";

grant delete on table "public"."conductores" to "anon";

grant insert on table "public"."conductores" to "anon";

grant select on table "public"."conductores" to "anon";

grant update on table "public"."conductores" to "anon";

grant delete on table "public"."conductores" to "authenticated";

grant insert on table "public"."conductores" to "authenticated";

grant update on table "public"."conductores" to "authenticated";

grant delete on table "public"."conductores" to "mi_rol_admin";

grant insert on table "public"."conductores" to "mi_rol_admin";

grant references on table "public"."conductores" to "mi_rol_admin";

grant select on table "public"."conductores" to "mi_rol_admin";

grant trigger on table "public"."conductores" to "mi_rol_admin";

grant truncate on table "public"."conductores" to "mi_rol_admin";

grant update on table "public"."conductores" to "mi_rol_admin";

grant delete on table "public"."conductores" to "service_role";

grant insert on table "public"."conductores" to "service_role";

grant select on table "public"."conductores" to "service_role";

grant update on table "public"."conductores" to "service_role";

grant delete on table "public"."configuracion_admin" to "anon";

grant insert on table "public"."configuracion_admin" to "anon";

grant select on table "public"."configuracion_admin" to "anon";

grant update on table "public"."configuracion_admin" to "anon";

grant delete on table "public"."configuracion_admin" to "service_role";

grant insert on table "public"."configuracion_admin" to "service_role";

grant select on table "public"."configuracion_admin" to "service_role";

grant update on table "public"."configuracion_admin" to "service_role";

grant delete on table "public"."configuracion_contactos_soporte" to "anon";

grant insert on table "public"."configuracion_contactos_soporte" to "anon";

grant select on table "public"."configuracion_contactos_soporte" to "anon";

grant update on table "public"."configuracion_contactos_soporte" to "anon";

grant delete on table "public"."configuracion_contactos_soporte" to "authenticated";

grant insert on table "public"."configuracion_contactos_soporte" to "authenticated";

grant select on table "public"."configuracion_contactos_soporte" to "authenticated";

grant update on table "public"."configuracion_contactos_soporte" to "authenticated";

grant delete on table "public"."configuracion_contactos_soporte" to "mi_rol_admin";

grant insert on table "public"."configuracion_contactos_soporte" to "mi_rol_admin";

grant references on table "public"."configuracion_contactos_soporte" to "mi_rol_admin";

grant select on table "public"."configuracion_contactos_soporte" to "mi_rol_admin";

grant trigger on table "public"."configuracion_contactos_soporte" to "mi_rol_admin";

grant truncate on table "public"."configuracion_contactos_soporte" to "mi_rol_admin";

grant update on table "public"."configuracion_contactos_soporte" to "mi_rol_admin";

grant delete on table "public"."configuracion_contactos_soporte" to "service_role";

grant insert on table "public"."configuracion_contactos_soporte" to "service_role";

grant select on table "public"."configuracion_contactos_soporte" to "service_role";

grant update on table "public"."configuracion_contactos_soporte" to "service_role";

grant select on table "public"."consentimientos_usuario" to "anon";

grant delete on table "public"."consentimientos_usuario" to "mi_rol_admin";

grant insert on table "public"."consentimientos_usuario" to "mi_rol_admin";

grant references on table "public"."consentimientos_usuario" to "mi_rol_admin";

grant select on table "public"."consentimientos_usuario" to "mi_rol_admin";

grant trigger on table "public"."consentimientos_usuario" to "mi_rol_admin";

grant truncate on table "public"."consentimientos_usuario" to "mi_rol_admin";

grant update on table "public"."consentimientos_usuario" to "mi_rol_admin";

grant delete on table "public"."datos_bancarios_conductor" to "anon";

grant insert on table "public"."datos_bancarios_conductor" to "anon";

grant select on table "public"."datos_bancarios_conductor" to "anon";

grant update on table "public"."datos_bancarios_conductor" to "anon";

grant delete on table "public"."datos_bancarios_conductor" to "authenticated";

grant insert on table "public"."datos_bancarios_conductor" to "authenticated";

grant update on table "public"."datos_bancarios_conductor" to "authenticated";

grant delete on table "public"."datos_bancarios_conductor" to "mi_rol_admin";

grant insert on table "public"."datos_bancarios_conductor" to "mi_rol_admin";

grant references on table "public"."datos_bancarios_conductor" to "mi_rol_admin";

grant select on table "public"."datos_bancarios_conductor" to "mi_rol_admin";

grant trigger on table "public"."datos_bancarios_conductor" to "mi_rol_admin";

grant truncate on table "public"."datos_bancarios_conductor" to "mi_rol_admin";

grant update on table "public"."datos_bancarios_conductor" to "mi_rol_admin";

grant delete on table "public"."datos_bancarios_conductor" to "service_role";

grant insert on table "public"."datos_bancarios_conductor" to "service_role";

grant select on table "public"."datos_bancarios_conductor" to "service_role";

grant update on table "public"."datos_bancarios_conductor" to "service_role";

grant delete on table "public"."dispositivos_push" to "anon";

grant insert on table "public"."dispositivos_push" to "anon";

grant select on table "public"."dispositivos_push" to "anon";

grant update on table "public"."dispositivos_push" to "anon";

grant delete on table "public"."dispositivos_push" to "authenticated";

grant insert on table "public"."dispositivos_push" to "authenticated";

grant select on table "public"."dispositivos_push" to "authenticated";

grant update on table "public"."dispositivos_push" to "authenticated";

grant delete on table "public"."dispositivos_push" to "mi_rol_admin";

grant insert on table "public"."dispositivos_push" to "mi_rol_admin";

grant references on table "public"."dispositivos_push" to "mi_rol_admin";

grant select on table "public"."dispositivos_push" to "mi_rol_admin";

grant trigger on table "public"."dispositivos_push" to "mi_rol_admin";

grant truncate on table "public"."dispositivos_push" to "mi_rol_admin";

grant update on table "public"."dispositivos_push" to "mi_rol_admin";

grant delete on table "public"."dispositivos_push" to "service_role";

grant insert on table "public"."dispositivos_push" to "service_role";

grant select on table "public"."dispositivos_push" to "service_role";

grant update on table "public"."dispositivos_push" to "service_role";

grant delete on table "public"."disputas" to "anon";

grant insert on table "public"."disputas" to "anon";

grant select on table "public"."disputas" to "anon";

grant update on table "public"."disputas" to "anon";

grant delete on table "public"."disputas" to "authenticated";

grant insert on table "public"."disputas" to "authenticated";

grant select on table "public"."disputas" to "authenticated";

grant update on table "public"."disputas" to "authenticated";

grant delete on table "public"."disputas" to "mi_rol_admin";

grant insert on table "public"."disputas" to "mi_rol_admin";

grant references on table "public"."disputas" to "mi_rol_admin";

grant select on table "public"."disputas" to "mi_rol_admin";

grant trigger on table "public"."disputas" to "mi_rol_admin";

grant truncate on table "public"."disputas" to "mi_rol_admin";

grant update on table "public"."disputas" to "mi_rol_admin";

grant delete on table "public"."disputas" to "service_role";

grant insert on table "public"."disputas" to "service_role";

grant select on table "public"."disputas" to "service_role";

grant update on table "public"."disputas" to "service_role";

grant delete on table "public"."documento_conductor_transiciones" to "anon";

grant insert on table "public"."documento_conductor_transiciones" to "anon";

grant select on table "public"."documento_conductor_transiciones" to "anon";

grant update on table "public"."documento_conductor_transiciones" to "anon";

grant delete on table "public"."documento_conductor_transiciones" to "authenticated";

grant insert on table "public"."documento_conductor_transiciones" to "authenticated";

grant update on table "public"."documento_conductor_transiciones" to "authenticated";

grant delete on table "public"."documento_conductor_transiciones" to "mi_rol_admin";

grant insert on table "public"."documento_conductor_transiciones" to "mi_rol_admin";

grant references on table "public"."documento_conductor_transiciones" to "mi_rol_admin";

grant select on table "public"."documento_conductor_transiciones" to "mi_rol_admin";

grant trigger on table "public"."documento_conductor_transiciones" to "mi_rol_admin";

grant truncate on table "public"."documento_conductor_transiciones" to "mi_rol_admin";

grant update on table "public"."documento_conductor_transiciones" to "mi_rol_admin";

grant delete on table "public"."documento_conductor_transiciones" to "service_role";

grant insert on table "public"."documento_conductor_transiciones" to "service_role";

grant select on table "public"."documento_conductor_transiciones" to "service_role";

grant update on table "public"."documento_conductor_transiciones" to "service_role";

grant delete on table "public"."documentos_conductor" to "anon";

grant insert on table "public"."documentos_conductor" to "anon";

grant select on table "public"."documentos_conductor" to "anon";

grant update on table "public"."documentos_conductor" to "anon";

grant delete on table "public"."documentos_conductor" to "authenticated";

grant update on table "public"."documentos_conductor" to "authenticated";

grant delete on table "public"."documentos_conductor" to "mi_rol_admin";

grant insert on table "public"."documentos_conductor" to "mi_rol_admin";

grant references on table "public"."documentos_conductor" to "mi_rol_admin";

grant select on table "public"."documentos_conductor" to "mi_rol_admin";

grant trigger on table "public"."documentos_conductor" to "mi_rol_admin";

grant truncate on table "public"."documentos_conductor" to "mi_rol_admin";

grant update on table "public"."documentos_conductor" to "mi_rol_admin";

grant delete on table "public"."documentos_identidad_storage_validados" to "mi_rol_admin";

grant insert on table "public"."documentos_identidad_storage_validados" to "mi_rol_admin";

grant references on table "public"."documentos_identidad_storage_validados" to "mi_rol_admin";

grant select on table "public"."documentos_identidad_storage_validados" to "mi_rol_admin";

grant trigger on table "public"."documentos_identidad_storage_validados" to "mi_rol_admin";

grant truncate on table "public"."documentos_identidad_storage_validados" to "mi_rol_admin";

grant update on table "public"."documentos_identidad_storage_validados" to "mi_rol_admin";

grant delete on table "public"."documentos_identidad_usuario" to "mi_rol_admin";

grant insert on table "public"."documentos_identidad_usuario" to "mi_rol_admin";

grant references on table "public"."documentos_identidad_usuario" to "mi_rol_admin";

grant select on table "public"."documentos_identidad_usuario" to "mi_rol_admin";

grant trigger on table "public"."documentos_identidad_usuario" to "mi_rol_admin";

grant truncate on table "public"."documentos_identidad_usuario" to "mi_rol_admin";

grant update on table "public"."documentos_identidad_usuario" to "mi_rol_admin";

grant delete on table "public"."documentos_identidad_usuario" to "service_role";

grant insert on table "public"."documentos_identidad_usuario" to "service_role";

grant delete on table "public"."documentos_storage_validados" to "mi_rol_admin";

grant insert on table "public"."documentos_storage_validados" to "mi_rol_admin";

grant references on table "public"."documentos_storage_validados" to "mi_rol_admin";

grant select on table "public"."documentos_storage_validados" to "mi_rol_admin";

grant trigger on table "public"."documentos_storage_validados" to "mi_rol_admin";

grant truncate on table "public"."documentos_storage_validados" to "mi_rol_admin";

grant update on table "public"."documentos_storage_validados" to "mi_rol_admin";

grant delete on table "public"."empresas" to "anon";

grant insert on table "public"."empresas" to "anon";

grant select on table "public"."empresas" to "anon";

grant update on table "public"."empresas" to "anon";

grant delete on table "public"."empresas" to "authenticated";

grant insert on table "public"."empresas" to "authenticated";

grant delete on table "public"."empresas" to "mi_rol_admin";

grant insert on table "public"."empresas" to "mi_rol_admin";

grant references on table "public"."empresas" to "mi_rol_admin";

grant select on table "public"."empresas" to "mi_rol_admin";

grant trigger on table "public"."empresas" to "mi_rol_admin";

grant truncate on table "public"."empresas" to "mi_rol_admin";

grant update on table "public"."empresas" to "mi_rol_admin";

grant delete on table "public"."empresas" to "service_role";

grant insert on table "public"."empresas" to "service_role";

grant select on table "public"."empresas" to "service_role";

grant update on table "public"."empresas" to "service_role";

grant delete on table "public"."empresas_cambios_sensibles" to "anon";

grant insert on table "public"."empresas_cambios_sensibles" to "anon";

grant select on table "public"."empresas_cambios_sensibles" to "anon";

grant update on table "public"."empresas_cambios_sensibles" to "anon";

grant delete on table "public"."empresas_cambios_sensibles" to "authenticated";

grant insert on table "public"."empresas_cambios_sensibles" to "authenticated";

grant update on table "public"."empresas_cambios_sensibles" to "authenticated";

grant delete on table "public"."empresas_cambios_sensibles" to "service_role";

grant insert on table "public"."empresas_cambios_sensibles" to "service_role";

grant select on table "public"."empresas_cambios_sensibles" to "service_role";

grant update on table "public"."empresas_cambios_sensibles" to "service_role";

grant delete on table "public"."empresas_condiciones_comerciales_versiones" to "anon";

grant insert on table "public"."empresas_condiciones_comerciales_versiones" to "anon";

grant select on table "public"."empresas_condiciones_comerciales_versiones" to "anon";

grant update on table "public"."empresas_condiciones_comerciales_versiones" to "anon";

grant delete on table "public"."empresas_condiciones_comerciales_versiones" to "authenticated";

grant insert on table "public"."empresas_condiciones_comerciales_versiones" to "authenticated";

grant update on table "public"."empresas_condiciones_comerciales_versiones" to "authenticated";

grant delete on table "public"."empresas_condiciones_comerciales_versiones" to "service_role";

grant insert on table "public"."empresas_condiciones_comerciales_versiones" to "service_role";

grant select on table "public"."empresas_condiciones_comerciales_versiones" to "service_role";

grant update on table "public"."empresas_condiciones_comerciales_versiones" to "service_role";

grant delete on table "public"."empresas_datos_fiscales_versiones" to "anon";

grant insert on table "public"."empresas_datos_fiscales_versiones" to "anon";

grant select on table "public"."empresas_datos_fiscales_versiones" to "anon";

grant update on table "public"."empresas_datos_fiscales_versiones" to "anon";

grant delete on table "public"."empresas_datos_fiscales_versiones" to "authenticated";

grant insert on table "public"."empresas_datos_fiscales_versiones" to "authenticated";

grant update on table "public"."empresas_datos_fiscales_versiones" to "authenticated";

grant delete on table "public"."empresas_datos_fiscales_versiones" to "service_role";

grant insert on table "public"."empresas_datos_fiscales_versiones" to "service_role";

grant select on table "public"."empresas_datos_fiscales_versiones" to "service_role";

grant update on table "public"."empresas_datos_fiscales_versiones" to "service_role";

grant delete on table "public"."empresas_documentos" to "anon";

grant insert on table "public"."empresas_documentos" to "anon";

grant select on table "public"."empresas_documentos" to "anon";

grant update on table "public"."empresas_documentos" to "anon";

grant delete on table "public"."empresas_documentos" to "authenticated";

grant insert on table "public"."empresas_documentos" to "authenticated";

grant update on table "public"."empresas_documentos" to "authenticated";

grant delete on table "public"."empresas_documentos" to "service_role";

grant insert on table "public"."empresas_documentos" to "service_role";

grant select on table "public"."empresas_documentos" to "service_role";

grant update on table "public"."empresas_documentos" to "service_role";

grant delete on table "public"."estado_transiciones_validas" to "anon";

grant insert on table "public"."estado_transiciones_validas" to "anon";

grant select on table "public"."estado_transiciones_validas" to "anon";

grant update on table "public"."estado_transiciones_validas" to "anon";

grant delete on table "public"."estado_transiciones_validas" to "authenticated";

grant insert on table "public"."estado_transiciones_validas" to "authenticated";

grant select on table "public"."estado_transiciones_validas" to "authenticated";

grant update on table "public"."estado_transiciones_validas" to "authenticated";

grant delete on table "public"."estado_transiciones_validas" to "mi_rol_admin";

grant insert on table "public"."estado_transiciones_validas" to "mi_rol_admin";

grant references on table "public"."estado_transiciones_validas" to "mi_rol_admin";

grant select on table "public"."estado_transiciones_validas" to "mi_rol_admin";

grant trigger on table "public"."estado_transiciones_validas" to "mi_rol_admin";

grant truncate on table "public"."estado_transiciones_validas" to "mi_rol_admin";

grant update on table "public"."estado_transiciones_validas" to "mi_rol_admin";

grant delete on table "public"."estado_transiciones_validas" to "service_role";

grant insert on table "public"."estado_transiciones_validas" to "service_role";

grant select on table "public"."estado_transiciones_validas" to "service_role";

grant update on table "public"."estado_transiciones_validas" to "service_role";

grant delete on table "public"."eventos_observabilidad" to "mi_rol_admin";

grant insert on table "public"."eventos_observabilidad" to "mi_rol_admin";

grant references on table "public"."eventos_observabilidad" to "mi_rol_admin";

grant select on table "public"."eventos_observabilidad" to "mi_rol_admin";

grant trigger on table "public"."eventos_observabilidad" to "mi_rol_admin";

grant truncate on table "public"."eventos_observabilidad" to "mi_rol_admin";

grant update on table "public"."eventos_observabilidad" to "mi_rol_admin";

grant delete on table "public"."eventos_observabilidad" to "service_role";

grant insert on table "public"."eventos_observabilidad" to "service_role";

grant select on table "public"."eventos_observabilidad" to "service_role";

grant update on table "public"."eventos_observabilidad" to "service_role";

grant delete on table "public"."eventos_operativos_app" to "anon";

grant insert on table "public"."eventos_operativos_app" to "anon";

grant select on table "public"."eventos_operativos_app" to "anon";

grant update on table "public"."eventos_operativos_app" to "anon";

grant delete on table "public"."eventos_operativos_app" to "authenticated";

grant insert on table "public"."eventos_operativos_app" to "authenticated";

grant select on table "public"."eventos_operativos_app" to "authenticated";

grant update on table "public"."eventos_operativos_app" to "authenticated";

grant delete on table "public"."eventos_operativos_app" to "mi_rol_admin";

grant insert on table "public"."eventos_operativos_app" to "mi_rol_admin";

grant references on table "public"."eventos_operativos_app" to "mi_rol_admin";

grant select on table "public"."eventos_operativos_app" to "mi_rol_admin";

grant trigger on table "public"."eventos_operativos_app" to "mi_rol_admin";

grant truncate on table "public"."eventos_operativos_app" to "mi_rol_admin";

grant update on table "public"."eventos_operativos_app" to "mi_rol_admin";

grant delete on table "public"."eventos_operativos_app" to "service_role";

grant insert on table "public"."eventos_operativos_app" to "service_role";

grant select on table "public"."eventos_operativos_app" to "service_role";

grant update on table "public"."eventos_operativos_app" to "service_role";

grant delete on table "public"."eventos_registro_conductor" to "mi_rol_admin";

grant insert on table "public"."eventos_registro_conductor" to "mi_rol_admin";

grant references on table "public"."eventos_registro_conductor" to "mi_rol_admin";

grant select on table "public"."eventos_registro_conductor" to "mi_rol_admin";

grant trigger on table "public"."eventos_registro_conductor" to "mi_rol_admin";

grant truncate on table "public"."eventos_registro_conductor" to "mi_rol_admin";

grant update on table "public"."eventos_registro_conductor" to "mi_rol_admin";

grant delete on table "public"."evidencia_fotos" to "anon";

grant insert on table "public"."evidencia_fotos" to "anon";

grant select on table "public"."evidencia_fotos" to "anon";

grant update on table "public"."evidencia_fotos" to "anon";

grant delete on table "public"."evidencia_fotos" to "authenticated";

grant insert on table "public"."evidencia_fotos" to "authenticated";

grant update on table "public"."evidencia_fotos" to "authenticated";

grant delete on table "public"."evidencia_fotos" to "mi_rol_admin";

grant insert on table "public"."evidencia_fotos" to "mi_rol_admin";

grant references on table "public"."evidencia_fotos" to "mi_rol_admin";

grant select on table "public"."evidencia_fotos" to "mi_rol_admin";

grant trigger on table "public"."evidencia_fotos" to "mi_rol_admin";

grant truncate on table "public"."evidencia_fotos" to "mi_rol_admin";

grant update on table "public"."evidencia_fotos" to "mi_rol_admin";

grant delete on table "public"."evidencia_fotos" to "service_role";

grant insert on table "public"."evidencia_fotos" to "service_role";

grant select on table "public"."evidencia_fotos" to "service_role";

grant update on table "public"."evidencia_fotos" to "service_role";

grant delete on table "public"."evidencia_inspecciones" to "anon";

grant insert on table "public"."evidencia_inspecciones" to "anon";

grant select on table "public"."evidencia_inspecciones" to "anon";

grant update on table "public"."evidencia_inspecciones" to "anon";

grant delete on table "public"."evidencia_inspecciones" to "authenticated";

grant insert on table "public"."evidencia_inspecciones" to "authenticated";

grant select on table "public"."evidencia_inspecciones" to "authenticated";

grant update on table "public"."evidencia_inspecciones" to "authenticated";

grant delete on table "public"."evidencia_inspecciones" to "mi_rol_admin";

grant insert on table "public"."evidencia_inspecciones" to "mi_rol_admin";

grant references on table "public"."evidencia_inspecciones" to "mi_rol_admin";

grant select on table "public"."evidencia_inspecciones" to "mi_rol_admin";

grant trigger on table "public"."evidencia_inspecciones" to "mi_rol_admin";

grant truncate on table "public"."evidencia_inspecciones" to "mi_rol_admin";

grant update on table "public"."evidencia_inspecciones" to "mi_rol_admin";

grant delete on table "public"."evidencia_inspecciones" to "service_role";

grant insert on table "public"."evidencia_inspecciones" to "service_role";

grant select on table "public"."evidencia_inspecciones" to "service_role";

grant update on table "public"."evidencia_inspecciones" to "service_role";

grant delete on table "public"."expediente_conductor_transiciones" to "anon";

grant insert on table "public"."expediente_conductor_transiciones" to "anon";

grant select on table "public"."expediente_conductor_transiciones" to "anon";

grant update on table "public"."expediente_conductor_transiciones" to "anon";

grant delete on table "public"."expediente_conductor_transiciones" to "authenticated";

grant insert on table "public"."expediente_conductor_transiciones" to "authenticated";

grant update on table "public"."expediente_conductor_transiciones" to "authenticated";

grant delete on table "public"."expediente_conductor_transiciones" to "mi_rol_admin";

grant insert on table "public"."expediente_conductor_transiciones" to "mi_rol_admin";

grant references on table "public"."expediente_conductor_transiciones" to "mi_rol_admin";

grant select on table "public"."expediente_conductor_transiciones" to "mi_rol_admin";

grant trigger on table "public"."expediente_conductor_transiciones" to "mi_rol_admin";

grant truncate on table "public"."expediente_conductor_transiciones" to "mi_rol_admin";

grant update on table "public"."expediente_conductor_transiciones" to "mi_rol_admin";

grant delete on table "public"."expediente_conductor_transiciones" to "service_role";

grant insert on table "public"."expediente_conductor_transiciones" to "service_role";

grant select on table "public"."expediente_conductor_transiciones" to "service_role";

grant update on table "public"."expediente_conductor_transiciones" to "service_role";

grant delete on table "public"."exportaciones_admin" to "anon";

grant insert on table "public"."exportaciones_admin" to "anon";

grant select on table "public"."exportaciones_admin" to "anon";

grant update on table "public"."exportaciones_admin" to "anon";

grant delete on table "public"."exportaciones_admin" to "authenticated";

grant insert on table "public"."exportaciones_admin" to "authenticated";

grant select on table "public"."exportaciones_admin" to "authenticated";

grant update on table "public"."exportaciones_admin" to "authenticated";

grant delete on table "public"."exportaciones_admin" to "mi_rol_admin";

grant insert on table "public"."exportaciones_admin" to "mi_rol_admin";

grant references on table "public"."exportaciones_admin" to "mi_rol_admin";

grant select on table "public"."exportaciones_admin" to "mi_rol_admin";

grant trigger on table "public"."exportaciones_admin" to "mi_rol_admin";

grant truncate on table "public"."exportaciones_admin" to "mi_rol_admin";

grant update on table "public"."exportaciones_admin" to "mi_rol_admin";

grant delete on table "public"."exportaciones_admin" to "service_role";

grant insert on table "public"."exportaciones_admin" to "service_role";

grant select on table "public"."exportaciones_admin" to "service_role";

grant update on table "public"."exportaciones_admin" to "service_role";

grant delete on table "public"."feature_flags_app" to "anon";

grant insert on table "public"."feature_flags_app" to "anon";

grant select on table "public"."feature_flags_app" to "anon";

grant update on table "public"."feature_flags_app" to "anon";

grant delete on table "public"."feature_flags_app" to "authenticated";

grant insert on table "public"."feature_flags_app" to "authenticated";

grant select on table "public"."feature_flags_app" to "authenticated";

grant update on table "public"."feature_flags_app" to "authenticated";

grant delete on table "public"."feature_flags_app" to "mi_rol_admin";

grant insert on table "public"."feature_flags_app" to "mi_rol_admin";

grant references on table "public"."feature_flags_app" to "mi_rol_admin";

grant select on table "public"."feature_flags_app" to "mi_rol_admin";

grant trigger on table "public"."feature_flags_app" to "mi_rol_admin";

grant truncate on table "public"."feature_flags_app" to "mi_rol_admin";

grant update on table "public"."feature_flags_app" to "mi_rol_admin";

grant delete on table "public"."feature_flags_app" to "service_role";

grant insert on table "public"."feature_flags_app" to "service_role";

grant select on table "public"."feature_flags_app" to "service_role";

grant update on table "public"."feature_flags_app" to "service_role";

grant delete on table "public"."filas_carga_traslados_masivos" to "anon";

grant insert on table "public"."filas_carga_traslados_masivos" to "anon";

grant select on table "public"."filas_carga_traslados_masivos" to "anon";

grant update on table "public"."filas_carga_traslados_masivos" to "anon";

grant delete on table "public"."filas_carga_traslados_masivos" to "authenticated";

grant insert on table "public"."filas_carga_traslados_masivos" to "authenticated";

grant update on table "public"."filas_carga_traslados_masivos" to "authenticated";

grant delete on table "public"."filas_carga_traslados_masivos" to "mi_rol_admin";

grant insert on table "public"."filas_carga_traslados_masivos" to "mi_rol_admin";

grant references on table "public"."filas_carga_traslados_masivos" to "mi_rol_admin";

grant select on table "public"."filas_carga_traslados_masivos" to "mi_rol_admin";

grant trigger on table "public"."filas_carga_traslados_masivos" to "mi_rol_admin";

grant truncate on table "public"."filas_carga_traslados_masivos" to "mi_rol_admin";

grant update on table "public"."filas_carga_traslados_masivos" to "mi_rol_admin";

grant delete on table "public"."filas_carga_traslados_masivos" to "service_role";

grant insert on table "public"."filas_carga_traslados_masivos" to "service_role";

grant select on table "public"."filas_carga_traslados_masivos" to "service_role";

grant update on table "public"."filas_carga_traslados_masivos" to "service_role";

grant delete on table "public"."gastos_traslado" to "anon";

grant insert on table "public"."gastos_traslado" to "anon";

grant select on table "public"."gastos_traslado" to "anon";

grant update on table "public"."gastos_traslado" to "anon";

grant delete on table "public"."gastos_traslado" to "authenticated";

grant insert on table "public"."gastos_traslado" to "authenticated";

grant select on table "public"."gastos_traslado" to "authenticated";

grant update on table "public"."gastos_traslado" to "authenticated";

grant delete on table "public"."gastos_traslado" to "service_role";

grant insert on table "public"."gastos_traslado" to "service_role";

grant select on table "public"."gastos_traslado" to "service_role";

grant update on table "public"."gastos_traslado" to "service_role";

grant delete on table "public"."historial_estados_solicitud_conductor" to "mi_rol_admin";

grant insert on table "public"."historial_estados_solicitud_conductor" to "mi_rol_admin";

grant references on table "public"."historial_estados_solicitud_conductor" to "mi_rol_admin";

grant select on table "public"."historial_estados_solicitud_conductor" to "mi_rol_admin";

grant trigger on table "public"."historial_estados_solicitud_conductor" to "mi_rol_admin";

grant truncate on table "public"."historial_estados_solicitud_conductor" to "mi_rol_admin";

grant update on table "public"."historial_estados_solicitud_conductor" to "mi_rol_admin";

grant delete on table "public"."incidencias" to "anon";

grant insert on table "public"."incidencias" to "anon";

grant select on table "public"."incidencias" to "anon";

grant update on table "public"."incidencias" to "anon";

grant delete on table "public"."incidencias" to "authenticated";

grant insert on table "public"."incidencias" to "authenticated";

grant update on table "public"."incidencias" to "authenticated";

grant delete on table "public"."incidencias" to "mi_rol_admin";

grant insert on table "public"."incidencias" to "mi_rol_admin";

grant references on table "public"."incidencias" to "mi_rol_admin";

grant select on table "public"."incidencias" to "mi_rol_admin";

grant trigger on table "public"."incidencias" to "mi_rol_admin";

grant truncate on table "public"."incidencias" to "mi_rol_admin";

grant update on table "public"."incidencias" to "mi_rol_admin";

grant delete on table "public"."incidencias" to "service_role";

grant insert on table "public"."incidencias" to "service_role";

grant select on table "public"."incidencias" to "service_role";

grant update on table "public"."incidencias" to "service_role";

grant delete on table "public"."llamadas_enmascaradas" to "anon";

grant insert on table "public"."llamadas_enmascaradas" to "anon";

grant select on table "public"."llamadas_enmascaradas" to "anon";

grant update on table "public"."llamadas_enmascaradas" to "anon";

grant delete on table "public"."llamadas_enmascaradas" to "authenticated";

grant insert on table "public"."llamadas_enmascaradas" to "authenticated";

grant select on table "public"."llamadas_enmascaradas" to "authenticated";

grant update on table "public"."llamadas_enmascaradas" to "authenticated";

grant delete on table "public"."llamadas_enmascaradas" to "mi_rol_admin";

grant insert on table "public"."llamadas_enmascaradas" to "mi_rol_admin";

grant references on table "public"."llamadas_enmascaradas" to "mi_rol_admin";

grant select on table "public"."llamadas_enmascaradas" to "mi_rol_admin";

grant trigger on table "public"."llamadas_enmascaradas" to "mi_rol_admin";

grant truncate on table "public"."llamadas_enmascaradas" to "mi_rol_admin";

grant update on table "public"."llamadas_enmascaradas" to "mi_rol_admin";

grant delete on table "public"."llamadas_enmascaradas" to "service_role";

grant insert on table "public"."llamadas_enmascaradas" to "service_role";

grant select on table "public"."llamadas_enmascaradas" to "service_role";

grant update on table "public"."llamadas_enmascaradas" to "service_role";

grant delete on table "public"."mensajes_chat" to "anon";

grant insert on table "public"."mensajes_chat" to "anon";

grant select on table "public"."mensajes_chat" to "anon";

grant update on table "public"."mensajes_chat" to "anon";

grant delete on table "public"."mensajes_chat" to "authenticated";

grant insert on table "public"."mensajes_chat" to "authenticated";

grant select on table "public"."mensajes_chat" to "authenticated";

grant update on table "public"."mensajes_chat" to "authenticated";

grant delete on table "public"."mensajes_chat" to "mi_rol_admin";

grant insert on table "public"."mensajes_chat" to "mi_rol_admin";

grant references on table "public"."mensajes_chat" to "mi_rol_admin";

grant select on table "public"."mensajes_chat" to "mi_rol_admin";

grant trigger on table "public"."mensajes_chat" to "mi_rol_admin";

grant truncate on table "public"."mensajes_chat" to "mi_rol_admin";

grant update on table "public"."mensajes_chat" to "mi_rol_admin";

grant delete on table "public"."mensajes_chat" to "service_role";

grant insert on table "public"."mensajes_chat" to "service_role";

grant select on table "public"."mensajes_chat" to "service_role";

grant update on table "public"."mensajes_chat" to "service_role";

grant delete on table "public"."metas_registro_conductor" to "anon";

grant insert on table "public"."metas_registro_conductor" to "anon";

grant select on table "public"."metas_registro_conductor" to "anon";

grant update on table "public"."metas_registro_conductor" to "anon";

grant delete on table "public"."metas_registro_conductor" to "authenticated";

grant insert on table "public"."metas_registro_conductor" to "authenticated";

grant update on table "public"."metas_registro_conductor" to "authenticated";

grant delete on table "public"."metas_registro_conductor" to "service_role";

grant insert on table "public"."metas_registro_conductor" to "service_role";

grant select on table "public"."metas_registro_conductor" to "service_role";

grant update on table "public"."metas_registro_conductor" to "service_role";

grant delete on table "public"."modo_prueba_supervisada" to "anon";

grant insert on table "public"."modo_prueba_supervisada" to "anon";

grant select on table "public"."modo_prueba_supervisada" to "anon";

grant update on table "public"."modo_prueba_supervisada" to "anon";

grant delete on table "public"."modo_prueba_supervisada" to "authenticated";

grant insert on table "public"."modo_prueba_supervisada" to "authenticated";

grant select on table "public"."modo_prueba_supervisada" to "authenticated";

grant update on table "public"."modo_prueba_supervisada" to "authenticated";

grant delete on table "public"."modo_prueba_supervisada" to "mi_rol_admin";

grant insert on table "public"."modo_prueba_supervisada" to "mi_rol_admin";

grant references on table "public"."modo_prueba_supervisada" to "mi_rol_admin";

grant select on table "public"."modo_prueba_supervisada" to "mi_rol_admin";

grant trigger on table "public"."modo_prueba_supervisada" to "mi_rol_admin";

grant truncate on table "public"."modo_prueba_supervisada" to "mi_rol_admin";

grant update on table "public"."modo_prueba_supervisada" to "mi_rol_admin";

grant delete on table "public"."modo_prueba_supervisada" to "service_role";

grant insert on table "public"."modo_prueba_supervisada" to "service_role";

grant select on table "public"."modo_prueba_supervisada" to "service_role";

grant update on table "public"."modo_prueba_supervisada" to "service_role";

grant delete on table "public"."notas_internas_traslado" to "anon";

grant insert on table "public"."notas_internas_traslado" to "anon";

grant select on table "public"."notas_internas_traslado" to "anon";

grant update on table "public"."notas_internas_traslado" to "anon";

grant delete on table "public"."notas_internas_traslado" to "authenticated";

grant insert on table "public"."notas_internas_traslado" to "authenticated";

grant select on table "public"."notas_internas_traslado" to "authenticated";

grant update on table "public"."notas_internas_traslado" to "authenticated";

grant delete on table "public"."notas_internas_traslado" to "mi_rol_admin";

grant insert on table "public"."notas_internas_traslado" to "mi_rol_admin";

grant references on table "public"."notas_internas_traslado" to "mi_rol_admin";

grant select on table "public"."notas_internas_traslado" to "mi_rol_admin";

grant trigger on table "public"."notas_internas_traslado" to "mi_rol_admin";

grant truncate on table "public"."notas_internas_traslado" to "mi_rol_admin";

grant update on table "public"."notas_internas_traslado" to "mi_rol_admin";

grant delete on table "public"."notas_internas_traslado" to "service_role";

grant insert on table "public"."notas_internas_traslado" to "service_role";

grant select on table "public"."notas_internas_traslado" to "service_role";

grant update on table "public"."notas_internas_traslado" to "service_role";

grant delete on table "public"."notificaciones_admin_operativas" to "anon";

grant insert on table "public"."notificaciones_admin_operativas" to "anon";

grant select on table "public"."notificaciones_admin_operativas" to "anon";

grant update on table "public"."notificaciones_admin_operativas" to "anon";

grant delete on table "public"."notificaciones_admin_operativas" to "authenticated";

grant insert on table "public"."notificaciones_admin_operativas" to "authenticated";

grant update on table "public"."notificaciones_admin_operativas" to "authenticated";

grant delete on table "public"."notificaciones_admin_operativas" to "service_role";

grant insert on table "public"."notificaciones_admin_operativas" to "service_role";

grant select on table "public"."notificaciones_admin_operativas" to "service_role";

grant update on table "public"."notificaciones_admin_operativas" to "service_role";

grant delete on table "public"."notificaciones_conductor" to "anon";

grant insert on table "public"."notificaciones_conductor" to "anon";

grant select on table "public"."notificaciones_conductor" to "anon";

grant update on table "public"."notificaciones_conductor" to "anon";

grant delete on table "public"."notificaciones_conductor" to "authenticated";

grant insert on table "public"."notificaciones_conductor" to "authenticated";

grant select on table "public"."notificaciones_conductor" to "authenticated";

grant update on table "public"."notificaciones_conductor" to "authenticated";

grant delete on table "public"."notificaciones_conductor" to "mi_rol_admin";

grant insert on table "public"."notificaciones_conductor" to "mi_rol_admin";

grant references on table "public"."notificaciones_conductor" to "mi_rol_admin";

grant select on table "public"."notificaciones_conductor" to "mi_rol_admin";

grant trigger on table "public"."notificaciones_conductor" to "mi_rol_admin";

grant truncate on table "public"."notificaciones_conductor" to "mi_rol_admin";

grant update on table "public"."notificaciones_conductor" to "mi_rol_admin";

grant delete on table "public"."notificaciones_conductor" to "service_role";

grant insert on table "public"."notificaciones_conductor" to "service_role";

grant select on table "public"."notificaciones_conductor" to "service_role";

grant update on table "public"."notificaciones_conductor" to "service_role";

grant delete on table "public"."notificaciones_push_entregas" to "anon";

grant insert on table "public"."notificaciones_push_entregas" to "anon";

grant select on table "public"."notificaciones_push_entregas" to "anon";

grant update on table "public"."notificaciones_push_entregas" to "anon";

grant delete on table "public"."notificaciones_push_entregas" to "authenticated";

grant insert on table "public"."notificaciones_push_entregas" to "authenticated";

grant select on table "public"."notificaciones_push_entregas" to "authenticated";

grant update on table "public"."notificaciones_push_entregas" to "authenticated";

grant delete on table "public"."notificaciones_push_entregas" to "mi_rol_admin";

grant insert on table "public"."notificaciones_push_entregas" to "mi_rol_admin";

grant references on table "public"."notificaciones_push_entregas" to "mi_rol_admin";

grant select on table "public"."notificaciones_push_entregas" to "mi_rol_admin";

grant trigger on table "public"."notificaciones_push_entregas" to "mi_rol_admin";

grant truncate on table "public"."notificaciones_push_entregas" to "mi_rol_admin";

grant update on table "public"."notificaciones_push_entregas" to "mi_rol_admin";

grant delete on table "public"."notificaciones_push_entregas" to "service_role";

grant insert on table "public"."notificaciones_push_entregas" to "service_role";

grant select on table "public"."notificaciones_push_entregas" to "service_role";

grant update on table "public"."notificaciones_push_entregas" to "service_role";

grant delete on table "public"."pagos" to "anon";

grant insert on table "public"."pagos" to "anon";

grant select on table "public"."pagos" to "anon";

grant update on table "public"."pagos" to "anon";

grant delete on table "public"."pagos" to "authenticated";

grant insert on table "public"."pagos" to "authenticated";

grant update on table "public"."pagos" to "authenticated";

grant delete on table "public"."pagos" to "mi_rol_admin";

grant insert on table "public"."pagos" to "mi_rol_admin";

grant references on table "public"."pagos" to "mi_rol_admin";

grant select on table "public"."pagos" to "mi_rol_admin";

grant trigger on table "public"."pagos" to "mi_rol_admin";

grant truncate on table "public"."pagos" to "mi_rol_admin";

grant update on table "public"."pagos" to "mi_rol_admin";

grant delete on table "public"."pagos" to "service_role";

grant insert on table "public"."pagos" to "service_role";

grant select on table "public"."pagos" to "service_role";

grant update on table "public"."pagos" to "service_role";

grant delete on table "public"."payouts_conductor" to "anon";

grant insert on table "public"."payouts_conductor" to "anon";

grant select on table "public"."payouts_conductor" to "anon";

grant update on table "public"."payouts_conductor" to "anon";

grant delete on table "public"."payouts_conductor" to "authenticated";

grant insert on table "public"."payouts_conductor" to "authenticated";

grant select on table "public"."payouts_conductor" to "authenticated";

grant update on table "public"."payouts_conductor" to "authenticated";

grant delete on table "public"."payouts_conductor" to "mi_rol_admin";

grant insert on table "public"."payouts_conductor" to "mi_rol_admin";

grant references on table "public"."payouts_conductor" to "mi_rol_admin";

grant select on table "public"."payouts_conductor" to "mi_rol_admin";

grant trigger on table "public"."payouts_conductor" to "mi_rol_admin";

grant truncate on table "public"."payouts_conductor" to "mi_rol_admin";

grant update on table "public"."payouts_conductor" to "mi_rol_admin";

grant delete on table "public"."payouts_conductor" to "service_role";

grant insert on table "public"."payouts_conductor" to "service_role";

grant select on table "public"."payouts_conductor" to "service_role";

grant update on table "public"."payouts_conductor" to "service_role";

grant delete on table "public"."politicas_version_app" to "anon";

grant insert on table "public"."politicas_version_app" to "anon";

grant select on table "public"."politicas_version_app" to "anon";

grant update on table "public"."politicas_version_app" to "anon";

grant delete on table "public"."politicas_version_app" to "authenticated";

grant insert on table "public"."politicas_version_app" to "authenticated";

grant select on table "public"."politicas_version_app" to "authenticated";

grant update on table "public"."politicas_version_app" to "authenticated";

grant delete on table "public"."politicas_version_app" to "mi_rol_admin";

grant insert on table "public"."politicas_version_app" to "mi_rol_admin";

grant references on table "public"."politicas_version_app" to "mi_rol_admin";

grant select on table "public"."politicas_version_app" to "mi_rol_admin";

grant trigger on table "public"."politicas_version_app" to "mi_rol_admin";

grant truncate on table "public"."politicas_version_app" to "mi_rol_admin";

grant update on table "public"."politicas_version_app" to "mi_rol_admin";

grant delete on table "public"."politicas_version_app" to "service_role";

grant insert on table "public"."politicas_version_app" to "service_role";

grant select on table "public"."politicas_version_app" to "service_role";

grant update on table "public"."politicas_version_app" to "service_role";

grant delete on table "public"."preferencias_admin" to "anon";

grant insert on table "public"."preferencias_admin" to "anon";

grant select on table "public"."preferencias_admin" to "anon";

grant update on table "public"."preferencias_admin" to "anon";

grant delete on table "public"."preferencias_admin" to "authenticated";

grant insert on table "public"."preferencias_admin" to "authenticated";

grant select on table "public"."preferencias_admin" to "authenticated";

grant update on table "public"."preferencias_admin" to "authenticated";

grant delete on table "public"."preferencias_admin" to "mi_rol_admin";

grant insert on table "public"."preferencias_admin" to "mi_rol_admin";

grant references on table "public"."preferencias_admin" to "mi_rol_admin";

grant select on table "public"."preferencias_admin" to "mi_rol_admin";

grant trigger on table "public"."preferencias_admin" to "mi_rol_admin";

grant truncate on table "public"."preferencias_admin" to "mi_rol_admin";

grant update on table "public"."preferencias_admin" to "mi_rol_admin";

grant delete on table "public"."preferencias_admin" to "service_role";

grant insert on table "public"."preferencias_admin" to "service_role";

grant select on table "public"."preferencias_admin" to "service_role";

grant update on table "public"."preferencias_admin" to "service_role";

grant delete on table "public"."preferencias_conductor" to "anon";

grant insert on table "public"."preferencias_conductor" to "anon";

grant select on table "public"."preferencias_conductor" to "anon";

grant update on table "public"."preferencias_conductor" to "anon";

grant delete on table "public"."preferencias_conductor" to "authenticated";

grant insert on table "public"."preferencias_conductor" to "authenticated";

grant select on table "public"."preferencias_conductor" to "authenticated";

grant update on table "public"."preferencias_conductor" to "authenticated";

grant delete on table "public"."preferencias_conductor" to "mi_rol_admin";

grant insert on table "public"."preferencias_conductor" to "mi_rol_admin";

grant references on table "public"."preferencias_conductor" to "mi_rol_admin";

grant select on table "public"."preferencias_conductor" to "mi_rol_admin";

grant trigger on table "public"."preferencias_conductor" to "mi_rol_admin";

grant truncate on table "public"."preferencias_conductor" to "mi_rol_admin";

grant update on table "public"."preferencias_conductor" to "mi_rol_admin";

grant delete on table "public"."preferencias_conductor" to "service_role";

grant insert on table "public"."preferencias_conductor" to "service_role";

grant select on table "public"."preferencias_conductor" to "service_role";

grant update on table "public"."preferencias_conductor" to "service_role";

grant delete on table "public"."reclamos_seguro" to "anon";

grant insert on table "public"."reclamos_seguro" to "anon";

grant select on table "public"."reclamos_seguro" to "anon";

grant update on table "public"."reclamos_seguro" to "anon";

grant delete on table "public"."reclamos_seguro" to "authenticated";

grant insert on table "public"."reclamos_seguro" to "authenticated";

grant select on table "public"."reclamos_seguro" to "authenticated";

grant update on table "public"."reclamos_seguro" to "authenticated";

grant delete on table "public"."reclamos_seguro" to "mi_rol_admin";

grant insert on table "public"."reclamos_seguro" to "mi_rol_admin";

grant references on table "public"."reclamos_seguro" to "mi_rol_admin";

grant select on table "public"."reclamos_seguro" to "mi_rol_admin";

grant trigger on table "public"."reclamos_seguro" to "mi_rol_admin";

grant truncate on table "public"."reclamos_seguro" to "mi_rol_admin";

grant update on table "public"."reclamos_seguro" to "mi_rol_admin";

grant delete on table "public"."reclamos_seguro" to "service_role";

grant insert on table "public"."reclamos_seguro" to "service_role";

grant select on table "public"."reclamos_seguro" to "service_role";

grant update on table "public"."reclamos_seguro" to "service_role";

grant delete on table "public"."registro_auditoria" to "anon";

grant insert on table "public"."registro_auditoria" to "anon";

grant select on table "public"."registro_auditoria" to "anon";

grant update on table "public"."registro_auditoria" to "anon";

grant delete on table "public"."registro_auditoria" to "authenticated";

grant insert on table "public"."registro_auditoria" to "authenticated";

grant select on table "public"."registro_auditoria" to "authenticated";

grant update on table "public"."registro_auditoria" to "authenticated";

grant delete on table "public"."registro_auditoria" to "mi_rol_admin";

grant insert on table "public"."registro_auditoria" to "mi_rol_admin";

grant references on table "public"."registro_auditoria" to "mi_rol_admin";

grant select on table "public"."registro_auditoria" to "mi_rol_admin";

grant trigger on table "public"."registro_auditoria" to "mi_rol_admin";

grant truncate on table "public"."registro_auditoria" to "mi_rol_admin";

grant update on table "public"."registro_auditoria" to "mi_rol_admin";

grant delete on table "public"."registro_auditoria" to "service_role";

grant insert on table "public"."registro_auditoria" to "service_role";

grant select on table "public"."registro_auditoria" to "service_role";

grant update on table "public"."registro_auditoria" to "service_role";

grant delete on table "public"."sesiones_proxy_traslado" to "anon";

grant insert on table "public"."sesiones_proxy_traslado" to "anon";

grant select on table "public"."sesiones_proxy_traslado" to "anon";

grant update on table "public"."sesiones_proxy_traslado" to "anon";

grant delete on table "public"."sesiones_proxy_traslado" to "authenticated";

grant insert on table "public"."sesiones_proxy_traslado" to "authenticated";

grant select on table "public"."sesiones_proxy_traslado" to "authenticated";

grant update on table "public"."sesiones_proxy_traslado" to "authenticated";

grant delete on table "public"."sesiones_proxy_traslado" to "mi_rol_admin";

grant insert on table "public"."sesiones_proxy_traslado" to "mi_rol_admin";

grant references on table "public"."sesiones_proxy_traslado" to "mi_rol_admin";

grant select on table "public"."sesiones_proxy_traslado" to "mi_rol_admin";

grant trigger on table "public"."sesiones_proxy_traslado" to "mi_rol_admin";

grant truncate on table "public"."sesiones_proxy_traslado" to "mi_rol_admin";

grant update on table "public"."sesiones_proxy_traslado" to "mi_rol_admin";

grant delete on table "public"."sesiones_proxy_traslado" to "service_role";

grant insert on table "public"."sesiones_proxy_traslado" to "service_role";

grant select on table "public"."sesiones_proxy_traslado" to "service_role";

grant update on table "public"."sesiones_proxy_traslado" to "service_role";

grant delete on table "public"."sla_reglas_operativas" to "anon";

grant insert on table "public"."sla_reglas_operativas" to "anon";

grant select on table "public"."sla_reglas_operativas" to "anon";

grant update on table "public"."sla_reglas_operativas" to "anon";

grant delete on table "public"."sla_reglas_operativas" to "authenticated";

grant insert on table "public"."sla_reglas_operativas" to "authenticated";

grant update on table "public"."sla_reglas_operativas" to "authenticated";

grant delete on table "public"."sla_reglas_operativas" to "service_role";

grant insert on table "public"."sla_reglas_operativas" to "service_role";

grant select on table "public"."sla_reglas_operativas" to "service_role";

grant update on table "public"."sla_reglas_operativas" to "service_role";

grant delete on table "public"."solicitudes_aprobacion_admin" to "anon";

grant insert on table "public"."solicitudes_aprobacion_admin" to "anon";

grant select on table "public"."solicitudes_aprobacion_admin" to "anon";

grant update on table "public"."solicitudes_aprobacion_admin" to "anon";

grant delete on table "public"."solicitudes_aprobacion_admin" to "authenticated";

grant insert on table "public"."solicitudes_aprobacion_admin" to "authenticated";

grant select on table "public"."solicitudes_aprobacion_admin" to "authenticated";

grant update on table "public"."solicitudes_aprobacion_admin" to "authenticated";

grant delete on table "public"."solicitudes_aprobacion_admin" to "mi_rol_admin";

grant insert on table "public"."solicitudes_aprobacion_admin" to "mi_rol_admin";

grant references on table "public"."solicitudes_aprobacion_admin" to "mi_rol_admin";

grant select on table "public"."solicitudes_aprobacion_admin" to "mi_rol_admin";

grant trigger on table "public"."solicitudes_aprobacion_admin" to "mi_rol_admin";

grant truncate on table "public"."solicitudes_aprobacion_admin" to "mi_rol_admin";

grant update on table "public"."solicitudes_aprobacion_admin" to "mi_rol_admin";

grant delete on table "public"."solicitudes_aprobacion_admin" to "service_role";

grant insert on table "public"."solicitudes_aprobacion_admin" to "service_role";

grant select on table "public"."solicitudes_aprobacion_admin" to "service_role";

grant update on table "public"."solicitudes_aprobacion_admin" to "service_role";

grant delete on table "public"."solicitudes_conductor" to "anon";

grant insert on table "public"."solicitudes_conductor" to "anon";

grant select on table "public"."solicitudes_conductor" to "anon";

grant update on table "public"."solicitudes_conductor" to "anon";

grant delete on table "public"."solicitudes_conductor" to "authenticated";

grant insert on table "public"."solicitudes_conductor" to "authenticated";

grant delete on table "public"."solicitudes_conductor" to "mi_rol_admin";

grant insert on table "public"."solicitudes_conductor" to "mi_rol_admin";

grant references on table "public"."solicitudes_conductor" to "mi_rol_admin";

grant select on table "public"."solicitudes_conductor" to "mi_rol_admin";

grant trigger on table "public"."solicitudes_conductor" to "mi_rol_admin";

grant truncate on table "public"."solicitudes_conductor" to "mi_rol_admin";

grant update on table "public"."solicitudes_conductor" to "mi_rol_admin";

grant delete on table "public"."tarifas_condicion" to "anon";

grant insert on table "public"."tarifas_condicion" to "anon";

grant select on table "public"."tarifas_condicion" to "anon";

grant update on table "public"."tarifas_condicion" to "anon";

grant delete on table "public"."tarifas_condicion" to "authenticated";

grant insert on table "public"."tarifas_condicion" to "authenticated";

grant select on table "public"."tarifas_condicion" to "authenticated";

grant update on table "public"."tarifas_condicion" to "authenticated";

grant delete on table "public"."tarifas_condicion" to "mi_rol_admin";

grant insert on table "public"."tarifas_condicion" to "mi_rol_admin";

grant references on table "public"."tarifas_condicion" to "mi_rol_admin";

grant select on table "public"."tarifas_condicion" to "mi_rol_admin";

grant trigger on table "public"."tarifas_condicion" to "mi_rol_admin";

grant truncate on table "public"."tarifas_condicion" to "mi_rol_admin";

grant update on table "public"."tarifas_condicion" to "mi_rol_admin";

grant delete on table "public"."tarifas_condicion" to "service_role";

grant insert on table "public"."tarifas_condicion" to "service_role";

grant select on table "public"."tarifas_condicion" to "service_role";

grant update on table "public"."tarifas_condicion" to "service_role";

grant delete on table "public"."tarifas_config" to "anon";

grant insert on table "public"."tarifas_config" to "anon";

grant select on table "public"."tarifas_config" to "anon";

grant update on table "public"."tarifas_config" to "anon";

grant delete on table "public"."tarifas_config" to "authenticated";

grant insert on table "public"."tarifas_config" to "authenticated";

grant select on table "public"."tarifas_config" to "authenticated";

grant update on table "public"."tarifas_config" to "authenticated";

grant delete on table "public"."tarifas_config" to "mi_rol_admin";

grant insert on table "public"."tarifas_config" to "mi_rol_admin";

grant references on table "public"."tarifas_config" to "mi_rol_admin";

grant select on table "public"."tarifas_config" to "mi_rol_admin";

grant trigger on table "public"."tarifas_config" to "mi_rol_admin";

grant truncate on table "public"."tarifas_config" to "mi_rol_admin";

grant update on table "public"."tarifas_config" to "mi_rol_admin";

grant delete on table "public"."tarifas_config" to "service_role";

grant insert on table "public"."tarifas_config" to "service_role";

grant select on table "public"."tarifas_config" to "service_role";

grant update on table "public"."tarifas_config" to "service_role";

grant delete on table "public"."tarifas_dia" to "anon";

grant insert on table "public"."tarifas_dia" to "anon";

grant select on table "public"."tarifas_dia" to "anon";

grant update on table "public"."tarifas_dia" to "anon";

grant delete on table "public"."tarifas_dia" to "authenticated";

grant insert on table "public"."tarifas_dia" to "authenticated";

grant select on table "public"."tarifas_dia" to "authenticated";

grant update on table "public"."tarifas_dia" to "authenticated";

grant delete on table "public"."tarifas_dia" to "mi_rol_admin";

grant insert on table "public"."tarifas_dia" to "mi_rol_admin";

grant references on table "public"."tarifas_dia" to "mi_rol_admin";

grant select on table "public"."tarifas_dia" to "mi_rol_admin";

grant trigger on table "public"."tarifas_dia" to "mi_rol_admin";

grant truncate on table "public"."tarifas_dia" to "mi_rol_admin";

grant update on table "public"."tarifas_dia" to "mi_rol_admin";

grant delete on table "public"."tarifas_dia" to "service_role";

grant insert on table "public"."tarifas_dia" to "service_role";

grant select on table "public"."tarifas_dia" to "service_role";

grant update on table "public"."tarifas_dia" to "service_role";

grant delete on table "public"."tarifas_gama" to "anon";

grant insert on table "public"."tarifas_gama" to "anon";

grant select on table "public"."tarifas_gama" to "anon";

grant update on table "public"."tarifas_gama" to "anon";

grant delete on table "public"."tarifas_gama" to "authenticated";

grant insert on table "public"."tarifas_gama" to "authenticated";

grant select on table "public"."tarifas_gama" to "authenticated";

grant update on table "public"."tarifas_gama" to "authenticated";

grant delete on table "public"."tarifas_gama" to "mi_rol_admin";

grant insert on table "public"."tarifas_gama" to "mi_rol_admin";

grant references on table "public"."tarifas_gama" to "mi_rol_admin";

grant select on table "public"."tarifas_gama" to "mi_rol_admin";

grant trigger on table "public"."tarifas_gama" to "mi_rol_admin";

grant truncate on table "public"."tarifas_gama" to "mi_rol_admin";

grant update on table "public"."tarifas_gama" to "mi_rol_admin";

grant delete on table "public"."tarifas_gama" to "service_role";

grant insert on table "public"."tarifas_gama" to "service_role";

grant select on table "public"."tarifas_gama" to "service_role";

grant update on table "public"."tarifas_gama" to "service_role";

grant delete on table "public"."tarifas_horario" to "anon";

grant insert on table "public"."tarifas_horario" to "anon";

grant select on table "public"."tarifas_horario" to "anon";

grant update on table "public"."tarifas_horario" to "anon";

grant delete on table "public"."tarifas_horario" to "authenticated";

grant insert on table "public"."tarifas_horario" to "authenticated";

grant select on table "public"."tarifas_horario" to "authenticated";

grant update on table "public"."tarifas_horario" to "authenticated";

grant delete on table "public"."tarifas_horario" to "mi_rol_admin";

grant insert on table "public"."tarifas_horario" to "mi_rol_admin";

grant references on table "public"."tarifas_horario" to "mi_rol_admin";

grant select on table "public"."tarifas_horario" to "mi_rol_admin";

grant trigger on table "public"."tarifas_horario" to "mi_rol_admin";

grant truncate on table "public"."tarifas_horario" to "mi_rol_admin";

grant update on table "public"."tarifas_horario" to "mi_rol_admin";

grant delete on table "public"."tarifas_horario" to "service_role";

grant insert on table "public"."tarifas_horario" to "service_role";

grant select on table "public"."tarifas_horario" to "service_role";

grant update on table "public"."tarifas_horario" to "service_role";

grant delete on table "public"."tarifas_vehiculo" to "anon";

grant insert on table "public"."tarifas_vehiculo" to "anon";

grant select on table "public"."tarifas_vehiculo" to "anon";

grant update on table "public"."tarifas_vehiculo" to "anon";

grant delete on table "public"."tarifas_vehiculo" to "authenticated";

grant insert on table "public"."tarifas_vehiculo" to "authenticated";

grant select on table "public"."tarifas_vehiculo" to "authenticated";

grant update on table "public"."tarifas_vehiculo" to "authenticated";

grant delete on table "public"."tarifas_vehiculo" to "mi_rol_admin";

grant insert on table "public"."tarifas_vehiculo" to "mi_rol_admin";

grant references on table "public"."tarifas_vehiculo" to "mi_rol_admin";

grant select on table "public"."tarifas_vehiculo" to "mi_rol_admin";

grant trigger on table "public"."tarifas_vehiculo" to "mi_rol_admin";

grant truncate on table "public"."tarifas_vehiculo" to "mi_rol_admin";

grant update on table "public"."tarifas_vehiculo" to "mi_rol_admin";

grant delete on table "public"."tarifas_vehiculo" to "service_role";

grant insert on table "public"."tarifas_vehiculo" to "service_role";

grant select on table "public"."tarifas_vehiculo" to "service_role";

grant update on table "public"."tarifas_vehiculo" to "service_role";

grant delete on table "public"."tracking_salud_traslado" to "anon";

grant insert on table "public"."tracking_salud_traslado" to "anon";

grant select on table "public"."tracking_salud_traslado" to "anon";

grant update on table "public"."tracking_salud_traslado" to "anon";

grant delete on table "public"."tracking_salud_traslado" to "authenticated";

grant insert on table "public"."tracking_salud_traslado" to "authenticated";

grant update on table "public"."tracking_salud_traslado" to "authenticated";

grant delete on table "public"."tracking_salud_traslado" to "mi_rol_admin";

grant insert on table "public"."tracking_salud_traslado" to "mi_rol_admin";

grant references on table "public"."tracking_salud_traslado" to "mi_rol_admin";

grant select on table "public"."tracking_salud_traslado" to "mi_rol_admin";

grant trigger on table "public"."tracking_salud_traslado" to "mi_rol_admin";

grant truncate on table "public"."tracking_salud_traslado" to "mi_rol_admin";

grant update on table "public"."tracking_salud_traslado" to "mi_rol_admin";

grant delete on table "public"."tracking_salud_traslado" to "service_role";

grant insert on table "public"."tracking_salud_traslado" to "service_role";

grant select on table "public"."tracking_salud_traslado" to "service_role";

grant update on table "public"."tracking_salud_traslado" to "service_role";

grant delete on table "public"."traslados" to "anon";

grant insert on table "public"."traslados" to "anon";

grant select on table "public"."traslados" to "anon";

grant update on table "public"."traslados" to "anon";

grant delete on table "public"."traslados" to "authenticated";

grant insert on table "public"."traslados" to "authenticated";

grant update on table "public"."traslados" to "authenticated";

grant delete on table "public"."traslados" to "mi_rol_admin";

grant insert on table "public"."traslados" to "mi_rol_admin";

grant references on table "public"."traslados" to "mi_rol_admin";

grant select on table "public"."traslados" to "mi_rol_admin";

grant trigger on table "public"."traslados" to "mi_rol_admin";

grant truncate on table "public"."traslados" to "mi_rol_admin";

grant update on table "public"."traslados" to "mi_rol_admin";

grant delete on table "public"."traslados" to "service_role";

grant insert on table "public"."traslados" to "service_role";

grant select on table "public"."traslados" to "service_role";

grant update on table "public"."traslados" to "service_role";

grant delete on table "public"."ubicaciones_traslado" to "anon";

grant insert on table "public"."ubicaciones_traslado" to "anon";

grant select on table "public"."ubicaciones_traslado" to "anon";

grant update on table "public"."ubicaciones_traslado" to "anon";

grant delete on table "public"."ubicaciones_traslado" to "authenticated";

grant update on table "public"."ubicaciones_traslado" to "authenticated";

grant delete on table "public"."ubicaciones_traslado" to "mi_rol_admin";

grant insert on table "public"."ubicaciones_traslado" to "mi_rol_admin";

grant references on table "public"."ubicaciones_traslado" to "mi_rol_admin";

grant select on table "public"."ubicaciones_traslado" to "mi_rol_admin";

grant trigger on table "public"."ubicaciones_traslado" to "mi_rol_admin";

grant truncate on table "public"."ubicaciones_traslado" to "mi_rol_admin";

grant update on table "public"."ubicaciones_traslado" to "mi_rol_admin";

grant delete on table "public"."ubicaciones_traslado" to "service_role";

grant insert on table "public"."ubicaciones_traslado" to "service_role";

grant select on table "public"."ubicaciones_traslado" to "service_role";

grant update on table "public"."ubicaciones_traslado" to "service_role";

grant delete on table "public"."usuarios" to "anon";

grant insert on table "public"."usuarios" to "anon";

grant select on table "public"."usuarios" to "anon";

grant update on table "public"."usuarios" to "anon";

grant delete on table "public"."usuarios" to "authenticated";

grant insert on table "public"."usuarios" to "authenticated";

grant delete on table "public"."usuarios" to "mi_rol_admin";

grant insert on table "public"."usuarios" to "mi_rol_admin";

grant references on table "public"."usuarios" to "mi_rol_admin";

grant select on table "public"."usuarios" to "mi_rol_admin";

grant trigger on table "public"."usuarios" to "mi_rol_admin";

grant truncate on table "public"."usuarios" to "mi_rol_admin";

grant update on table "public"."usuarios" to "mi_rol_admin";

grant delete on table "public"."usuarios" to "service_role";

grant insert on table "public"."usuarios" to "service_role";

grant select on table "public"."usuarios" to "service_role";

grant update on table "public"."usuarios" to "service_role";

grant delete on table "public"."vehiculos" to "anon";

grant insert on table "public"."vehiculos" to "anon";

grant select on table "public"."vehiculos" to "anon";

grant update on table "public"."vehiculos" to "anon";

grant delete on table "public"."vehiculos" to "authenticated";

grant insert on table "public"."vehiculos" to "authenticated";

grant update on table "public"."vehiculos" to "authenticated";

grant delete on table "public"."vehiculos" to "mi_rol_admin";

grant insert on table "public"."vehiculos" to "mi_rol_admin";

grant references on table "public"."vehiculos" to "mi_rol_admin";

grant select on table "public"."vehiculos" to "mi_rol_admin";

grant trigger on table "public"."vehiculos" to "mi_rol_admin";

grant truncate on table "public"."vehiculos" to "mi_rol_admin";

grant update on table "public"."vehiculos" to "mi_rol_admin";

grant delete on table "public"."vehiculos" to "service_role";

grant insert on table "public"."vehiculos" to "service_role";

grant select on table "public"."vehiculos" to "service_role";

grant update on table "public"."vehiculos" to "service_role";

grant delete on table "public"."verificaciones_identidad_didit" to "anon";

grant insert on table "public"."verificaciones_identidad_didit" to "anon";

grant select on table "public"."verificaciones_identidad_didit" to "anon";

grant update on table "public"."verificaciones_identidad_didit" to "anon";

grant delete on table "public"."verificaciones_identidad_didit" to "authenticated";

grant insert on table "public"."verificaciones_identidad_didit" to "authenticated";

grant select on table "public"."verificaciones_identidad_didit" to "authenticated";

grant update on table "public"."verificaciones_identidad_didit" to "authenticated";

grant delete on table "public"."verificaciones_identidad_didit" to "service_role";

grant insert on table "public"."verificaciones_identidad_didit" to "service_role";

grant select on table "public"."verificaciones_identidad_didit" to "service_role";

grant update on table "public"."verificaciones_identidad_didit" to "service_role";

grant delete on table "public"."versiones_documento_consentimiento" to "mi_rol_admin";

grant insert on table "public"."versiones_documento_consentimiento" to "mi_rol_admin";

grant references on table "public"."versiones_documento_consentimiento" to "mi_rol_admin";

grant select on table "public"."versiones_documento_consentimiento" to "mi_rol_admin";

grant trigger on table "public"."versiones_documento_consentimiento" to "mi_rol_admin";

grant truncate on table "public"."versiones_documento_consentimiento" to "mi_rol_admin";

grant update on table "public"."versiones_documento_consentimiento" to "mi_rol_admin";

grant delete on table "public"."versiones_documento_consentimiento" to "service_role";

grant insert on table "public"."versiones_documento_consentimiento" to "service_role";

grant select on table "public"."versiones_documento_consentimiento" to "service_role";

grant update on table "public"."versiones_documento_consentimiento" to "service_role";


  create policy "Superadmin full privileges"
  on "public"."admin_capacidades"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."admins"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."auditoria_admin_seguridad"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."catalogo_vehiculos_tarifa"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."certificacion_pago_conductor"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."conductores"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."configuracion_contactos_soporte"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."datos_bancarios_conductor"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."disputas"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."empresas"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."estado_transiciones_validas"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."evidencia_fotos"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."evidencia_inspecciones"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."feature_flags_app"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."incidencias"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."llamadas_enmascaradas"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."mensajes_chat"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."notas_internas_traslado"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."pagos"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."payouts_conductor"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."politicas_version_app"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."preferencias_admin"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."preferencias_conductor"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."reclamos_seguro"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."sesiones_proxy_traslado"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."solicitudes_aprobacion_admin"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."solicitudes_conductor"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."tarifas_condicion"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."tarifas_config"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."tarifas_dia"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."tarifas_gama"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."tarifas_horario"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."tarifas_vehiculo"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."tracking_salud_traslado"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."traslados"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "usuario_crea_sus_traslados"
  on "public"."traslados"
  as permissive
  for insert
  to public
with check ((usuario_id IN ( SELECT usuarios.id
   FROM public.usuarios
  WHERE (usuarios.auth_user_id = auth.uid()))));



  create policy "Superadmin full privileges"
  on "public"."ubicaciones_traslado"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."usuarios"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "Superadmin full privileges"
  on "public"."vehiculos"
  as permissive
  for all
  to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());



  create policy "usuario_administra_sus_vehiculos"
  on "public"."vehiculos"
  as permissive
  for all
  to public
using ((usuario_id IN ( SELECT usuarios.id
   FROM public.usuarios
  WHERE (usuarios.auth_user_id = auth.uid()))));



