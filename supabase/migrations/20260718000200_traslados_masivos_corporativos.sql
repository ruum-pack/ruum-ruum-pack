-- Traslados masivos corporativos.
-- El CSV describe movimientos de vehiculos; la tarifa se calcula despues con
-- la politica normativa vigente. Ninguna fila acepta precio libre.

create table if not exists public.cargas_traslados_masivos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  usuario_id uuid not null references public.usuarios(id) on delete restrict,
  creado_por_admin_id uuid references public.admins(id) on delete set null,
  nombre_archivo text not null,
  total_filas int not null default 0 check (total_filas >= 0),
  filas_creadas int not null default 0 check (filas_creadas >= 0),
  filas_error int not null default 0 check (filas_error >= 0),
  estado text not null default 'procesada' check (estado in ('procesada', 'procesada_con_errores', 'rechazada')),
  creado_en timestamptz not null default now()
);

create table if not exists public.filas_carga_traslados_masivos (
  id uuid primary key default gen_random_uuid(),
  carga_id uuid not null references public.cargas_traslados_masivos(id) on delete cascade,
  numero_fila int not null check (numero_fila > 0),
  estado text not null check (estado in ('creada', 'error')),
  referencia_externa text,
  datos jsonb not null,
  errores text[] not null default '{}',
  vehiculo_id uuid references public.vehiculos(id) on delete set null,
  traslado_id uuid references public.traslados(id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (carga_id, numero_fila)
);

alter table public.cargas_traslados_masivos enable row level security;
alter table public.filas_carga_traslados_masivos enable row level security;

drop policy if exists "admin_acceso_total_cargas_traslados_masivos" on public.cargas_traslados_masivos;
create policy "admin_acceso_total_cargas_traslados_masivos"
  on public.cargas_traslados_masivos for all
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "admin_acceso_total_filas_carga_traslados_masivos" on public.filas_carga_traslados_masivos;
create policy "admin_acceso_total_filas_carga_traslados_masivos"
  on public.filas_carga_traslados_masivos for all
  using (public.es_admin())
  with check (public.es_admin());

create or replace function public.admin_crea_traslados_masivos(
  p_empresa_id uuid,
  p_usuario_id uuid,
  p_nombre_archivo text,
  p_filas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_carga_id uuid;
  v_fila jsonb;
  v_numero int := 0;
  v_total int := 0;
  v_creadas int := 0;
  v_error int := 0;
  v_vehiculo_id uuid;
  v_traslado_id uuid;
  v_placas text;
  v_vin text;
  v_modalidad text;
  v_fecha_programada timestamptz;
begin
  if not public.es_admin() then raise exception 'Acceso denegado'; end if;
  if p_nombre_archivo is null or btrim(p_nombre_archivo) = '' then raise exception 'Nombre de archivo requerido'; end if;
  if p_filas is null then raise exception 'Las filas deben enviarse como arreglo JSON'; end if;
  if jsonb_typeof(p_filas) <> 'array' then raise exception 'Las filas deben enviarse como arreglo JSON'; end if;

  v_total := jsonb_array_length(p_filas);
  if v_total = 0 then raise exception 'El archivo no contiene filas'; end if;
  if v_total > 500 then raise exception 'El lote excede el maximo de 500 filas por carga'; end if;

  select id into v_admin_id from public.admins where auth_user_id = auth.uid();
  if v_admin_id is null then raise exception 'Admin no encontrado'; end if;

  if not exists (
    select 1 from public.usuarios
    where id = p_usuario_id and empresa_id = p_empresa_id and tipo_cuenta = 'empresa'
  ) then
    raise exception 'El usuario solicitante no pertenece a la empresa seleccionada';
  end if;

  insert into public.cargas_traslados_masivos (empresa_id, usuario_id, creado_por_admin_id, nombre_archivo, total_filas)
  values (p_empresa_id, p_usuario_id, v_admin_id, p_nombre_archivo, v_total)
  returning id into v_carga_id;

  for v_fila in select value from jsonb_array_elements(p_filas)
  loop
    v_numero := v_numero + 1;
    v_vehiculo_id := null;
    v_traslado_id := null;
    begin
      v_placas := nullif(upper(btrim(coalesce(v_fila->>'vehiculo_placas', ''))), '');
      v_vin := nullif(upper(btrim(coalesce(v_fila->>'vehiculo_vin', ''))), '');
      v_modalidad := coalesce(nullif(v_fila->>'modalidad_programacion', ''), 'lo_antes_posible');
      v_fecha_programada := nullif(v_fila->>'fecha_hora_programada', '')::timestamptz;

      if nullif(v_fila->>'vehiculo_marca', '') is null then raise exception 'vehiculo_marca es requerido'; end if;
      if nullif(v_fila->>'vehiculo_modelo', '') is null then raise exception 'vehiculo_modelo es requerido'; end if;
      if nullif(v_fila->>'vehiculo_anio', '') is null then raise exception 'vehiculo_anio es requerido'; end if;
      if nullif(v_fila->>'vehiculo_tipo', '') is null then raise exception 'vehiculo_tipo es requerido'; end if;
      if v_placas is null and v_vin is null then raise exception 'vehiculo_placas o vehiculo_vin es requerido'; end if;
      if nullif(v_fila->>'categoria_tarifa', '') is null then raise exception 'categoria_tarifa es requerida'; end if;
      if nullif(v_fila->>'gama', '') is null then raise exception 'gama es requerida'; end if;
      if nullif(v_fila->>'condicion', '') is null then raise exception 'condicion es requerida'; end if;
      if nullif(v_fila->>'origen_lat', '') is null or nullif(v_fila->>'origen_lng', '') is null then raise exception 'coordenadas de origen requeridas'; end if;
      if nullif(v_fila->>'destino_lat', '') is null or nullif(v_fila->>'destino_lng', '') is null then raise exception 'coordenadas de destino requeridas'; end if;
      if v_modalidad = 'programado' and v_fecha_programada is null then raise exception 'fecha_hora_programada requerida para programado'; end if;
      if v_modalidad = 'lo_antes_posible' and v_fecha_programada is not null then raise exception 'fecha_hora_programada no aplica para lo_antes_posible'; end if;

      select id into v_vehiculo_id
      from public.vehiculos
      where usuario_id = p_usuario_id
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
          p_usuario_id,
          (v_fila->>'vehiculo_tipo')::public.tipo_vehiculo,
          btrim(v_fila->>'vehiculo_marca'),
          btrim(v_fila->>'vehiculo_modelo'),
          (v_fila->>'vehiculo_anio')::int,
          nullif(v_fila->>'vehiculo_color', ''),
          v_placas,
          v_vin,
          nullif(v_fila->>'vehiculo_alias', ''),
          nullif(v_fila->>'vehiculo_transmision', ''),
          coalesce(nullif(v_fila->>'estado_general_declarado', ''), 'Carga masiva corporativa'),
          coalesce((nullif(v_fila->>'tiene_tarjeta_circulacion', ''))::boolean, false),
          coalesce((nullif(v_fila->>'tiene_verificacion', ''))::boolean, false),
          v_placas is not null,
          coalesce((nullif(v_fila->>'puede_circular_rodando', ''))::boolean, true),
          (v_fila->>'categoria_tarifa')::public.categoria_tarifa_vehiculo,
          (v_fila->>'gama')::public.gama_vehiculo,
          (v_fila->>'condicion')::public.condicion_vehiculo
        )
        returning id into v_vehiculo_id;
      else
        update public.vehiculos
        set categoria_tarifa = coalesce((nullif(v_fila->>'categoria_tarifa', ''))::public.categoria_tarifa_vehiculo, categoria_tarifa),
            gama = coalesce((nullif(v_fila->>'gama', ''))::public.gama_vehiculo, gama),
            condicion = coalesce((nullif(v_fila->>'condicion', ''))::public.condicion_vehiculo, condicion)
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
        distancia_km, tiempo_estimado_horas, tipo_pago
      ) values (
        p_usuario_id, v_vehiculo_id,
        btrim(coalesce(nullif(v_fila->>'contacto_entrega_nombre', ''), 'Contacto corporativo')),
        btrim(coalesce(nullif(v_fila->>'contacto_entrega_telefono', ''), '+520000000000')),
        btrim(coalesce(nullif(v_fila->>'contacto_recepcion_nombre', ''), 'Contacto destino')),
        btrim(coalesce(nullif(v_fila->>'contacto_recepcion_telefono', ''), '+520000000001')),
        (v_fila->>'origen_lat')::numeric,
        (v_fila->>'origen_lng')::numeric,
        btrim(coalesce(nullif(v_fila->>'origen_direccion', ''), 'Origen corporativo')),
        btrim(coalesce(nullif(v_fila->>'origen_ciudad', ''), 'Sin ciudad')),
        nullif(v_fila->>'origen_referencias', ''),
        (v_fila->>'destino_lat')::numeric,
        (v_fila->>'destino_lng')::numeric,
        btrim(coalesce(nullif(v_fila->>'destino_direccion', ''), 'Destino corporativo')),
        btrim(coalesce(nullif(v_fila->>'destino_ciudad', ''), 'Sin ciudad')),
        nullif(v_fila->>'destino_referencias', ''),
        concat_ws(' | ',
          nullif(v_fila->>'instrucciones_especiales', ''),
          case when nullif(v_fila->>'referencia_externa', '') is not null then 'Ref. corporativa: ' || nullif(v_fila->>'referencia_externa', '') end
        ),
        v_modalidad,
        v_fecha_programada,
        coalesce(nullif(v_fila->>'tipo_ruta', ''), 'local'),
        nullif(v_fila->>'ventana_recoleccion', ''),
        nullif(v_fila->>'ventana_entrega', ''),
        coalesce(nullif(v_fila->>'tipo_servicio', ''), 'flotilla'),
        coalesce(nullif(v_fila->>'motivo_servicio', ''), 'traslado_especial'),
        (nullif(v_fila->>'distancia_km', ''))::numeric,
        (nullif(v_fila->>'tiempo_estimado_horas', ''))::numeric,
        coalesce(nullif(v_fila->>'tipo_pago', ''), 'al_cierre')::public.tipo_pago
      )
      returning id into v_traslado_id;

      insert into public.filas_carga_traslados_masivos (
        carga_id, numero_fila, estado, referencia_externa, datos, vehiculo_id, traslado_id
      ) values (
        v_carga_id, v_numero, 'creada', nullif(v_fila->>'referencia_externa', ''), v_fila, v_vehiculo_id, v_traslado_id
      );
      v_creadas := v_creadas + 1;
    exception when others then
      insert into public.filas_carga_traslados_masivos (
        carga_id, numero_fila, estado, referencia_externa, datos, errores
      ) values (
        v_carga_id, v_numero, 'error', nullif(v_fila->>'referencia_externa', ''), v_fila, array[sqlerrm]
      );
      v_error := v_error + 1;
    end;
  end loop;

  update public.cargas_traslados_masivos
  set filas_creadas = v_creadas,
      filas_error = v_error,
      estado = case when v_creadas = 0 then 'rechazada' when v_error > 0 then 'procesada_con_errores' else 'procesada' end
  where id = v_carga_id;

  insert into public.registro_auditoria (evento, actor, actor_id, datos)
  values (
    'creacion_solicitud_traslado',
    'admin',
    v_admin_id,
    jsonb_build_object('carga_id', v_carga_id, 'empresa_id', p_empresa_id, 'usuario_id', p_usuario_id, 'total_filas', v_total, 'filas_creadas', v_creadas, 'filas_error', v_error)
  );

  return jsonb_build_object(
    'carga_id', v_carga_id,
    'total_filas', v_total,
    'filas_creadas', v_creadas,
    'filas_error', v_error,
    'estado', case when v_creadas = 0 then 'rechazada' when v_error > 0 then 'procesada_con_errores' else 'procesada' end
  );
end;
$$;

revoke all on function public.admin_crea_traslados_masivos(uuid, uuid, text, jsonb) from public;
grant execute on function public.admin_crea_traslados_masivos(uuid, uuid, text, jsonb) to authenticated;

comment on table public.cargas_traslados_masivos is
  'Lotes CSV de traslados corporativos. Registra la operacion masiva sin aceptar precios libres.';
comment on table public.filas_carga_traslados_masivos is
  'Resultado auditable por fila de una carga masiva: traslado creado o error de validacion.';
comment on function public.admin_crea_traslados_masivos(uuid, uuid, text, jsonb) is
  'Crea traslados corporativos desde filas normalizadas. La tarifa queda a cargo de la politica normativa del sistema.';
