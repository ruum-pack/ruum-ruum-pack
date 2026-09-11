-- FASE 10 — Tracking operacional: de almacenar coordenadas a supervisar.
-- Sesiones explícitas + heartbeat ligero conviven con la telemetría por lotes
-- (registrar_telemetria_lote, intacta) y la cola offline (10.15, intacta).
-- La salud distingue vehículo detenido (señal fresca sin movimiento) de
-- conductor sin señal (criterio de salida).

create table public.tracking_sesiones (
  id                    uuid primary key default gen_random_uuid(),
  traslado_id           uuid not null references public.traslados(id) on delete cascade,
  conductor_id          uuid not null references public.conductores(id) on delete cascade,
  estado                text not null default 'activa'
    constraint tracking_sesiones_estado_check
    check (estado in ('activa', 'cerrada', 'perdida')),
  iniciada_en           timestamptz not null default now(),
  finalizada_en         timestamptz,
  ultimo_heartbeat_en   timestamptz,
  ultima_lat            numeric(10,7),
  ultima_lng            numeric(10,7),
  ultima_precision_m    numeric(10,2),
  ultima_velocidad_mps  numeric(10,2),
  ultima_bateria_pct    integer constraint tracking_sesion_bateria_check check (ultima_bateria_pct is null or ultima_bateria_pct between 0 and 100),
  ultima_distancia_destino_km numeric(10,2),
  desviacion_sospechosa boolean not null default false,
  plataforma            text,
  metadata              jsonb not null default '{}'::jsonb,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

create trigger tracking_sesiones_actualizado_en
  before update on public.tracking_sesiones
  for each row execute function public.set_actualizado_en();

create index tracking_sesiones_traslado_idx
  on public.tracking_sesiones (traslado_id, creado_en desc);

-- 10.1 — una sola sesión activa por traslado (serializa la flota)
create unique index tracking_sesion_activa_uidx
  on public.tracking_sesiones (traslado_id)
  where estado = 'activa';

-- Backfill: sesiones activas para traslados no terminales con conductor.
insert into public.tracking_sesiones (traslado_id, conductor_id, estado, iniciada_en, ultimo_heartbeat_en, metadata)
select t.id, t.conductor_id, 'activa', t.actualizado_en, s.ultimo_envio_en,
  jsonb_build_object('origen', 'backfill_fase10')
from public.traslados t
left join public.tracking_salud_traslado s on s.traslado_id = t.id
where t.conductor_id is not null
  and t.estado not in ('servicio_cerrado', 'servicio_cancelado', 'traslado_fallido');

do $$
declare
  v_traslados int;
  v_sesiones int;
begin
  select count(*) into v_traslados
  from public.traslados
  where conductor_id is not null
    and estado not in ('servicio_cerrado', 'servicio_cancelado', 'traslado_fallido');
  select count(distinct traslado_id) into v_sesiones
  from public.tracking_sesiones
  where estado = 'activa';
  if v_traslados <> v_sesiones then
    raise exception 'Backfill Fase 10 incompleto: % traslados vs % sesiones', v_traslados, v_sesiones;
  end if;
end $$;

-- 10.2 — inicio explícito e idempotente
create or replace function public.iniciar_sesion_tracking(p_traslado_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conductor_id uuid;
  v_sesion uuid;
begin
  select t.conductor_id into v_conductor_id
  from public.traslados t
  join public.conductores c on c.id = t.conductor_id
  where t.id = p_traslado_id
    and c.auth_user_id = auth.uid()
    and t.estado not in ('servicio_cerrado', 'servicio_cancelado', 'traslado_fallido');

  if v_conductor_id is null then
    if not public.es_admin() then
      raise exception 'Solo el conductor asignado o Torre inician tracking.';
    end if;
    select conductor_id into v_conductor_id
    from public.traslados where id = p_traslado_id;
    if v_conductor_id is null then raise exception 'El traslado no tiene conductor.'; end if;
  end if;

  insert into public.tracking_sesiones (traslado_id, conductor_id, estado, metadata)
  values (p_traslado_id, v_conductor_id, 'activa', jsonb_build_object('origen', 'inicio_explicito'))
  on conflict (traslado_id) where estado = 'activa' do nothing
  returning id into v_sesion;

  if v_sesion is null then
    select id into v_sesion from public.tracking_sesiones
    where traslado_id = p_traslado_id and estado = 'activa';
  end if;
  return v_sesion;
end;
$$;

-- 10.4/10.5/10.6/10.7 — heartbeat ligero: punto + salud + sesión + distancia.
create or replace function public.registrar_heartbeat_tracking(
  p_traslado_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_precision_m numeric default null,
  p_velocidad_mps numeric default null,
  p_bateria_pct integer default null,
  p_online boolean default true,
  p_plataforma text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conductor_id uuid;
  v_estado text;
  v_punto uuid;
  v_sesion uuid;
  v_dest_lat numeric;
  v_dest_lng numeric;
  v_prev_dist numeric;
  v_dist numeric;
begin
  if p_lat is null or p_lat not between -90 and 90
     or p_lng is null or p_lng not between -180 and 180 then
    raise exception 'Coordenadas inválidas.';
  end if;
  if p_precision_m is not null and (p_precision_m < 0 or p_precision_m > 10000) then
    raise exception 'Precisión inválida.';
  end if;
  if p_velocidad_mps is not null and (p_velocidad_mps < 0 or p_velocidad_mps > 120) then
    raise exception 'Velocidad inválida.';
  end if;
  if p_bateria_pct is not null and (p_bateria_pct < 0 or p_bateria_pct > 100) then
    raise exception 'Batería inválida.';
  end if;

  select t.conductor_id, t.estado::text, t.destino_lat, t.destino_lng
    into v_conductor_id, v_estado, v_dest_lat, v_dest_lng
  from public.traslados t
  join public.conductores c on c.id = t.conductor_id
  where t.id = p_traslado_id
    and c.auth_user_id = auth.uid()
    and t.estado::text not in ('servicio_cerrado', 'servicio_cancelado', 'traslado_fallido');

  if v_conductor_id is null then
    raise exception using errcode='42501', message='El conductor no está autorizado para registrar este traslado';
  end if;

  perform pg_advisory_xact_lock(hashtext('tracking:' || p_traslado_id::text));

  insert into public.ubicaciones_traslado (
    traslado_id, conductor_id, lat, lng, precision_m, velocidad_mps,
    bateria_pct, online, fuente, registrado_en
  ) values (
    p_traslado_id, v_conductor_id, p_lat, p_lng, p_precision_m, p_velocidad_mps,
    p_bateria_pct, coalesce(p_online, true), 'heartbeat', now()
  )
  returning id into v_punto;

  insert into public.tracking_salud_traslado (
    traslado_id, conductor_id, ultimo_punto_id, ultima_ubicacion_en,
    ultimo_envio_en, fuente, online, precision_m, actualizado_en
  ) values (
    p_traslado_id, v_conductor_id, v_punto, now(), now(),
    'heartbeat', coalesce(p_online, true), p_precision_m, now()
  )
  on conflict (traslado_id) do update set
    conductor_id = excluded.conductor_id,
    ultimo_punto_id = excluded.ultimo_punto_id,
    ultima_ubicacion_en = excluded.ultima_ubicacion_en,
    ultimo_envio_en = excluded.ultimo_envio_en,
    fuente = excluded.fuente,
    online = excluded.online,
    precision_m = excluded.precision_m,
    actualizado_en = now();

  -- 10.10 v1 — heurística de alejamiento (la polilínea completa es futura)
  if v_dest_lat is not null and v_dest_lng is not null then
    v_dist := 111.32 * sqrt(
      power((p_lat - v_dest_lat) * cos(radians((p_lat + v_dest_lat) / 2)), 2)
      + power(p_lng - v_dest_lng, 2)
    );
  end if;

  select ultima_distancia_destino_km into v_prev_dist
  from public.tracking_sesiones
  where traslado_id = p_traslado_id and estado = 'activa';

  insert into public.tracking_sesiones (traslado_id, conductor_id, estado, ultimo_heartbeat_en, ultima_lat, ultima_lng, ultima_precision_m, ultima_velocidad_mps, ultima_bateria_pct, ultima_distancia_destino_km, desviacion_sospechosa, plataforma, metadata)
  values (p_traslado_id, v_conductor_id, 'activa', now(), p_lat, p_lng, p_precision_m, p_velocidad_mps, p_bateria_pct, v_dist,
    coalesce(v_prev_dist is not null and v_dist is not null and v_dist > v_prev_dist + 0.5 and coalesce(p_velocidad_mps, 0) > 2, false),
    left(coalesce(p_plataforma, ''), 32),
    jsonb_build_object('origen', 'heartbeat_auto'))
  on conflict (traslado_id) where estado = 'activa' do update set
    ultimo_heartbeat_en = now(),
    ultima_lat = excluded.ultima_lat,
    ultima_lng = excluded.ultima_lng,
    ultima_precision_m = excluded.ultima_precision_m,
    ultima_velocidad_mps = excluded.ultima_velocidad_mps,
    ultima_bateria_pct = excluded.ultima_bateria_pct,
    ultima_distancia_destino_km = excluded.ultima_distancia_destino_km,
    desviacion_sospechosa = tracking_sesiones.desviacion_sospechosa or excluded.desviacion_sospechosa,
    plataforma = coalesce(nullif(excluded.plataforma, ''), tracking_sesiones.plataforma)
  returning id into v_sesion;

  -- si la fila ya existía, on conflict no retorna: leerla
  if v_sesion is null then
    select id into v_sesion from public.tracking_sesiones
    where traslado_id = p_traslado_id and estado = 'activa';
  end if;

  return jsonb_build_object(
    'sesion_id', v_sesion,
    'punto_id', v_punto,
    'salud', public.evaluar_salud_tracking(p_traslado_id)
  );
end;
$$;

-- 10.3 — cierre explícito + automático al terminar el traslado
create or replace function public.finalizar_sesion_tracking(p_traslado_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sesion uuid;
begin
  select id into v_sesion from public.tracking_sesiones
  where traslado_id = p_traslado_id and estado = 'activa'
  order by creado_en desc
  limit 1
  for update;

  if v_sesion is null then raise exception 'Sin sesión activa de tracking.'; end if;

  if not public.es_admin()
     and not exists (
       select 1 from public.tracking_sesiones s
       join public.conductores c on c.id = s.conductor_id
       where s.id = v_sesion and c.auth_user_id = auth.uid()
     ) then
    raise exception 'Solo el conductor de la sesión o Torre cierran tracking.';
  end if;

  update public.tracking_sesiones
  set estado = 'cerrada', finalizada_en = now()
  where id = v_sesion;

  return v_sesion;
end;
$$;

create or replace function public.cerrar_tracking_al_terminar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.estado::text in ('servicio_cerrado', 'servicio_cancelado', 'traslado_fallido')
     and old.estado::text is distinct from new.estado::text then
    update public.tracking_sesiones
    set estado = 'cerrada', finalizada_en = now(),
        metadata = metadata || jsonb_build_object('cierre', 'automatico_terminal', 'estado', new.estado::text)
    where traslado_id = new.id and estado = 'activa';
  end if;
  return new;
end;
$$;

create trigger traslados_cerrar_tracking
  after update of estado on public.traslados
  for each row execute function public.cerrar_tracking_al_terminar();

-- 10.8/10.9/10.12 — salud: HEALTHY | DEGRADED | STALE | OFFLINE + detenido.
create or replace function public.evaluar_salud_tracking(p_traslado_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sesion record;
  v_salud record;
  v_punto record;
  v_edad_min numeric;
begin
  select * into v_sesion from public.tracking_sesiones
  where traslado_id = p_traslado_id and estado = 'activa'
  order by creado_en desc
  limit 1;

  if v_sesion.id is null then
    return jsonb_build_object('estado', 'OFFLINE', 'motivo', 'Sin sesión de tracking',
      'detenido', false, 'ultimo_envio_en', null, 'sesion_id', null);
  end if;

  select * into v_salud from public.tracking_salud_traslado
  where traslado_id = p_traslado_id;

  if v_salud.ultimo_envio_en is null then
    return jsonb_build_object('estado', 'OFFLINE', 'motivo', 'Sin señal',
      'detenido', false, 'ultimo_envio_en', null, 'sesion_id', v_sesion.id);
  end if;

  v_edad_min := extract(epoch from (now() - v_salud.ultimo_envio_en)) / 60.0;

  if v_edad_min > 15 then
    return jsonb_build_object('estado', 'OFFLINE', 'motivo', 'Sin señal hace ' || round(v_edad_min)::text || ' min',
      'detenido', false, 'ultimo_envio_en', v_salud.ultimo_envio_en, 'sesion_id', v_sesion.id);
  end if;

  if v_edad_min > 5 then
    return jsonb_build_object('estado', 'STALE', 'motivo', 'Señal intermitente',
      'detenido', false, 'ultimo_envio_en', v_salud.ultimo_envio_en, 'sesion_id', v_sesion.id);
  end if;

  select velocidad_mps, bateria_pct into v_punto
  from public.ubicaciones_traslado
  where id = v_salud.ultimo_punto_id;

  if v_salud.precision_m is not null and v_salud.precision_m > 100 then
    return jsonb_build_object('estado', 'DEGRADED', 'motivo', 'GPS impreciso',
      'detenido', coalesce(v_punto.velocidad_mps, 99) < 0.5,
      'ultimo_envio_en', v_salud.ultimo_envio_en, 'sesion_id', v_sesion.id);
  end if;

  if v_punto.bateria_pct is not null and v_punto.bateria_pct < 20 then
    return jsonb_build_object('estado', 'DEGRADED', 'motivo', 'Batería baja del dispositivo',
      'detenido', coalesce(v_punto.velocidad_mps, 99) < 0.5,
      'ultimo_envio_en', v_salud.ultimo_envio_en, 'sesion_id', v_sesion.id);
  end if;

  return jsonb_build_object('estado', 'HEALTHY', 'motivo',
    case when coalesce(v_punto.velocidad_mps, 99) < 0.5 then 'Vehículo detenido' else 'Transmitiendo' end,
    'detenido', coalesce(v_punto.velocidad_mps, 99) < 0.5,
    'ultimo_envio_en', v_salud.ultimo_envio_en, 'sesion_id', v_sesion.id);
end;
$$;

-- RLS: lectura por parte; escritura solo vía RPC (definer)
alter table public.tracking_sesiones enable row level security;

create policy "admin_acceso_total_tracking_sesiones"
  on public.tracking_sesiones for all using (public.es_admin());

create policy "partes_ven_sesiones_tracking"
  on public.tracking_sesiones for select
  using (
    exists (
      select 1 from public.traslados t
      left join public.conductores c on c.id = t.conductor_id
      left join public.usuarios u on u.id = t.usuario_id
      where t.id = traslado_id
        and (c.auth_user_id = auth.uid() or u.auth_user_id = auth.uid())
    )
  );

grant select on public.tracking_sesiones to authenticated;
grant all on public.tracking_sesiones to service_role;
grant execute on function public.iniciar_sesion_tracking(uuid) to authenticated;
grant execute on function public.registrar_heartbeat_tracking(uuid, numeric, numeric, numeric, numeric, integer, boolean, text) to authenticated;
grant execute on function public.finalizar_sesion_tracking(uuid) to authenticated;
grant execute on function public.evaluar_salud_tracking(uuid) to authenticated;
