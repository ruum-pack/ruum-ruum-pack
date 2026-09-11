-- FASE 9 — Cadena digital de custodia: quién, qué, cuándo, dónde, con qué evidencia.
-- Convierte la evidencia suelta (fotos, inspecciones, GPS) en eventos
-- encadenados con hash (tamper-evident) y reconstruye el historial de todo
-- vehículo existente (backfill desde historial_estados_traslado de Fase 3).
-- Nombres del plan en minúsculas (convención repo): custody_events =
-- custodia_eventos, transfer_id = traslado_id, etc.

create extension if not exists pgcrypto with schema extensions;

create type public.tipo_evento_custodia as enum (
  'pickup_started',
  'vehicle_inspected',
  'vehicle_received',
  'transfer_started',
  'stop_registered',
  'incident_reported',
  'destination_reached',
  'delivery_inspection',
  'vehicle_delivered',
  'delivery_accepted'
);

create table public.custodia_eventos (
  id                uuid primary key default gen_random_uuid(),
  -- orden estricto de inserción: los UUID son aleatorios y creado_en empata
  -- dentro de una transacción; sin esto la cadena puede bifurcarse.
  n_orden           bigint generated always as identity,
  traslado_id       uuid not null references public.traslados(id) on delete cascade,
  vehiculo_id       uuid references public.vehiculos(id) on delete set null,
  actor_id          uuid,
  actor_tipo        text not null default 'sistema'
    constraint custodia_eventos_actor_tipo_check
    check (actor_tipo in ('conductor', 'usuario', 'admin', 'sistema')),
  tipo              public.tipo_evento_custodia not null,
  lat               numeric(10,7) constraint custodia_lat_valida check (lat is null or lat between -90 and 90),
  lng               numeric(10,7) constraint custodia_lng_valida check (lng is null or lng between -180 and 180),
  odometro          numeric(12,1) constraint custodia_odometro_no_negativo check (odometro is null or odometro >= 0),
  combustible       text,
  ocurrido_en       timestamptz not null default now(),
  inspeccion_id     uuid references public.evidencia_inspecciones(id) on delete set null,
  firma_metodo      text,
  firma_referencia  text,
  pin_verificado    boolean not null default false,
  notas             text,
  metadata          jsonb not null default '{}'::jsonb,
  prev_hash         text not null default 'GENESIS',
  hash_cadena       text not null default '',
  creado_en         timestamptz not null default now()
);

create index custodia_eventos_traslado_idx
  on public.custodia_eventos (traslado_id, ocurrido_en);
create index custodia_eventos_vehiculo_idx
  on public.custodia_eventos (vehiculo_id, ocurrido_en)
  where vehiculo_id is not null;

-- 9.4 — fotos asociadas (join auditable; la foto sigue viviendo en evidencia_fotos)
create table public.custodia_evento_fotos (
  evento_id uuid not null references public.custodia_eventos(id) on delete cascade,
  foto_id   uuid not null references public.evidencia_fotos(id) on delete cascade,
  primary key (evento_id, foto_id)
);

create index custodia_evento_fotos_foto_idx
  on public.custodia_evento_fotos (foto_id);

-- 9.11 — sello de cadena: cada evento encadena el hash previo del traslado.
create or replace function public.sellar_evento_custodia()
returns trigger
language plpgsql
as $$
declare
  v_prev text;
  v_carga text;
begin
  -- serialize inserts per traslado so concurrent writers can't fork the chain
  perform pg_advisory_xact_lock(hashtext('custodia:' || new.traslado_id::text));

  select hash_cadena into v_prev
  from public.custodia_eventos
  where traslado_id = new.traslado_id
  order by n_orden desc
  limit 1;

  new.prev_hash := coalesce(v_prev, 'GENESIS');
  v_carga := new.prev_hash || '|' || new.id::text || '|' || new.traslado_id::text
    || '|' || new.tipo::text || '|' || new.ocurrido_en::text
    || '|' || coalesce(new.actor_id::text, '') || '|' || new.actor_tipo
    || '|' || coalesce(new.odometro::text, '');
  new.hash_cadena := encode(extensions.digest(v_carga, 'sha256'), 'hex');
  return new;
end;
$$;

create trigger custodia_eventos_sellar
  before insert on public.custodia_eventos
  for each row execute function public.sellar_evento_custodia();

-- append-only: la cadena no se reescribe ni se borra (patrón consentimientos)
create or replace function public.bloquear_mutacion_custodia()
returns trigger
language plpgsql
as $$
begin
  raise exception 'custodia_append_only: los eventos de custodia no se modifican ni eliminan';
end;
$$;

create trigger custodia_eventos_inmutables
  before update or delete on public.custodia_eventos
  for each row execute function public.bloquear_mutacion_custodia();

create trigger custodia_evento_fotos_inmutables
  before update or delete on public.custodia_evento_fotos
  for each row execute function public.bloquear_mutacion_custodia();

-- 9.14 — verificación de integridad: camina los links de hash desde la cabeza
-- (hash que nadie referencia como previo). No depende de timestamps: dos
-- eventos del mismo instante comparten creado_en y el orden temporal empata.
create or replace function public.verificar_cadena_custodia(p_traslado_id uuid)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_total int;
  v_cabezas int;
  v_hash text;
  v_n int := 0;
  r record;
  v_carga text;
  v_calc text;
begin
  select count(*) into v_total
  from public.custodia_eventos
  where traslado_id = p_traslado_id;
  if v_total = 0 then return true; end if;

  select count(*) into v_cabezas
  from public.custodia_eventos e
  where e.traslado_id = p_traslado_id
    and not exists (
      select 1 from public.custodia_eventos h
      where h.traslado_id = p_traslado_id
        and h.prev_hash = e.hash_cadena
    );
  if v_cabezas <> 1 then return false; end if;

  select e.hash_cadena into v_hash
  from public.custodia_eventos e
  where e.traslado_id = p_traslado_id
    and not exists (
      select 1 from public.custodia_eventos h
      where h.traslado_id = p_traslado_id
        and h.prev_hash = e.hash_cadena
    );

  loop
    select * into r
    from public.custodia_eventos
    where traslado_id = p_traslado_id and hash_cadena = v_hash;
    if not found then return false; end if;

    v_carga := r.prev_hash || '|' || r.id::text || '|' || r.traslado_id::text
      || '|' || r.tipo::text || '|' || r.ocurrido_en::text
      || '|' || coalesce(r.actor_id::text, '') || '|' || r.actor_tipo
      || '|' || coalesce(r.odometro::text, '');
    v_calc := encode(extensions.digest(v_carga, 'sha256'), 'hex');
    if v_calc is distinct from r.hash_cadena then return false; end if;

    v_n := v_n + 1;
    if r.prev_hash = 'GENESIS' then exit; end if;
    if v_n > v_total then return false; end if;
    v_hash := r.prev_hash;
  end loop;

  return v_n = v_total;
end;
$$;

-- Backfill: reconstruye la cadena de todo traslado existente desde el
-- historial de estados (Fase 3) + inspecciones (odómetro/combustible).
do $$
declare
  v_traslado record;
  v_hist record;
  v_tipo public.tipo_evento_custodia;
  v_evento uuid;
  v_vehiculo uuid;
begin
  for v_traslado in select id, vehiculo_id from public.traslados order by creado_en, id
  loop
    v_vehiculo := v_traslado.vehiculo_id;

    for v_hist in
      select estado_nuevo, actor_id, actor_tipo, motivo, creado_en
      from public.historial_estados_traslado
      where traslado_id = v_traslado.id
      order by creado_en, id
    loop
      v_tipo := case v_hist.estado_nuevo
        when 'conductor_en_punto_de_recoleccion' then 'pickup_started'
        when 'evidencia_inicial_completada' then 'vehicle_inspected'
        when 'vehiculo_recibido' then 'vehicle_received'
        when 'traslado_en_curso' then 'transfer_started'
        when 'incidencia_reportada' then 'incident_reported'
        when 'traslado_fallido' then 'incident_reported'
        when 'llegada_a_destino' then 'destination_reached'
        when 'evidencia_final_completada' then 'delivery_inspection'
        when 'entrega_confirmada' then 'vehicle_delivered'
        when 'servicio_cerrado' then 'delivery_accepted'
        else null
      end;
      if v_tipo is null then continue; end if;

      insert into public.custodia_eventos (
        traslado_id, vehiculo_id, actor_id, actor_tipo, tipo,
        notas, metadata, ocurrido_en, creado_en
      ) values (
        v_traslado.id, v_vehiculo, v_hist.actor_id, v_hist.actor_tipo, v_tipo,
        v_hist.motivo,
        jsonb_build_object('origen', 'backfill_fase9', 'estado_legacy', v_hist.estado_nuevo),
        v_hist.creado_en, v_hist.creado_en
      )
      returning id into v_evento;

      -- 9.8/9.5 — odómetro y combustible de la inspección de la fase
      if v_tipo in ('vehicle_received', 'transfer_started') then
        update public.custodia_eventos e
        set odometro = i.kilometraje,
            combustible = i.combustible,
            inspeccion_id = i.id
        from public.evidencia_inspecciones i
        where e.id = v_evento
          and i.traslado_id = v_traslado.id
          and i.tipo = 'inicial';
      elsif v_tipo in ('vehicle_delivered', 'delivery_accepted') then
        update public.custodia_eventos e
        set odometro = i.kilometraje,
            combustible = i.combustible,
            inspeccion_id = i.id
        from public.evidencia_inspecciones i
        where e.id = v_evento
          and i.traslado_id = v_traslado.id
          and i.tipo = 'final';
      end if;
    end loop;

    -- traslados sin historial: retrato del estado actual
    if not exists (select 1 from public.custodia_eventos where traslado_id = v_traslado.id) then
      select case t.estado
        when 'conductor_en_punto_de_recoleccion' then 'pickup_started'
        when 'evidencia_inicial_completada' then 'vehicle_inspected'
        when 'vehiculo_recibido' then 'vehicle_received'
        when 'traslado_en_curso' then 'transfer_started'
        when 'incidencia_reportada' then 'incident_reported'
        when 'traslado_fallido' then 'incident_reported'
        when 'llegada_a_destino' then 'destination_reached'
        when 'evidencia_final_completada' then 'delivery_inspection'
        when 'entrega_confirmada' then 'vehicle_delivered'
        when 'servicio_cerrado' then 'delivery_accepted'
        else null
      end into v_tipo
      from public.traslados t
      where t.id = v_traslado.id;

      if v_tipo is not null then
        insert into public.custodia_eventos (traslado_id, vehiculo_id, actor_tipo, tipo, notas, metadata)
        values (v_traslado.id, v_vehiculo, 'sistema', v_tipo,
          'Estado existente al habilitar la custodia.',
          jsonb_build_object('origen', 'backfill_fase9'));
      end if;
    end if;
  end loop;
end $$;

-- 9.4 — enlaza fotos existentes a su evento de inspección más cercano
insert into public.custodia_evento_fotos (evento_id, foto_id)
select distinct on (f.id) e.id, f.id
from public.evidencia_fotos f
join public.custodia_eventos e
  on e.traslado_id = f.traslado_id
  and e.tipo = case f.tipo when 'inicial' then 'vehicle_inspected'::public.tipo_evento_custodia
                           else 'delivery_inspection'::public.tipo_evento_custodia end
order by f.id, e.creado_en;

-- Registro explícito (conductores, Torre, dueño): valida pertenencia de
-- evidencias, exige odómetro monótono y sella por trigger.
create or replace function public.registrar_evento_custodia(
  p_traslado_id uuid,
  p_tipo public.tipo_evento_custodia,
  p_lat numeric default null,
  p_lng numeric default null,
  p_odometro numeric default null,
  p_combustible text default null,
  p_ocurrido_en timestamptz default null,
  p_foto_ids uuid[] default '{}',
  p_inspeccion_id uuid default null,
  p_firma_metodo text default null,
  p_pin_verificado boolean default false,
  p_notas text default null,
  p_metadata jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_traslado record;
  v_actor_tipo text;
  v_evento uuid;
  v_foto uuid;
  v_max_odo numeric;
begin
  select * into v_traslado from public.traslados where id = p_traslado_id;
  if v_traslado.id is null then raise exception 'Traslado no encontrado.'; end if;

  select case
    when public.es_admin() then 'admin'
    when exists (select 1 from public.conductores c where c.id = v_traslado.conductor_id and c.auth_user_id = auth.uid()) then 'conductor'
    when exists (select 1 from public.usuarios u where u.id = v_traslado.usuario_id and u.auth_user_id = auth.uid()) then 'usuario'
    else null
  end into v_actor_tipo;

  if v_actor_tipo is null then raise exception 'Sin permiso para registrar custodia en este traslado.'; end if;

  foreach v_foto in array coalesce(p_foto_ids, '{}')
  loop
    if not exists (select 1 from public.evidencia_fotos where id = v_foto and traslado_id = p_traslado_id) then
      raise exception 'La evidencia % no pertenece al traslado.', v_foto;
    end if;
  end loop;

  if p_inspeccion_id is not null
     and not exists (select 1 from public.evidencia_inspecciones where id = p_inspeccion_id and traslado_id = p_traslado_id) then
    raise exception 'La inspección no pertenece al traslado.';
  end if;

  if p_odometro is not null then
    if p_odometro < 0 then raise exception 'Kilometraje inválido.'; end if;
    select max(odometro) into v_max_odo
    from public.custodia_eventos
    where traslado_id = p_traslado_id and odometro is not null;
    if v_max_odo is not null and p_odometro < v_max_odo then
      raise exception 'Kilometraje regresivo: % menor que % registrado.', p_odometro, v_max_odo;
    end if;
  end if;

  insert into public.custodia_eventos (
    traslado_id, vehiculo_id, actor_id, actor_tipo, tipo,
    lat, lng, odometro, combustible, ocurrido_en, inspeccion_id,
    firma_metodo, pin_verificado, notas, metadata
  ) values (
    p_traslado_id, v_traslado.vehiculo_id, auth.uid(), v_actor_tipo, p_tipo,
    p_lat, p_lng, p_odometro, p_combustible, coalesce(p_ocurrido_en, now()), p_inspeccion_id,
    p_firma_metodo, coalesce(p_pin_verificado, false), p_notas, coalesce(p_metadata, '{}')
  )
  returning id into v_evento;

  foreach v_foto in array coalesce(p_foto_ids, '{}')
  loop
    insert into public.custodia_evento_fotos (evento_id, foto_id)
    values (v_evento, v_foto)
    on conflict do nothing;
  end loop;

  return v_evento;
end;
$$;

-- Mapeo único transición → evento (lo usan el trigger y el backfill conceptual;
-- el backfill lleva su copia congelada a propósito: es historia inmutable).
create or replace function public.custodia_tipo_desde_estado(e public.estado_traslado)
returns public.tipo_evento_custodia
language sql
immutable
set search_path = public, pg_temp
as $$
  select case e
    when 'conductor_en_punto_de_recoleccion' then 'pickup_started'
    when 'evidencia_inicial_completada' then 'vehicle_inspected'
    when 'vehiculo_recibido' then 'vehicle_received'
    when 'traslado_en_curso' then 'transfer_started'
    when 'incidencia_reportada' then 'incident_reported'
    when 'traslado_fallido' then 'incident_reported'
    when 'llegada_a_destino' then 'destination_reached'
    when 'evidencia_final_completada' then 'delivery_inspection'
    when 'entrega_confirmada' then 'vehicle_delivered'
    when 'servicio_cerrado' then 'delivery_accepted'
    else null::public.tipo_evento_custodia
  end;
$$;

-- Auto-observación: cada transición mapeada deja su evento de sistema
-- (actor real si hay sesión). Las capturas explícitas (GPS/odo/fotos) llegan
-- por registrar_evento_custodia; ambas capas se fusionan en el timeline.
create or replace function public.sincronizar_custodia_traslado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo public.tipo_evento_custodia;
  v_actor_tipo text;
begin
  if new.estado is not distinct from old.estado then return new; end if;

  v_tipo := public.custodia_tipo_desde_estado(new.estado);
  if v_tipo is null then return new; end if;

  select case
    when public.es_admin() then 'admin'
    when exists (select 1 from public.conductores c where c.id = new.conductor_id and c.auth_user_id = auth.uid()) then 'conductor'
    when exists (select 1 from public.usuarios u where u.id = new.usuario_id and u.auth_user_id = auth.uid()) then 'usuario'
    else 'sistema'
  end into v_actor_tipo;

  insert into public.custodia_eventos (traslado_id, vehiculo_id, actor_id, actor_tipo, tipo, metadata)
  values (new.id, new.vehiculo_id, auth.uid(), v_actor_tipo, v_tipo,
    jsonb_build_object('origen', 'transicion_estado', 'estado_legacy', new.estado));

  return new;
end;
$$;

create trigger traslados_sincronizar_custodia
  after update of estado on public.traslados
  for each row execute function public.sincronizar_custodia_traslado();

-- RLS: lectura por parte (mismo criterio que evidencia_fotos); escritura
-- vía RPC/Torre; sin update/delete (append-only por trigger + denegación base)
alter table public.custodia_eventos enable row level security;
alter table public.custodia_evento_fotos enable row level security;

create policy "admin_acceso_total_custodia"
  on public.custodia_eventos for all using (public.es_admin());
create policy "admin_acceso_total_custodia_fotos"
  on public.custodia_evento_fotos for all using (public.es_admin());

create policy "usuario_ve_custodia_sus_traslados"
  on public.custodia_eventos for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "conductor_ve_custodia_asignados"
  on public.custodia_eventos for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "conductor_registra_custodia_asignados"
  on public.custodia_eventos for insert
  with check (
    traslado_id in (
      select t.id from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "usuario_registra_custodia_sus_traslados"
  on public.custodia_eventos for insert
  with check (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "partes_ven_fotos_custodia"
  on public.custodia_evento_fotos for select
  using (
    evento_id in (select id from public.custodia_eventos)
  );

create policy "conductor_registra_fotos_custodia"
  on public.custodia_evento_fotos for insert
  with check (
    evento_id in (select id from public.custodia_eventos)
  );

grant select, insert on public.custodia_eventos to authenticated;
grant select, insert on public.custodia_evento_fotos to authenticated;
grant all on public.custodia_eventos to service_role;
grant all on public.custodia_evento_fotos to service_role;
grant execute on function public.registrar_evento_custodia(uuid, public.tipo_evento_custodia, numeric, numeric, numeric, text, timestamptz, uuid[], uuid, text, boolean, text, jsonb) to authenticated;
grant execute on function public.verificar_cadena_custodia(uuid) to authenticated;

-- Autoverificación: enum completo y cobertura total del backfill.
do $$
declare
  v_tipos int;
begin
  select count(*) into v_tipos from pg_enum where enumtypid = 'public.tipo_evento_custodia'::regtype;
  if v_tipos <> 10 then
    raise exception 'tipo_evento_custodia debe tener 10 valores, tiene %', v_tipos;
  end if;
end $$;

do $$
declare
  v_sin_eventos int;
begin
  select count(*) into v_sin_eventos
  from public.traslados t
  where not exists (select 1 from public.custodia_eventos e where e.traslado_id = t.id)
    and t.estado in (
      'conductor_en_punto_de_recoleccion', 'evidencia_inicial_completada',
      'vehiculo_recibido', 'traslado_en_curso', 'incidencia_reportada',
      'traslado_fallido', 'llegada_a_destino', 'evidencia_final_completada',
      'entrega_confirmada', 'servicio_cerrado'
    );
  if v_sin_eventos <> 0 then
    raise exception 'Backfill Fase 9 incompleto: % traslados con historia sin eventos', v_sin_eventos;
  end if;
end $$;
