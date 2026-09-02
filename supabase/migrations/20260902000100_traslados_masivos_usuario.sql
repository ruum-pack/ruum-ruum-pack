-- Migración: Habilitar traslados masivos para usuarios autenticados (PRD §4 / Traslados Masivos Usuario)
-- Permite a usuarios de app-usuario cargar lotes CSV de hasta 100 filas,
-- procesando vehículos, traslados, tarificación server-side e idempotencia.

-- 1. Flexibilizar empresa_id para admitir cargas de cuentas personales o corporativas
alter table public.cargas_traslados_masivos
  alter column empresa_id drop not null;

-- 2. Políticas RLS para usuarios en cargas_traslados_masivos
drop policy if exists "usuario_ve_sus_cargas_masivas" on public.cargas_traslados_masivos;
create policy "usuario_ve_sus_cargas_masivas"
  on public.cargas_traslados_masivos for select
  using (
    usuario_id = (select id from public.usuarios where auth_user_id = auth.uid())
  );

-- 3. Políticas RLS para usuarios en filas_carga_traslados_masivos
drop policy if exists "usuario_ve_sus_filas_masivas" on public.filas_carga_traslados_masivos;
create policy "usuario_ve_sus_filas_masivas"
  on public.filas_carga_traslados_masivos for select
  using (
    carga_id in (
      select id from public.cargas_traslados_masivos
      where usuario_id = (select id from public.usuarios where auth_user_id = auth.uid())
    )
  );

-- 4. RPC usuario_crea_traslados_masivos
create or replace function public.usuario_crea_traslados_masivos(
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
  v_usuario public.usuarios%rowtype;
  v_carga_id uuid;
  v_fila jsonb;
  v_numero int := 0;
  v_total int := 0;
  v_errores text[];
  v_hash text;
  v_existente public.cargas_traslados_masivos%rowtype;
begin
  select * into strict v_usuario from public.usuarios where auth_user_id = auth.uid();
  if v_usuario.estado_verificacion not in ('verificado', 'aprobado') then
    raise exception using errcode='42501', message='USUARIO_NO_VERIFICADO';
  end if;

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'Las filas deben enviarse como arreglo JSON';
  end if;
  v_total := jsonb_array_length(p_filas);

  if p_nombre_archivo is null or btrim(p_nombre_archivo) = '' then
    raise exception 'Nombre de archivo requerido';
  end if;
  if p_nombre_archivo !~ '^[A-Za-z0-9][A-Za-z0-9_. -]{0,179}\.csv$' then
    raise exception 'El nombre del archivo debe ser CSV y estar sanitizado';
  end if;
  if p_hash_archivo is null or lower(p_hash_archivo) !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash SHA-256 de archivo requerido';
  end if;
  if p_tamano_bytes <= 0 then
    raise exception 'El archivo está vacío';
  end if;
  if p_tamano_bytes > 5 * 1024 * 1024 then
    raise exception 'El archivo debe pesar máximo 5 MB';
  end if;
  if coalesce(p_mime_type, '') not in ('text/csv', 'application/vnd.ms-excel', 'text/plain') then
    raise exception 'Tipo de archivo no permitido';
  end if;
  if v_total <= 0 then
    raise exception 'El archivo no contiene filas';
  end if;
  if v_total > 100 then
    raise exception 'El lote excede el límite de 100 filas por carga';
  end if;

  -- Idempotencia de archivo: si ya existe una carga con el mismo hash para este usuario, reutilizarla
  select * into v_existente
  from public.cargas_traslados_masivos
  where usuario_id = v_usuario.id and hash_archivo = lower(p_hash_archivo)
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
    empresa_id, usuario_id, nombre_archivo, total_filas,
    estado, hash_archivo, tamano_bytes, mime_type, mensaje_estado
  ) values (
    v_usuario.empresa_id, v_usuario.id, btrim(p_nombre_archivo), v_total,
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
      filas_procesadas = (select count(*) from public.filas_carga_traslados_masivos where carga_id = v_carga_id and estado in ('creada', 'error', 'cancelada')),
      reporte_errores_csv = public.masivo_reporte_errores_csv(v_carga_id)
  where id = v_carga_id;

  return jsonb_build_object(
    'carga_id', v_carga_id,
    'total_filas', v_total,
    'filas_creadas', 0,
    'filas_error', (select count(*) from public.filas_carga_traslados_masivos where carga_id = v_carga_id and estado = 'error'),
    'filas_procesadas', (select count(*) from public.filas_carga_traslados_masivos where carga_id = v_carga_id and estado in ('creada', 'error', 'cancelada')),
    'estado', 'pendiente',
    'reutilizada', false
  );
end;
$$;

-- 5. RPC usuario_procesa_carga_traslados_masivos
create or replace function public.usuario_procesa_carga_traslados_masivos(
  p_carga_id uuid,
  p_limite int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario public.usuarios%rowtype;
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
  v_tipo_pago public.tipo_pago;
  v_categoria_tarifa public.categoria_tarifa_vehiculo;
  v_gama public.gama_vehiculo;
  v_condicion public.condicion_vehiculo;
  v_distancia_km numeric;
  v_tiempo_estimado_horas numeric;
  v_precio_cotizado numeric;
  v_momento timestamptz;
  v_estado_inicial public.estado_traslado;
begin
  select * into strict v_usuario from public.usuarios where auth_user_id = auth.uid();

  select * into strict v_carga
  from public.cargas_traslados_masivos
  where id = p_carga_id and usuario_id = v_usuario.id
  for update;

  if v_carga.estado = 'cancelada' then raise exception 'La carga está cancelada'; end if;
  if v_carga.estado in ('procesada', 'procesada_con_errores', 'rechazada') then
    return jsonb_build_object('carga_id', v_carga.id, 'estado', v_carga.estado, 'procesadas_en_esta_corrida', 0);
  end if;

  update public.cargas_traslados_masivos
  set estado = 'procesando',
      iniciado_en = coalesce(iniciado_en, now()),
      mensaje_estado = 'Procesando filas pendientes'
  where id = p_carga_id;

  -- Regla de pago (PRD §4.6 / RT-09):
  if v_usuario.tipo_cuenta = 'empresa' then
    v_tipo_pago := 'al_cierre';
  elsif v_usuario.traslados_completados_sin_incidencia >= 3 and v_usuario.metodo_pago_registrado then
    v_tipo_pago := 'al_cierre';
  else
    v_tipo_pago := 'anticipado';
  end if;

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
      -- Idempotencia por fila: si el traslado ya fue insertado previamente con esta clave
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

      -- Buscar vehículo existente del usuario por placas o VIN
      select id into v_vehiculo_id
      from public.vehiculos
      where usuario_id = v_carga.usuario_id
        and (
          (v_placas is not null and upper(coalesce(placas, '')) = v_placas)
          or (v_vin is not null and upper(coalesce(vin, '')) = v_vin)
        )
      order by creado_en desc
      limit 1;

      -- Autoasignación de clasificación vehicular por catálogo
      select categoria_tarifa, gama into v_categoria_tarifa, v_gama
      from public.catalogar_vehiculo_para_tarifa(btrim(v_datos->>'vehiculo_marca'), btrim(v_datos->>'vehiculo_modelo'));

      v_categoria_tarifa := coalesce(v_categoria_tarifa, (nullif(v_datos->>'categoria_tarifa', ''))::public.categoria_tarifa_vehiculo, 'ligero_a'::public.categoria_tarifa_vehiculo);
      v_gama := coalesce(v_gama, (nullif(v_datos->>'gama', ''))::public.gama_vehiculo, 'entrada'::public.gama_vehiculo);
      v_condicion := coalesce((nullif(v_datos->>'condicion', ''))::public.condicion_vehiculo, 'seminueva'::public.condicion_vehiculo);

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
          coalesce(nullif(v_datos->>'estado_general_declarado', ''), 'Carga masiva usuario'),
          coalesce((nullif(v_datos->>'tiene_tarjeta_circulacion', ''))::boolean, true),
          coalesce((nullif(v_datos->>'tiene_verificacion', ''))::boolean, true),
          v_placas is not null,
          coalesce((nullif(v_datos->>'puede_circular_rodando', ''))::boolean, true),
          v_categoria_tarifa,
          v_gama,
          v_condicion
        )
        returning id into v_vehiculo_id;
      else
        update public.vehiculos
        set categoria_tarifa = coalesce(v_categoria_tarifa, categoria_tarifa),
            gama = coalesce(v_gama, gama),
            condicion = coalesce(v_condicion, condicion)
        where id = v_vehiculo_id;
      end if;

      v_distancia_km := (nullif(v_datos->>'distancia_km', ''))::numeric;
      v_tiempo_estimado_horas := (nullif(v_datos->>'tiempo_estimado_horas', ''))::numeric;
      v_precio_cotizado := null;
      v_estado_inicial := 'solicitud_creada';

      -- Tarifa automática RT-13 calculada en Postgres
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
        distancia_km, tiempo_estimado_horas, tipo_pago, precio_cotizado, clave_idempotencia
      ) values (
        v_carga.usuario_id, v_vehiculo_id, v_estado_inicial,
        btrim(coalesce(nullif(v_datos->>'contacto_entrega_nombre', ''), 'Contacto entrega')),
        btrim(coalesce(nullif(v_datos->>'contacto_entrega_telefono', ''), '+520000000000')),
        btrim(coalesce(nullif(v_datos->>'contacto_recepcion_nombre', ''), 'Contacto recepción')),
        btrim(coalesce(nullif(v_datos->>'contacto_recepcion_telefono', ''), '+520000000001')),
        (nullif(v_datos->>'origen_lat', ''))::numeric,
        (nullif(v_datos->>'origen_lng', ''))::numeric,
        btrim(coalesce(nullif(v_datos->>'origen_direccion', ''), 'Origen registrado')),
        btrim(coalesce(nullif(v_datos->>'origen_ciudad', ''), 'Ciudad Origen')),
        nullif(v_datos->>'origen_referencias', ''),
        (nullif(v_datos->>'destino_lat', ''))::numeric,
        (nullif(v_datos->>'destino_lng', ''))::numeric,
        btrim(coalesce(nullif(v_datos->>'destino_direccion', ''), 'Destino registrado')),
        btrim(coalesce(nullif(v_datos->>'destino_ciudad', ''), 'Ciudad Destino')),
        nullif(v_datos->>'destino_referencias', ''),
        concat_ws(' | ',
          nullif(v_datos->>'instrucciones_especiales', ''),
          case when nullif(v_datos->>'referencia_externa', '') is not null then 'Ref: ' || nullif(v_datos->>'referencia_externa', '') end
        ),
        v_modalidad,
        v_fecha_programada,
        coalesce(nullif(v_datos->>'tipo_ruta', ''), 'local'),
        nullif(v_datos->>'ventana_recoleccion', ''),
        nullif(v_datos->>'ventana_entrega', ''),
        coalesce(nullif(v_datos->>'tipo_servicio', ''), 'flotilla'),
        coalesce(nullif(v_datos->>'motivo_servicio', ''), 'traslado_especial'),
        v_distancia_km,
        v_tiempo_estimado_horas,
        v_tipo_pago,
        v_precio_cotizado,
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
      filas_procesadas = (select count(*) from public.filas_carga_traslados_masivos where carga_id = p_carga_id and estado in ('creada', 'error', 'cancelada')),
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
      'mensaje_estado', mensaje_estado,
      'procesadas_en_esta_corrida', v_procesadas,
      'reporte_errores_csv', reporte_errores_csv
    )
    from public.cargas_traslados_masivos
    where id = p_carga_id
  );
end;
$$;

-- 6. Permisos de ejecución
revoke all on function public.usuario_crea_traslados_masivos(text, jsonb, text, bigint, text) from public;
grant execute on function public.usuario_crea_traslados_masivos(text, jsonb, text, bigint, text) to authenticated;

revoke all on function public.usuario_procesa_carga_traslados_masivos(uuid, int) from public;
grant execute on function public.usuario_procesa_carga_traslados_masivos(uuid, int) to authenticated;
