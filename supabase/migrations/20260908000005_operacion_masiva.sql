-- FASE 8 — Traslados masivos → Operaciones masivas.
-- La importación v1 (admin_crea/procesa) queda intacta (compatibilidad).
-- Esta migración añade: vínculo carga↔operación (8.2), centros origen/destino
-- por fila (8.8/8.9, FK a empresa_sucursales de Fase 2), validador v2 con
-- sucursales (8.3-8.9), preview sin escrituras (8.10/8.11), creación ligada a
-- operación con dedup de archivo (8.12/8.13/8.17) y autovinculado de
-- traslados creados por cualquier ruta masiva a su operación.

-- 8.2 — vínculo carga ↔ operación (nullable: cargas históricas siguen válidas)
alter table public.cargas_traslados_masivos
  add column operation_id uuid references public.operaciones(id) on delete set null;

create index cargas_masivas_operation_idx
  on public.cargas_traslados_masivos (operation_id)
  where operation_id is not null;

-- 8.8/8.9 — centros por fila (plantilla v2; el traslado conserva direcciones
-- libres por compatibilidad, la fila guarda la referencia al centro)
alter table public.filas_carga_traslados_masivos
  add column sucursal_origen_id uuid references public.empresa_sucursales(id) on delete set null,
  add column sucursal_destino_id uuid references public.empresa_sucursales(id) on delete set null;

create index filas_masivas_sucursal_origen_idx
  on public.filas_carga_traslados_masivos (sucursal_origen_id)
  where sucursal_origen_id is not null;
create index filas_masivas_sucursal_destino_idx
  on public.filas_carga_traslados_masivos (sucursal_destino_id)
  where sucursal_destino_id is not null;

-- 8.3-8.9 — validador v2: reutiliza el v1 (sin duplicar reglas) y suma
-- sucursales. Las claves nuevas se retiran antes de llamar al v1 para no
-- chocar con su allowlist.
create or replace function public.masivo_validar_fila_v2(p_fila jsonb, p_empresa_id uuid)
returns text[]
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_errores text[] := '{}';
  v_base jsonb;
  v_id uuid;
begin
  v_base := p_fila - 'sucursal_origen_id' - 'sucursal_destino_id';
  v_errores := public.masivo_validar_fila(v_base);

  if nullif(p_fila->>'sucursal_origen_id', '') is not null then
    begin
      v_id := (p_fila->>'sucursal_origen_id')::uuid;
    exception when others then
      v_errores := array_append(v_errores, 'sucursal_origen_id debe ser UUID');
      v_id := null;
    end;
    if v_id is not null and not exists (
      select 1 from public.empresa_sucursales s
      where s.id = v_id and s.empresa_id = p_empresa_id and s.activo
    ) then
      v_errores := array_append(v_errores, 'sucursal_origen_id no pertenece a la empresa');
    end if;
  end if;

  if nullif(p_fila->>'sucursal_destino_id', '') is not null then
    begin
      v_id := (p_fila->>'sucursal_destino_id')::uuid;
    exception when others then
      v_errores := array_append(v_errores, 'sucursal_destino_id debe ser UUID');
      v_id := null;
    end;
    if v_id is not null and not exists (
      select 1 from public.empresa_sucursales s
      where s.id = v_id and s.empresa_id = p_empresa_id and s.activo
    ) then
      v_errores := array_append(v_errores, 'sucursal_destino_id no pertenece a la empresa');
    end if;
  end if;

  return v_errores;
end;
$$;

-- Clave de deduplicación intra-archivo: referencia, VIN o placas (normalizados).
-- El hash de fila incluye el número y no sirve para detectar contenido repetido.
create or replace function public.masivo_clave_dedup(p_fila jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(
    coalesce(
      nullif(upper(btrim(p_fila->>'referencia_externa')), ''),
      nullif(upper(btrim(p_fila->>'vehiculo_vin')), ''),
      nullif(upper(btrim(p_fila->>'vehiculo_placas')), '')
    ), '')
$$;

-- 8.10/8.11 — preview sin escrituras: valida, detecta duplicados intra-archivo
-- (8.12) e históricos, y devuelve el veredicto por fila.
create or replace function public.admin_previsualizar_carga_masiva(
  p_empresa_id uuid,
  p_usuario_id uuid,
  p_filas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fila jsonb;
  v_numero int := 0;
  v_total int;
  v_errores text[];
  v_hash text;
  v_clave text;
  v_vistas text[] := '{}';
  v_validas int := 0;
  v_con_error int := 0;
  v_duplicadas int := 0;
  v_salida jsonb := '[]'::jsonb;
  v_duplicada_archivo boolean;
  v_duplicada_historial boolean;
begin
  if not public.admin_tiene_permiso('masivos:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'Las filas deben enviarse como arreglo JSON';
  end if;
  v_total := jsonb_array_length(p_filas);
  if v_total = 0 then raise exception 'El archivo no contiene filas'; end if;
  if v_total > 500 then raise exception 'El lote excede el maximo de 500 filas por carga'; end if;

  if not exists (
    select 1 from public.usuarios
    where id = p_usuario_id and empresa_id = p_empresa_id and tipo_cuenta = 'empresa'
  ) then
    raise exception 'El usuario solicitante no pertenece a la empresa seleccionada';
  end if;

  for v_fila in select value from jsonb_array_elements(p_filas)
  loop
    v_numero := v_numero + 1;
    v_errores := public.masivo_validar_fila_v2(v_fila, p_empresa_id);
    v_hash := public.masivo_hash_fila(v_fila, v_numero);
    v_clave := public.masivo_clave_dedup(v_fila);

    v_duplicada_archivo := v_clave is not null and v_clave = any(v_vistas);
    if v_clave is not null and not v_duplicada_archivo then
      v_vistas := array_append(v_vistas, v_clave);
    end if;

    select exists (
      select 1
      from public.filas_carga_traslados_masivos f
      join public.cargas_traslados_masivos c on c.id = f.carga_id
      where c.empresa_id = p_empresa_id and f.hash_fila = v_hash
    ) into v_duplicada_historial;

    if coalesce(v_duplicada_historial, false) then
      v_duplicadas := v_duplicadas + 1;
    end if;

    if v_duplicada_archivo then
      v_errores := array_append(v_errores, 'Fila duplicada en el archivo (clave ' || v_clave || ')');
    end if;

    if array_length(v_errores, 1) is null then
      v_validas := v_validas + 1;
    else
      v_con_error := v_con_error + 1;
    end if;

    v_salida := v_salida || jsonb_build_object(
      'numero', v_numero,
      'valida', array_length(v_errores, 1) is null and not v_duplicada_archivo,
      'errores', coalesce(v_errores, '{}'),
      'advertencias', case when v_duplicada_historial then array['Fila similar ya cargada en la empresa'] else '{}' end,
      'duplicada_en_archivo', v_duplicada_archivo,
      'duplicada_en_historial', coalesce(v_duplicada_historial, false),
      'hash_fila', v_hash,
      'referencia_externa', nullif(v_fila->>'referencia_externa', '')
    );
  end loop;

  return jsonb_build_object(
    'total_filas', v_total,
    'validas', v_validas,
    'con_error', v_con_error,
    'duplicadas', v_duplicadas,
    'filas', v_salida
  );
end;
$$;

-- Creación ligada a operación (8.2/8.13/8.17): valida la operación, delega la
-- creación al flujo v1 probado (sin duplicar su lógica) y vincula el resultado.
create or replace function public.admin_crea_carga_masiva_operacion(
  p_operacion_id uuid,
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
  v_operacion record;
  v_res jsonb;
  v_carga_id uuid;
  v_fila jsonb;
  v_numero int := 0;
  v_sucursal text;
  v_clave text;
  v_vistas text[] := '{}';
  v_dups int[] := '{}';
  v_filas_limpias jsonb := '[]'::jsonb;
begin
  select * into v_operacion from public.operaciones where id = p_operacion_id;
  if v_operacion.id is null then raise exception 'Operación no encontrada.'; end if;
  if v_operacion.empresa_id is distinct from p_empresa_id then
    raise exception 'La operación no pertenece a la empresa seleccionada.';
  end if;
  if v_operacion.estado not in ('borrador', 'planificada', 'en_curso', 'pausada') then
    raise exception 'La operación no admite más cargas (estado %).', v_operacion.estado;
  end if;

  -- sucursales referenciadas existen y son de la empresa (falla rápido y claro)
  -- + fail-fast en duplicados intra-archivo (v1 los crearía dobles)
  for v_fila in select value from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb))
  loop
    v_numero := v_numero + 1;
    foreach v_sucursal in array array['sucursal_origen_id', 'sucursal_destino_id']
    loop
      if nullif(v_fila->>v_sucursal, '') is not null
         and (
           nullif(v_fila->>v_sucursal, '') !~ '^[0-9a-fA-F-]{36}$'
           or not exists (
             select 1 from public.empresa_sucursales s
             where s.id = nullif(v_fila->>v_sucursal, '')::uuid
               and s.empresa_id = p_empresa_id
           )
         ) then
        raise exception 'Fila %: % no es una sucursal válida de la empresa', v_numero, v_sucursal;
      end if;
    end loop;
    v_clave := public.masivo_clave_dedup(v_fila);
    if v_clave is not null then
      if v_clave = any(v_vistas) then
        v_dups := array_append(v_dups, v_numero);
      else
        v_vistas := array_append(v_vistas, v_clave);
      end if;
    end if;
    -- v1 rechaza claves desconocidas: se retiran (se vinculan después por número)
    v_filas_limpias := v_filas_limpias || (v_fila - 'sucursal_origen_id' - 'sucursal_destino_id');
  end loop;

  if array_length(v_dups, 1) is not null then
    raise exception 'El archivo contiene filas duplicadas (números %). Corrige y reintenta.', array_to_string(v_dups, ', ');
  end if;

  -- delega al flujo v1 (validación, hash, idempotencia por archivo, staging)
  select public.admin_crea_traslados_masivos(
    p_empresa_id, p_usuario_id, p_nombre_archivo, v_filas_limpias,
    p_hash_archivo, p_tamano_bytes, p_mime_type
  ) into v_res;

  v_carga_id := (v_res->>'carga_id')::uuid;

  -- si el archivo se reutilizó y la carga ya tenía otra operación, se respeta
  update public.cargas_traslados_masivos
  set operation_id = p_operacion_id
  where id = v_carga_id and operation_id is null;

  -- vincula centros por número de fila (válidas y con error: sirve para corregir)
  v_numero := 0;
  for v_fila in select value from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb))
  loop
    v_numero := v_numero + 1;
    update public.filas_carga_traslados_masivos
    set sucursal_origen_id = nullif(v_fila->>'sucursal_origen_id', '')::uuid,
        sucursal_destino_id = nullif(v_fila->>'sucursal_destino_id', '')::uuid
    where carga_id = v_carga_id and numero_fila = v_numero;
  end loop;

  return v_res || jsonb_build_object('operacion_id', p_operacion_id);
end;
$$;

-- Autovinculado: traslados creados por cualquier ruta masiva (v1, v2, usuario)
-- heredan la operación de su carga vía clave de idempotencia. No toca las
-- columnas que sincronizan Fase 3/4 (triggers independientes).
create or replace function public.vincular_operacion_masiva()
returns trigger
language plpgsql
as $$
declare
  v_operacion uuid;
begin
  if new.operation_id is not null then return new; end if;
  if new.clave_idempotencia is null then return new; end if;

  select c.operation_id into v_operacion
  from public.filas_carga_traslados_masivos f
  join public.cargas_traslados_masivos c on c.id = f.carga_id
  where f.clave_idempotencia = new.clave_idempotencia
    and c.usuario_id = new.usuario_id
    and c.operation_id is not null
  order by f.creado_en desc
  limit 1;

  if v_operacion is not null then new.operation_id := v_operacion; end if;
  return new;
end;
$$;

create trigger traslados_vincular_operacion_masiva
  before insert on public.traslados
  for each row execute function public.vincular_operacion_masiva();

grant execute on function public.admin_previsualizar_carga_masiva(uuid, uuid, jsonb) to authenticated;
grant execute on function public.admin_crea_carga_masiva_operacion(uuid, uuid, uuid, text, jsonb, text, bigint, text) to authenticated;
grant execute on function public.masivo_validar_fila_v2(jsonb, uuid) to authenticated;

-- Guardia: las claves v2 nunca chocan con el allowlist del validador v1.
do $$
declare
  v_errores text[];
begin
  v_errores := public.masivo_validar_fila_v2(
    jsonb_build_object(
      'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024',
      'vehiculo_tipo', 'sedan', 'vehiculo_placas', 'ABC123',
      'categoria_tarifa', 'ligero_a', 'gama', 'media', 'condicion', 'seminueva',
      'origen_lat', '19.4', 'origen_lng', '-99.1',
      'destino_lat', '19.5', 'destino_lng', '-99.2',
      'sucursal_origen_id', gen_random_uuid(), 'sucursal_destino_id', gen_random_uuid()
    ),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
  if v_errores @> array['Columna no permitida: sucursal_origen_id']
     or v_errores @> array['Columna no permitida: sucursal_destino_id'] then
    raise exception 'masivo_validar_fila_v2 rechaza claves v2';
  end if;
end $$;
