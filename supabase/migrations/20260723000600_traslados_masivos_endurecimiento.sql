-- Traslados masivos: validacion backend, idempotencia, cola y reportes.

alter table public.cargas_traslados_masivos
  add column if not exists hash_archivo text,
  add column if not exists tamano_bytes bigint not null default 0,
  add column if not exists mime_type text,
  add column if not exists filas_procesadas int not null default 0,
  add column if not exists iniciado_en timestamptz,
  add column if not exists finalizado_en timestamptz,
  add column if not exists cancelado_en timestamptz,
  add column if not exists cancelado_por uuid references public.admins(id) on delete set null,
  add column if not exists reporte_errores_csv text,
  add column if not exists mensaje_estado text;

alter table public.filas_carga_traslados_masivos
  add column if not exists hash_fila text,
  add column if not exists clave_idempotencia uuid,
  add column if not exists procesado_en timestamptz;

alter table public.cargas_traslados_masivos
  drop constraint if exists cargas_traslados_masivos_estado_check;

alter table public.cargas_traslados_masivos
  add constraint cargas_traslados_masivos_estado_check
  check (estado in ('pendiente','procesando','procesada','procesada_con_errores','rechazada','cancelada'));

alter table public.filas_carga_traslados_masivos
  drop constraint if exists filas_carga_traslados_masivos_estado_check;

alter table public.filas_carga_traslados_masivos
  add constraint filas_carga_traslados_masivos_estado_check
  check (estado in ('pendiente','creada','error','cancelada'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cargas_traslados_masivos_hash_check'
      and conrelid = 'public.cargas_traslados_masivos'::regclass
  ) then
    alter table public.cargas_traslados_masivos
      add constraint cargas_traslados_masivos_hash_check
      check (hash_archivo is null or hash_archivo ~ '^[0-9a-f]{64}$');
  end if;
end $$;

create unique index if not exists cargas_masivas_empresa_hash_uidx
  on public.cargas_traslados_masivos (empresa_id, hash_archivo)
  where hash_archivo is not null;

create unique index if not exists filas_masivas_carga_hash_uidx
  on public.filas_carga_traslados_masivos (carga_id, hash_fila)
  where hash_fila is not null;

create index if not exists cargas_masivas_estado_idx on public.cargas_traslados_masivos (estado, creado_en);
create index if not exists filas_masivas_pendientes_idx on public.filas_carga_traslados_masivos (carga_id, estado, numero_fila);

grant select on public.cargas_traslados_masivos to authenticated;
grant select on public.filas_carga_traslados_masivos to authenticated;

create or replace function public.masivo_uuid_idempotencia(p_carga_id uuid, p_numero_fila int)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
  select (
    substr(v_hash, 1, 8) || '-' ||
    substr(v_hash, 9, 4) || '-' ||
    '4' || substr(v_hash, 14, 3) || '-' ||
    substr('89ab', (('x' || substr(v_hash, 17, 1))::bit(4)::int % 4) + 1, 1) || substr(v_hash, 18, 3) || '-' ||
    substr(v_hash, 21, 12)
  )::uuid
  from (select md5(p_carga_id::text || ':' || p_numero_fila::text) as v_hash) s
$$;

create or replace function public.masivo_hash_fila(p_fila jsonb, p_numero_fila int)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select md5(p_numero_fila::text || ':' || p_fila::text)
$$;

create or replace function public.masivo_reporte_errores_csv(p_carga_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select concat_ws(
    E'\n',
    'numero_fila,referencia_externa,errores',
    string_agg(
      concat_ws(
        ',',
        numero_fila::text,
        '"' || replace(coalesce(referencia_externa, ''), '"', '""') || '"',
        '"' || replace(array_to_string(errores, '; '), '"', '""') || '"'
      ),
      E'\n'
      order by numero_fila
    )
  )
  from public.filas_carga_traslados_masivos
  where carga_id = p_carga_id and estado = 'error'
$$;

create or replace function public.masivo_validar_archivo(
  p_nombre_archivo text,
  p_hash_archivo text,
  p_tamano_bytes bigint,
  p_mime_type text,
  p_total_filas int,
  p_rol public.rol_admin_operativo
) returns void
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_max_filas int;
begin
  if p_nombre_archivo is null or btrim(p_nombre_archivo) = '' then raise exception 'Nombre de archivo requerido'; end if;
  if p_nombre_archivo !~ '^[A-Za-z0-9][A-Za-z0-9_. -]{0,179}\.csv$' then raise exception 'El nombre del archivo debe ser CSV y estar sanitizado'; end if;
  if p_hash_archivo is null or lower(p_hash_archivo) !~ '^[0-9a-f]{64}$' then raise exception 'Hash SHA-256 de archivo requerido'; end if;
  if p_tamano_bytes <= 0 then raise exception 'El archivo está vacío'; end if;
  if p_tamano_bytes > 5 * 1024 * 1024 then raise exception 'El archivo debe pesar máximo 5 MB'; end if;
  if coalesce(p_mime_type, '') not in ('text/csv','application/vnd.ms-excel','text/plain') then raise exception 'Tipo de archivo no permitido'; end if;
  if p_total_filas <= 0 then raise exception 'El archivo no contiene filas'; end if;

  v_max_filas := case p_rol
    when 'direccion' then 2000
    when 'supervisor' then 1000
    else 500
  end;
  if p_total_filas > v_max_filas then raise exception 'El lote excede el límite de filas para el rol'; end if;
end;
$$;

create or replace function public.masivo_validar_fila(p_fila jsonb)
returns text[]
language plpgsql
stable
set search_path = public, pg_temp
as $$
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
$$;

create or replace function public.admin_crea_traslados_masivos(
  p_empresa_id uuid,
  p_usuario_id uuid,
  p_nombre_archivo text,
  p_filas jsonb,
  p_hash_archivo text,
  p_tamano_bytes bigint,
  p_mime_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin public.admins%rowtype;
  v_carga_id uuid;
  v_fila jsonb;
  v_numero int := 0;
  v_total int := 0;
  v_errores text[];
  v_hash text;
  v_existente public.cargas_traslados_masivos%rowtype;
begin
  if not public.admin_tiene_permiso('masivos:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  select * into strict v_admin from public.admins where auth_user_id = auth.uid();
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'Las filas deben enviarse como arreglo JSON'; end if;
  v_total := jsonb_array_length(p_filas);
  perform public.masivo_validar_archivo(p_nombre_archivo, p_hash_archivo, p_tamano_bytes, p_mime_type, v_total, v_admin.rol_operativo);

  if not exists (
    select 1 from public.usuarios
    where id = p_usuario_id and empresa_id = p_empresa_id and tipo_cuenta = 'empresa'
  ) then
    raise exception 'El usuario solicitante no pertenece a la empresa seleccionada';
  end if;

  select * into v_existente
  from public.cargas_traslados_masivos
  where empresa_id = p_empresa_id and hash_archivo = lower(p_hash_archivo)
  order by creado_en desc
  limit 1;

  if v_existente.id is not null then
    return jsonb_build_object(
      'carga_id', v_existente.id,
      'total_filas', v_existente.total_filas,
      'filas_creadas', v_existente.filas_creadas,
      'filas_error', v_existente.filas_error,
      'filas_procesadas', v_existente.filas_procesadas,
      'estado', v_existente.estado,
      'reutilizada', true
    );
  end if;

  insert into public.cargas_traslados_masivos (
    empresa_id, usuario_id, creado_por_admin_id, nombre_archivo, total_filas,
    estado, hash_archivo, tamano_bytes, mime_type, mensaje_estado
  ) values (
    p_empresa_id, p_usuario_id, v_admin.id, btrim(p_nombre_archivo), v_total,
    'pendiente', lower(p_hash_archivo), p_tamano_bytes, p_mime_type, 'Carga encolada'
  )
  returning id into v_carga_id;

  for v_fila in select value from jsonb_array_elements(p_filas)
  loop
    v_numero := v_numero + 1;
    v_errores := public.masivo_validar_fila(v_fila);
    v_hash := public.masivo_hash_fila(v_fila, v_numero);
    insert into public.filas_carga_traslados_masivos (
      carga_id, numero_fila, estado, referencia_externa, datos, errores, hash_fila, clave_idempotencia
    ) values (
      v_carga_id,
      v_numero,
      case when array_length(v_errores, 1) is null then 'pendiente' else 'error' end,
      nullif(v_fila->>'referencia_externa', ''),
      v_fila,
      coalesce(v_errores, '{}'),
      v_hash,
      public.masivo_uuid_idempotencia(v_carga_id, v_numero)
    );
  end loop;

  update public.cargas_traslados_masivos
  set filas_error = (select count(*) from public.filas_carga_traslados_masivos where carga_id = v_carga_id and estado = 'error'),
      filas_procesadas = (select count(*) from public.filas_carga_traslados_masivos where carga_id = v_carga_id and estado = 'error'),
      reporte_errores_csv = public.masivo_reporte_errores_csv(v_carga_id),
      estado = case
        when not exists (select 1 from public.filas_carga_traslados_masivos where carga_id = v_carga_id and estado = 'pendiente') then 'rechazada'
        else 'pendiente'
      end,
      mensaje_estado = case
        when not exists (select 1 from public.filas_carga_traslados_masivos where carga_id = v_carga_id and estado = 'pendiente') then 'Carga rechazada por validación backend'
        else 'Carga validada y encolada'
      end,
      finalizado_en = case
        when not exists (select 1 from public.filas_carga_traslados_masivos where carga_id = v_carga_id and estado = 'pendiente') then now()
        else null
      end
  where id = v_carga_id;

  insert into public.registro_auditoria (evento, actor, actor_id, datos)
  values (
    'creacion_solicitud_traslado',
    'admin',
    v_admin.id,
    jsonb_build_object('carga_id', v_carga_id, 'empresa_id', p_empresa_id, 'usuario_id', p_usuario_id, 'total_filas', v_total, 'estado', 'pendiente')
  );

  return (
    select jsonb_build_object(
      'carga_id', id,
      'total_filas', total_filas,
      'filas_creadas', filas_creadas,
      'filas_error', filas_error,
      'filas_procesadas', filas_procesadas,
      'estado', estado,
      'reutilizada', false
    )
    from public.cargas_traslados_masivos
    where id = v_carga_id
  );
end;
$$;

create or replace function public.admin_crea_traslados_masivos(
  p_empresa_id uuid,
  p_usuario_id uuid,
  p_nombre_archivo text,
  p_filas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.admin_crea_traslados_masivos(
    p_empresa_id,
    p_usuario_id,
    p_nombre_archivo,
    p_filas,
    md5(coalesce(p_nombre_archivo, '') || ':' || coalesce(p_filas::text, '')) ||
      md5(coalesce(p_filas::text, '') || ':' || coalesce(p_nombre_archivo, '')),
    greatest(length(coalesce(p_filas::text, '')), 1),
    'text/csv'
  );
end;
$$;

create or replace function public.admin_procesa_carga_traslados_masivos(
  p_carga_id uuid,
  p_limite int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

create or replace function public.admin_cancela_carga_traslados_masivos(
  p_carga_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_estado text;
begin
  if not public.admin_tiene_permiso('masivos:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then raise exception 'Motivo requerido'; end if;
  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();
  select estado into strict v_estado from public.cargas_traslados_masivos where id = p_carga_id for update;
  if v_estado <> 'pendiente' then raise exception 'Solo se pueden cancelar cargas no iniciadas'; end if;

  update public.filas_carga_traslados_masivos
  set estado = 'cancelada', errores = array[btrim(p_motivo)], procesado_en = now()
  where carga_id = p_carga_id and estado = 'pendiente';

  update public.cargas_traslados_masivos
  set estado = 'cancelada',
      cancelado_en = now(),
      cancelado_por = v_admin_id,
      filas_procesadas = total_filas,
      mensaje_estado = btrim(p_motivo)
  where id = p_carga_id;

  return jsonb_build_object('carga_id', p_carga_id, 'estado', 'cancelada');
end;
$$;

revoke all on function public.admin_crea_traslados_masivos(uuid, uuid, text, jsonb, text, bigint, text) from public;
revoke all on function public.admin_procesa_carga_traslados_masivos(uuid, int) from public;
revoke all on function public.admin_cancela_carga_traslados_masivos(uuid, text) from public;

grant execute on function public.admin_crea_traslados_masivos(uuid, uuid, text, jsonb, text, bigint, text) to authenticated;
grant execute on function public.admin_procesa_carga_traslados_masivos(uuid, int) to authenticated;
grant execute on function public.admin_cancela_carga_traslados_masivos(uuid, text) to authenticated;
