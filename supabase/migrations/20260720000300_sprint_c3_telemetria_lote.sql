-- Sprint C3: telemetría confiable, enriquecida e idempotente por lote.
alter table public.ubicaciones_traslado
  add column if not exists local_id uuid,
  add column if not exists direccion_grados numeric(6,2),
  add column if not exists altitud_m numeric(10,2),
  add column if not exists dispositivo_timestamp timestamptz,
  add column if not exists servidor_timestamp timestamptz not null default now(),
  add column if not exists estado_viaje text,
  add column if not exists fuente text not null default 'web_foreground',
  add column if not exists bateria_pct smallint,
  add column if not exists online boolean;

alter table public.ubicaciones_traslado
  drop constraint if exists ubicaciones_direccion_valida,
  add constraint ubicaciones_direccion_valida check (direccion_grados is null or direccion_grados between 0 and 360),
  drop constraint if exists ubicaciones_bateria_valida,
  add constraint ubicaciones_bateria_valida check (bateria_pct is null or bateria_pct between 0 and 100);

create unique index if not exists ubicaciones_traslado_local_id_uidx
  on public.ubicaciones_traslado (traslado_id, local_id)
  where local_id is not null;

create table if not exists public.tracking_salud_traslado (
  traslado_id uuid primary key references public.traslados(id) on delete cascade,
  conductor_id uuid not null references public.conductores(id) on delete cascade,
  ultimo_punto_id uuid references public.ubicaciones_traslado(id) on delete set null,
  ultima_ubicacion_en timestamptz,
  ultimo_envio_en timestamptz,
  fuente text,
  online boolean,
  precision_m numeric(10,2),
  actualizado_en timestamptz not null default now()
);

alter table public.tracking_salud_traslado enable row level security;
grant select on public.tracking_salud_traslado to authenticated;

create policy "tracking_salud_visible_para_participantes_y_admin"
  on public.tracking_salud_traslado for select
  using (
    public.es_admin()
    or exists (
      select 1 from public.traslados t
      left join public.conductores c on c.id = t.conductor_id
      left join public.usuarios u on u.id = t.usuario_id
      where t.id = traslado_id
        and (c.auth_user_id = auth.uid() or u.auth_user_id = auth.uid())
    )
  );

create or replace function public.registrar_telemetria_lote(
  p_traslado_id uuid,
  p_puntos jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conductor_id uuid;
  v_estado text;
  v_punto jsonb;
  v_insertados integer := 0;
  v_duplicados integer := 0;
  v_rechazados integer := 0;
  v_id uuid;
  v_device_ts timestamptz;
  v_local_id uuid;
  v_lat numeric;
  v_lng numeric;
  v_precision numeric;
  v_velocidad numeric;
  v_direccion numeric;
  v_altitud numeric;
  v_bateria integer;
  v_online boolean;
  v_fuente text;
  v_estado_punto text;
begin
  if jsonb_typeof(p_puntos) <> 'array' then
    raise exception using errcode = '22023', message = 'p_puntos debe ser un arreglo JSON';
  end if;
  if jsonb_array_length(p_puntos) = 0 or jsonb_array_length(p_puntos) > 100 then
    raise exception using errcode = '22023', message = 'El lote debe contener entre 1 y 100 puntos';
  end if;

  select t.conductor_id, t.estado::text
    into v_conductor_id, v_estado
  from public.traslados t
  join public.conductores c on c.id = t.conductor_id
  where t.id = p_traslado_id
    and c.auth_user_id = auth.uid()
    and t.estado::text not in ('servicio_cerrado','servicio_cancelado','traslado_fallido');

  if v_conductor_id is null then
    raise exception using errcode = '42501', message = 'El conductor no está autorizado para registrar este traslado';
  end if;

  for v_punto in select value from jsonb_array_elements(p_puntos)
  loop
    begin
      v_local_id := nullif(v_punto->>'localId','')::uuid;
      v_lat := (v_punto->>'lat')::numeric;
      v_lng := (v_punto->>'lng')::numeric;
      v_precision := nullif(v_punto->>'precisionM','')::numeric;
      v_velocidad := nullif(v_punto->>'velocidadMps','')::numeric;
      v_direccion := nullif(v_punto->>'direccionGrados','')::numeric;
      v_altitud := nullif(v_punto->>'altitudM','')::numeric;
      v_bateria := nullif(v_punto->>'bateriaPct','')::integer;
      v_online := nullif(v_punto->>'online','')::boolean;
      v_device_ts := (v_punto->>'deviceTimestamp')::timestamptz;
      v_fuente := left(coalesce(nullif(v_punto->>'fuente',''), 'android_foreground_service'), 64);
      v_estado_punto := left(coalesce(nullif(v_punto->>'estadoViaje',''), v_estado), 64);

      if v_local_id is null or v_lat not between -90 and 90 or v_lng not between -180 and 180
         or v_device_ts < now() - interval '24 hours' or v_device_ts > now() + interval '10 minutes'
         or (v_precision is not null and (v_precision < 0 or v_precision > 10000))
         or (v_velocidad is not null and (v_velocidad < 0 or v_velocidad > 120))
         or (v_direccion is not null and v_direccion not between 0 and 360)
         or (v_bateria is not null and v_bateria not between 0 and 100) then
        v_rechazados := v_rechazados + 1;
        continue;
      end if;

      insert into public.ubicaciones_traslado (
        traslado_id, conductor_id, local_id, lat, lng, precision_m, velocidad_mps,
        direccion_grados, altitud_m, dispositivo_timestamp, servidor_timestamp,
        estado_viaje, fuente, bateria_pct, online, registrado_en
      ) values (
        p_traslado_id, v_conductor_id, v_local_id, v_lat, v_lng, v_precision, v_velocidad,
        v_direccion, v_altitud, v_device_ts, now(), v_estado_punto, v_fuente, v_bateria, v_online, now()
      ) on conflict (traslado_id, local_id) where local_id is not null do nothing
      returning id into v_id;

      if v_id is null then
        v_duplicados := v_duplicados + 1;
      else
        v_insertados := v_insertados + 1;
        insert into public.tracking_salud_traslado (
          traslado_id, conductor_id, ultimo_punto_id, ultima_ubicacion_en,
          ultimo_envio_en, fuente, online, precision_m, actualizado_en
        ) values (
          p_traslado_id, v_conductor_id, v_id, v_device_ts, now(), v_fuente, v_online, v_precision, now()
        ) on conflict (traslado_id) do update set
          conductor_id = excluded.conductor_id,
          ultimo_punto_id = excluded.ultimo_punto_id,
          ultima_ubicacion_en = excluded.ultima_ubicacion_en,
          ultimo_envio_en = excluded.ultimo_envio_en,
          fuente = excluded.fuente,
          online = excluded.online,
          precision_m = excluded.precision_m,
          actualizado_en = now();
      end if;
      v_id := null;
    exception when others then
      v_rechazados := v_rechazados + 1;
      v_id := null;
    end;
  end loop;

  return jsonb_build_object('insertados', v_insertados, 'duplicados', v_duplicados, 'rechazados', v_rechazados, 'recibidos', jsonb_array_length(p_puntos));
end;
$$;

revoke all on function public.registrar_telemetria_lote(uuid, jsonb) from public;
grant execute on function public.registrar_telemetria_lote(uuid, jsonb) to authenticated;

comment on function public.registrar_telemetria_lote(uuid, jsonb) is
  'C3: recibe lotes idempotentes de ubicación del conductor autenticado; valida pertenencia, rangos y timestamps.';
