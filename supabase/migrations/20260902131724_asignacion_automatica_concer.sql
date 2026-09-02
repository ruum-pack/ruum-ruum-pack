-- ADR-003 -- Competencia auditable para asignación automática de traslados.
-- CONCER determina capacidad; puntualidad y equidad resuelven entre elegibles.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.politica_asignacion (
  id boolean primary key default true check (id),
  version integer not null default 1 check (version > 0),
  ventana_solicitud_segundos integer not null default 60 check (ventana_solicitud_segundos between 15 and 900),
  tolerancia_puntualidad_min integer not null default 15 check (tolerancia_puntualidad_min between 0 and 120),
  velocidad_aproximacion_kmh numeric(5,2) not null default 35 check (velocidad_aproximacion_kmh between 5 and 130),
  ubicacion_requerida_programados boolean not null default false,
  muestra_minima_puntualidad integer not null default 5 check (muestra_minima_puntualidad between 1 and 100),
  actualizado_en timestamptz not null default now()
);

insert into private.politica_asignacion (id) values (true)
on conflict (id) do nothing;

create table public.certificaciones_operativas_conductor (
  id uuid primary key default gen_random_uuid(),
  conductor_id uuid not null references public.conductores(id) on delete cascade,
  tipo text not null check (tipo in ('vehiculos_luxury', 'vehiculos_coleccion')),
  vigente_desde timestamptz not null default now(),
  vigente_hasta timestamptz,
  revocada_en timestamptz,
  creada_en timestamptz not null default now(),
  constraint certificacion_vigencia_valida check (vigente_hasta is null or vigente_hasta > vigente_desde)
);

create unique index certificaciones_operativas_activas_uidx
  on public.certificaciones_operativas_conductor (conductor_id, tipo)
  where revocada_en is null;

create table public.competencias_asignacion (
  id uuid primary key default gen_random_uuid(),
  traslado_id uuid not null references public.traslados(id) on delete cascade,
  estado text not null default 'abierta'
    check (estado in ('abierta', 'resuelta', 'sin_solicitudes', 'cancelada')),
  politica_version integer not null,
  abierta_en timestamptz not null default now(),
  cierra_en timestamptz not null,
  resuelta_en timestamptz,
  conductor_seleccionado_id uuid references public.conductores(id) on delete set null,
  detalle_resolucion jsonb not null default '{}'::jsonb,
  constraint competencia_ventana_valida check (cierra_en > abierta_en)
);

create unique index competencias_asignacion_abierta_uidx
  on public.competencias_asignacion (traslado_id)
  where estado = 'abierta';
create index competencias_asignacion_vencimiento_idx
  on public.competencias_asignacion (estado, cierra_en);

create table public.solicitudes_asignacion (
  id uuid primary key default gen_random_uuid(),
  competencia_id uuid not null references public.competencias_asignacion(id) on delete cascade,
  traslado_id uuid not null references public.traslados(id) on delete cascade,
  conductor_id uuid not null references public.conductores(id) on delete cascade,
  estado text not null default 'solicitada'
    check (estado in ('solicitada', 'seleccionada', 'no_seleccionada', 'no_elegible', 'cancelada')),
  categoria_puntualidad text not null
    check (categoria_puntualidad in ('a', 'b', 'c', 'sin_datos')),
  puntualidad_porcentaje numeric(6,5),
  puntualidad_muestra integer not null default 0,
  asignaciones_7d integer not null default 0,
  ultima_asignacion_en timestamptz,
  clave_desempate text not null,
  ubicacion_lat numeric(10,7),
  ubicacion_lng numeric(10,7),
  distancia_origen_km numeric(10,2),
  eta_aproximado_min integer,
  viabilidad text not null check (viabilidad in ('confirmada', 'sin_ubicacion', 'no_aplica')),
  elegibilidad_snapshot jsonb not null,
  solicitada_en timestamptz not null default now(),
  unique (competencia_id, conductor_id),
  constraint solicitud_ubicacion_completa check ((ubicacion_lat is null) = (ubicacion_lng is null))
);

create index solicitudes_asignacion_resolucion_idx
  on public.solicitudes_asignacion (competencia_id, estado, categoria_puntualidad, asignaciones_7d);
create index solicitudes_asignacion_conductor_idx
  on public.solicitudes_asignacion (conductor_id, solicitada_en desc);

create table public.puntualidad_traslado (
  traslado_id uuid primary key references public.traslados(id) on delete cascade,
  conductor_id uuid not null references public.conductores(id) on delete cascade,
  objetivo_llegada_en timestamptz not null,
  llegada_real_en timestamptz not null,
  tolerancia_min integer not null,
  diferencia_min integer not null,
  resultado text not null check (resultado in ('puntual', 'retraso')),
  estado text not null check (estado in ('provisional', 'disputada', 'confirmada', 'descartada')),
  confirmar_despues_de timestamptz not null,
  disputa_id uuid references public.disputas(id) on delete set null,
  motivo_resolucion text,
  creada_en timestamptz not null default now(),
  confirmada_en timestamptz
);

create index puntualidad_conductor_muestra_idx
  on public.puntualidad_traslado (conductor_id, estado, llegada_real_en desc);

alter table public.certificaciones_operativas_conductor enable row level security;
alter table public.competencias_asignacion enable row level security;
alter table public.solicitudes_asignacion enable row level security;
alter table public.puntualidad_traslado enable row level security;

grant select, insert, update, delete on public.certificaciones_operativas_conductor to authenticated;
grant select on public.competencias_asignacion to authenticated;
grant select on public.solicitudes_asignacion to authenticated;
grant select on public.puntualidad_traslado to authenticated;

create policy "conductor_lee_sus_certificaciones_operativas"
  on public.certificaciones_operativas_conductor for select to authenticated
  using (conductor_id in (select c.id from public.conductores c where c.auth_user_id = (select auth.uid())));

create policy "admin_gestiona_certificaciones_operativas"
  on public.certificaciones_operativas_conductor for all to authenticated
  using (public.admin_tiene_permiso('conductores:validar'))
  with check (public.admin_tiene_permiso('conductores:validar'));

create policy "participante_lee_su_competencia"
  on public.competencias_asignacion for select to authenticated
  using (
    public.admin_tiene_permiso('viajes:leer')
    or exists (
      select 1 from public.solicitudes_asignacion s
      join public.conductores c on c.id = s.conductor_id
      where s.competencia_id = competencias_asignacion.id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy "conductor_lee_su_solicitud_asignacion"
  on public.solicitudes_asignacion for select to authenticated
  using (
    public.admin_tiene_permiso('viajes:leer')
    or conductor_id in (select c.id from public.conductores c where c.auth_user_id = (select auth.uid()))
  );

create policy "participantes_leen_puntualidad_traslado"
  on public.puntualidad_traslado for select to authenticated
  using (
    public.admin_tiene_permiso('conductores:leer')
    or conductor_id in (select c.id from public.conductores c where c.auth_user_id = (select auth.uid()))
    or traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = (select auth.uid())
    )
  );

create or replace function private.nivel_concer_orden(p_nivel public.nivel_concer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_nivel
    when 'basico' then 1
    when 'ejecutivo' then 2
    when 'luxury' then 3
    when 'coleccion' then 4
    else 0
  end
$$;

create or replace function private.distancia_haversine_km(
  p_lat_1 numeric,
  p_lng_1 numeric,
  p_lat_2 numeric,
  p_lng_2 numeric
) returns numeric
language sql
immutable
set search_path = ''
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians((p_lat_2 - p_lat_1)::double precision) / 2), 2)
    + cos(radians(p_lat_1::double precision))
      * cos(radians(p_lat_2::double precision))
      * power(sin(radians((p_lng_2 - p_lng_1)::double precision) / 2), 2)
  ))
$$;

create or replace function private.evaluar_elegibilidad_asignacion(
  p_traslado_id uuid,
  p_conductor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conductor record;
  v_traslado record;
  v_preferencias record;
  v_motivos text[] := array[]::text[];
  v_tipo_ruta text;
  v_nivel_conductor integer := 0;
  v_nivel_requerido integer := 1;
  v_es_nocturno boolean := false;
begin
  select c.* into v_conductor
  from public.conductores c
  where c.id = p_conductor_id;

  select t.*, v.tipo::text as vehiculo_tipo
    into v_traslado
  from public.traslados t
  join public.vehiculos v on v.id = t.vehiculo_id
  where t.id = p_traslado_id;

  if v_conductor.id is null then
    return jsonb_build_object('elegible', false, 'motivos', jsonb_build_array('conductor_no_encontrado'));
  end if;
  if v_traslado.id is null then
    return jsonb_build_object('elegible', false, 'motivos', jsonb_build_array('traslado_no_encontrado'));
  end if;

  select p.* into v_preferencias
  from public.preferencias_conductor p
  where p.conductor_id = p_conductor_id;

  if v_conductor.estado::text not in ('activo', 'modo_prueba_supervisada') then
    v_motivos := array_append(v_motivos, 'estado_conductor_no_operativo');
  end if;
  if coalesce(v_conductor.estado_expediente::text, '') <> 'aprobado' then
    v_motivos := array_append(v_motivos, 'expediente_no_aprobado');
  end if;
  if not coalesce(v_conductor.documentos_vigentes, false) then
    v_motivos := array_append(v_motivos, 'documentos_no_vigentes');
  end if;
  if coalesce(v_conductor.suspensiones_activas, 0) > 0 then
    v_motivos := array_append(v_motivos, 'suspension_activa');
  end if;
  if v_traslado.estado::text <> 'pendiente_de_conductor' or v_traslado.conductor_id is not null then
    v_motivos := array_append(v_motivos, 'traslado_no_disponible');
  end if;

  v_tipo_ruta := case
    when coalesce(v_traslado.tipo_ruta, 'local') = 'local'
      or lower(coalesce(v_traslado.origen_ciudad, '')) = lower(coalesce(v_traslado.destino_ciudad, ''))
      then 'intraurbana'
    when v_traslado.distancia_km is not null and v_traslado.distancia_km <= 100
      then 'interurbana_menos_100km'
    else 'interurbana_mas_100km'
  end;

  v_nivel_conductor := private.nivel_concer_orden(v_conductor.nivel_operativo_vigente);
  v_nivel_requerido := greatest(
    case v_traslado.vehiculo_tipo
      when 'coleccion' then 4
      when 'luxury' then 3
      when 'pick_up' then 2
      when 'van' then 2
      else 1
    end,
    case v_tipo_ruta
      when 'interurbana_mas_100km' then 3
      when 'interurbana_menos_100km' then 2
      else 1
    end
  );

  if v_nivel_conductor < v_nivel_requerido then
    v_motivos := array_append(v_motivos, 'nivel_concer_insuficiente');
  end if;
  if v_nivel_requerido >= 2 and coalesce(v_conductor.incidencias_graves_6m, 0) > 0 then
    v_motivos := array_append(v_motivos, 'incidencias_graves_6m');
  end if;
  if v_nivel_requerido >= 3 and coalesce(v_conductor.incidencias_graves_12m, 0) > 0 then
    v_motivos := array_append(v_motivos, 'incidencias_graves_12m');
  end if;
  if v_nivel_requerido >= 3 and not exists (
    select 1 from public.certificaciones_operativas_conductor co
    where co.conductor_id = p_conductor_id
      and co.tipo = 'vehiculos_luxury'
      and co.revocada_en is null
      and (co.vigente_hasta is null or co.vigente_hasta > now())
  ) then
    v_motivos := array_append(v_motivos, 'certificacion_luxury_requerida');
  end if;
  if v_nivel_requerido >= 4 and not exists (
    select 1 from public.certificaciones_operativas_conductor co
    where co.conductor_id = p_conductor_id
      and co.tipo = 'vehiculos_coleccion'
      and co.revocada_en is null
      and (co.vigente_hasta is null or co.vigente_hasta > now())
  ) then
    v_motivos := array_append(v_motivos, 'certificacion_coleccion_requerida');
  end if;

  if coalesce(v_preferencias.modo_no_molestar, false) then
    v_motivos := array_append(v_motivos, 'conductor_no_disponible');
  end if;
  if v_tipo_ruta = 'intraurbana' and not coalesce(v_preferencias.viajes_locales, true) then
    v_motivos := array_append(v_motivos, 'preferencia_no_locales');
  end if;
  if v_tipo_ruta <> 'intraurbana' and not coalesce(v_preferencias.viajes_foraneos, true) then
    v_motivos := array_append(v_motivos, 'preferencia_no_foraneos');
  end if;

  if v_traslado.fecha_hora_programada is not null then
    v_es_nocturno := extract(hour from v_traslado.fecha_hora_programada at time zone 'America/Mexico_City') >= 22
      or extract(hour from v_traslado.fecha_hora_programada at time zone 'America/Mexico_City') < 6;
  end if;
  if v_es_nocturno and not coalesce(v_preferencias.viajes_nocturnos, false) then
    v_motivos := array_append(v_motivos, 'preferencia_no_nocturnos');
  end if;

  if exists (
    select 1 from public.traslados ocupado
    where ocupado.conductor_id = p_conductor_id
      and ocupado.id <> p_traslado_id
      and ocupado.estado::text in (
        'conductor_asignado', 'conductor_en_camino_al_origen', 'conductor_en_punto_de_recoleccion',
        'verificacion_vehiculo_en_proceso', 'evidencia_inicial_en_proceso', 'evidencia_inicial_completada',
        'vehiculo_recibido', 'traslado_en_curso', 'incidencia_reportada', 'llegada_a_destino',
        'evidencia_final_en_proceso', 'evidencia_final_completada', 'entrega_confirmada',
        'pago_pendiente', 'pago_completado'
      )
  ) then
    v_motivos := array_append(v_motivos, 'conductor_con_traslado_activo');
  end if;

  return jsonb_build_object(
    'elegible', cardinality(v_motivos) = 0,
    'motivos', to_jsonb(v_motivos),
    'tipo_ruta', v_tipo_ruta,
    'nivel_conductor', v_nivel_conductor,
    'nivel_requerido', v_nivel_requerido
  );
end;
$$;

create or replace function private.resumen_puntualidad_conductor(p_conductor_id uuid)
returns table(categoria text, porcentaje numeric, muestra integer)
language sql
security definer
set search_path = ''
as $$
  with politica as (
    select muestra_minima_puntualidad from private.politica_asignacion where id
  ), muestra_base as (
    select p.resultado
    from public.puntualidad_traslado p
    where p.conductor_id = p_conductor_id
      and p.estado = 'confirmada'
      and p.llegada_real_en >= now() - interval '6 months'
    order by p.llegada_real_en desc
    limit 50
  ), resumen as (
    select count(*)::integer total,
      count(*) filter (where resultado = 'puntual')::integer puntuales
    from muestra_base
  )
  select
    case
      when r.total < po.muestra_minima_puntualidad then 'sin_datos'
      when r.puntuales::numeric / nullif(r.total, 0) >= 0.95 then 'a'
      when r.puntuales::numeric / nullif(r.total, 0) >= 0.85 then 'b'
      else 'c'
    end,
    case when r.total = 0 then null else round(r.puntuales::numeric / r.total, 5) end,
    r.total
  from resumen r cross join politica po
$$;

create or replace function private.estadisticas_equidad_conductor(p_conductor_id uuid)
returns table(asignaciones_7d integer, ultima_asignacion_en timestamptz)
language sql
security definer
set search_path = ''
as $$
  select
    count(*) filter (where ra.timestamp >= now() - interval '7 days')::integer,
    max(ra.timestamp)
  from public.registro_auditoria ra
  where ra.evento = 'asignacion_conductor'
    and (
      ra.datos->>'conductor_id' = p_conductor_id::text
      or (ra.actor = 'conductor' and ra.actor_id = p_conductor_id)
    )
$$;

create or replace function private.abrir_competencia_asignacion(p_traslado_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_politica private.politica_asignacion%rowtype;
begin
  if not exists (
    select 1 from public.traslados t
    where t.id = p_traslado_id and t.estado::text = 'pendiente_de_conductor' and t.conductor_id is null
  ) then
    return null;
  end if;

  select c.id into v_id
  from public.competencias_asignacion c
  where c.traslado_id = p_traslado_id and c.estado = 'abierta'
  for update;
  if v_id is not null then return v_id; end if;

  select * into strict v_politica from private.politica_asignacion where id;
  insert into public.competencias_asignacion (
    traslado_id, politica_version, cierra_en
  ) values (
    p_traslado_id, v_politica.version, now() + make_interval(secs => v_politica.ventana_solicitud_segundos)
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.trigger_abrir_competencia_asignacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado::text = 'pendiente_de_conductor'
     and new.conductor_id is null
     and (tg_op = 'INSERT' or old.estado::text is distinct from new.estado::text or old.conductor_id is not null) then
    perform private.abrir_competencia_asignacion(new.id);
  elsif new.estado::text <> 'pendiente_de_conductor' or new.conductor_id is not null then
    update public.competencias_asignacion
      set estado = 'cancelada', resuelta_en = now(), detalle_resolucion = jsonb_build_object('motivo', 'traslado_no_disponible')
    where traslado_id = new.id and estado = 'abierta';
  end if;
  return new;
end;
$$;

create trigger traslados_competencia_asignacion
  after insert or update of estado, conductor_id on public.traslados
  for each row execute function private.trigger_abrir_competencia_asignacion();

create or replace function public.conductor_solicita_asignacion(
  p_traslado_id uuid,
  p_lat numeric default null,
  p_lng numeric default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conductor_id uuid;
  v_competencia public.competencias_asignacion%rowtype;
  v_traslado public.traslados%rowtype;
  v_politica private.politica_asignacion%rowtype;
  v_elegibilidad jsonb;
  v_puntualidad record;
  v_equidad record;
  v_distancia numeric;
  v_eta integer;
  v_viabilidad text := 'no_aplica';
  v_existente boolean;
begin
  select c.id into v_conductor_id
  from public.conductores c
  where c.auth_user_id = (select auth.uid());
  if v_conductor_id is null then
    raise exception using errcode = '42501', message = 'Solo un conductor autenticado puede solicitar un traslado.';
  end if;
  if (p_lat is null) <> (p_lng is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180)) then
    raise exception using errcode = '22023', message = 'La ubicación enviada es inválida.';
  end if;

  select * into v_traslado from public.traslados where id = p_traslado_id for update;
  if v_traslado.id is null or v_traslado.estado::text <> 'pendiente_de_conductor' or v_traslado.conductor_id is not null then
    raise exception 'El traslado ya no está disponible.';
  end if;

  perform private.abrir_competencia_asignacion(p_traslado_id);
  select * into strict v_competencia
  from public.competencias_asignacion
  where traslado_id = p_traslado_id and estado = 'abierta'
  for update;
  if now() >= v_competencia.cierra_en then
    raise exception 'La ventana para solicitar este traslado ya cerró.';
  end if;

  v_elegibilidad := private.evaluar_elegibilidad_asignacion(p_traslado_id, v_conductor_id);
  if not (v_elegibilidad->>'elegible')::boolean then
    raise exception 'Conductor no elegible para este traslado: %', array_to_string(array(select jsonb_array_elements_text(v_elegibilidad->'motivos')), ', ');
  end if;

  select * into strict v_politica from private.politica_asignacion where id;
  if p_lat is not null and v_traslado.origen_lat is not null and v_traslado.origen_lng is not null then
    v_distancia := private.distancia_haversine_km(p_lat, p_lng, v_traslado.origen_lat, v_traslado.origen_lng);
    v_eta := ceil((v_distancia / v_politica.velocidad_aproximacion_kmh) * 60)::integer;
    v_viabilidad := 'confirmada';
    if v_traslado.fecha_hora_programada is not null
       and now() + make_interval(mins => v_eta) > v_traslado.fecha_hora_programada + make_interval(mins => v_politica.tolerancia_puntualidad_min) then
      raise exception 'La ubicación actual no permite llegar dentro de la ventana comprometida.';
    end if;
  elsif v_traslado.fecha_hora_programada is not null then
    if v_politica.ubicacion_requerida_programados then
      raise exception 'Comparte tu ubicación para validar que puedes llegar a tiempo.';
    end if;
    v_viabilidad := 'sin_ubicacion';
  end if;

  select exists (
    select 1 from public.solicitudes_asignacion s
    where s.competencia_id = v_competencia.id and s.conductor_id = v_conductor_id
  ) into v_existente;
  if not v_existente then
    select * into v_puntualidad from private.resumen_puntualidad_conductor(v_conductor_id);
    select * into v_equidad from private.estadisticas_equidad_conductor(v_conductor_id);

    insert into public.solicitudes_asignacion (
      competencia_id, traslado_id, conductor_id, categoria_puntualidad,
      puntualidad_porcentaje, puntualidad_muestra, asignaciones_7d,
      ultima_asignacion_en, clave_desempate, ubicacion_lat, ubicacion_lng,
      distancia_origen_km, eta_aproximado_min, viabilidad, elegibilidad_snapshot
    ) values (
      v_competencia.id, p_traslado_id, v_conductor_id, v_puntualidad.categoria,
      v_puntualidad.porcentaje, v_puntualidad.muestra, v_equidad.asignaciones_7d,
      v_equidad.ultima_asignacion_en, md5(v_competencia.id::text || ':' || v_conductor_id::text),
      p_lat, p_lng, round(v_distancia, 2), v_eta, v_viabilidad, v_elegibilidad
    );

    insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
    values (
      p_traslado_id, 'modificacion_traslado_activo', 'conductor', v_conductor_id,
      jsonb_build_object('accion', 'solicitud_asignacion', 'competencia_id', v_competencia.id,
        'categoria_puntualidad', v_puntualidad.categoria, 'asignaciones_7d', v_equidad.asignaciones_7d,
        'viabilidad', v_viabilidad)
    );
  end if;

  return jsonb_build_object(
    'competencia_id', v_competencia.id,
    'traslado_id', p_traslado_id,
    'estado', case when v_existente then 'ya_solicitada' else 'solicitada' end,
    'cierra_en', v_competencia.cierra_en,
    'categoria_puntualidad', coalesce(v_puntualidad.categoria,
      (select s.categoria_puntualidad from public.solicitudes_asignacion s where s.competencia_id = v_competencia.id and s.conductor_id = v_conductor_id)),
    'asignaciones_7d', coalesce(v_equidad.asignaciones_7d,
      (select s.asignaciones_7d from public.solicitudes_asignacion s where s.competencia_id = v_competencia.id and s.conductor_id = v_conductor_id)),
    'viabilidad', v_viabilidad
  );
end;
$$;

create or replace function private.resolver_competencia_asignacion(p_competencia_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competencia public.competencias_asignacion%rowtype;
  v_traslado public.traslados%rowtype;
  v_ganador record;
  v_ganancia numeric;
begin
  select * into v_competencia
  from public.competencias_asignacion
  where id = p_competencia_id
  for update;
  if v_competencia.id is null or v_competencia.estado <> 'abierta' or now() < v_competencia.cierra_en then
    return false;
  end if;

  select * into v_traslado from public.traslados where id = v_competencia.traslado_id for update;
  if v_traslado.id is null or v_traslado.estado::text <> 'pendiente_de_conductor' or v_traslado.conductor_id is not null then
    update public.competencias_asignacion
      set estado = 'cancelada', resuelta_en = now(), detalle_resolucion = jsonb_build_object('motivo', 'traslado_no_disponible')
    where id = p_competencia_id;
    update public.solicitudes_asignacion set estado = 'cancelada'
    where competencia_id = p_competencia_id and estado = 'solicitada';
    return false;
  end if;

  select s.*, evaluacion.resultado as elegibilidad_actual
    into v_ganador
  from public.solicitudes_asignacion s
  cross join lateral (
    select private.evaluar_elegibilidad_asignacion(s.traslado_id, s.conductor_id) resultado
  ) evaluacion
  where s.competencia_id = p_competencia_id
    and s.estado = 'solicitada'
    and (evaluacion.resultado->>'elegible')::boolean
  order by
    case s.categoria_puntualidad when 'a' then 3 when 'b' then 2 when 'sin_datos' then 2 else 1 end desc,
    s.asignaciones_7d asc,
    s.ultima_asignacion_en asc nulls first,
    s.clave_desempate asc
  limit 1;

  if v_ganador.id is null then
    update public.solicitudes_asignacion
      set estado = 'no_elegible'
    where competencia_id = p_competencia_id and estado = 'solicitada';
    update public.competencias_asignacion
      set estado = 'sin_solicitudes', resuelta_en = now(),
          detalle_resolucion = jsonb_build_object('motivo', 'sin_solicitudes_elegibles')
    where id = p_competencia_id;
    return false;
  end if;

  v_ganancia := public.calcular_pago_conductor_traslado(v_competencia.traslado_id, v_ganador.conductor_id);
  update public.traslados
    set estado = 'conductor_asignado', conductor_id = v_ganador.conductor_id,
        ganancia_conductor_congelada = v_ganancia
  where id = v_competencia.traslado_id
    and estado::text = 'pendiente_de_conductor' and conductor_id is null;
  if not found then return false; end if;

  update public.solicitudes_asignacion
    set estado = case when id = v_ganador.id then 'seleccionada' else 'no_seleccionada' end
  where competencia_id = p_competencia_id and estado = 'solicitada';

  update public.competencias_asignacion
    set estado = 'resuelta', resuelta_en = now(), conductor_seleccionado_id = v_ganador.conductor_id,
        detalle_resolucion = jsonb_build_object(
          'criterio', 'puntualidad_equidad_antiguedad_desempate_determinista',
          'categoria_puntualidad', v_ganador.categoria_puntualidad,
          'puntualidad_porcentaje', v_ganador.puntualidad_porcentaje,
          'puntualidad_muestra', v_ganador.puntualidad_muestra,
          'asignaciones_7d', v_ganador.asignaciones_7d,
          'ultima_asignacion_en', v_ganador.ultima_asignacion_en,
          'politica_version', v_competencia.politica_version,
          'ganancia_conductor_congelada', v_ganancia
        )
  where id = p_competencia_id;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    v_competencia.traslado_id, 'asignacion_conductor', 'sistema', v_competencia.id,
    jsonb_build_object('competencia_id', v_competencia.id, 'conductor_id', v_ganador.conductor_id,
      'politica_version', v_competencia.politica_version, 'categoria_puntualidad', v_ganador.categoria_puntualidad,
      'asignaciones_7d', v_ganador.asignaciones_7d, 'ganancia_conductor_congelada', v_ganancia)
  );
  return true;
end;
$$;

create or replace function private.confirmar_puntualidad_vencida()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_total integer;
begin
  update public.puntualidad_traslado
    set estado = 'confirmada', confirmada_en = now(), motivo_resolucion = 'plazo_disputa_vencido'
  where estado = 'provisional' and confirmar_despues_de <= now();
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

create or replace function public.procesar_competencias_asignacion()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_procesadas integer := 0;
  v_asignadas integer := 0;
  v_puntualidades integer := 0;
begin
  v_puntualidades := private.confirmar_puntualidad_vencida();
  for v_id in
    select c.id from public.competencias_asignacion c
    where c.estado = 'abierta' and c.cierra_en <= now()
    order by c.cierra_en
    limit 50
    for update skip locked
  loop
    v_procesadas := v_procesadas + 1;
    if private.resolver_competencia_asignacion(v_id) then
      v_asignadas := v_asignadas + 1;
    end if;
  end loop;
  return jsonb_build_object('procesadas', v_procesadas, 'asignadas', v_asignadas,
    'puntualidades_confirmadas', v_puntualidades);
end;
$$;

-- Compatibilidad controlada: clientes antiguos ya no pueden saltarse la competencia.
create or replace function public.conductor_acepta_viaje(p_traslado_id uuid)
returns public.estado_traslado
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.conductor_solicita_asignacion(p_traslado_id, null, null);
  return 'pendiente_de_conductor'::public.estado_traslado;
end;
$$;

create or replace function private.registrar_puntualidad_desde_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_traslado public.traslados%rowtype;
  v_tolerancia integer;
  v_diferencia integer;
begin
  if new.evento::text <> 'llegada_conductor_origen' or new.traslado_id is null then return new; end if;
  select * into v_traslado from public.traslados where id = new.traslado_id;
  if v_traslado.fecha_hora_programada is null or v_traslado.conductor_id is null then return new; end if;
  select tolerancia_puntualidad_min into v_tolerancia from private.politica_asignacion where id;
  v_diferencia := floor(extract(epoch from (new.timestamp - v_traslado.fecha_hora_programada)) / 60)::integer;

  insert into public.puntualidad_traslado (
    traslado_id, conductor_id, objetivo_llegada_en, llegada_real_en, tolerancia_min,
    diferencia_min, resultado, estado, confirmar_despues_de, confirmada_en
  ) values (
    new.traslado_id, v_traslado.conductor_id, v_traslado.fecha_hora_programada, new.timestamp,
    v_tolerancia, v_diferencia,
    case when v_diferencia <= v_tolerancia then 'puntual' else 'retraso' end,
    case when v_diferencia <= v_tolerancia then 'confirmada' else 'provisional' end,
    new.timestamp + interval '72 hours',
    case when v_diferencia <= v_tolerancia then new.timestamp else null end
  ) on conflict (traslado_id) do nothing;
  return new;
end;
$$;

create trigger auditoria_calcula_puntualidad
  after insert on public.registro_auditoria
  for each row execute function private.registrar_puntualidad_desde_auditoria();

create or replace function private.vincular_disputa_puntualidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo::text = 'calificacion_injusta' and new.abierta_por::text = 'conductor' then
    update public.puntualidad_traslado p
      set estado = 'disputada', disputa_id = new.id, motivo_resolucion = 'disputa_abierta'
    from public.traslados t
    join public.conductores c on c.id = t.conductor_id
    where p.traslado_id = new.traslado_id
      and t.id = new.traslado_id
      and p.conductor_id = c.id
      and p.estado = 'provisional';
  end if;
  return new;
end;
$$;

create trigger disputa_suspende_puntualidad
  after insert on public.disputas
  for each row execute function private.vincular_disputa_puntualidad();

create or replace function private.resolver_disputa_puntualidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo::text = 'calificacion_injusta'
     and new.estado::text in ('resuelta', 'resuelta_senior')
     and new.resolucion is not null then
    update public.puntualidad_traslado
      set estado = case when new.resolucion::text = 'en_contra' then 'confirmada' else 'descartada' end,
          confirmada_en = case when new.resolucion::text = 'en_contra' then now() else null end,
          motivo_resolucion = 'disputa_' || new.resolucion::text
    where disputa_id = new.id and estado = 'disputada';
  end if;
  return new;
end;
$$;

create trigger disputa_resuelve_puntualidad
  after update of estado, resolucion on public.disputas
  for each row execute function private.resolver_disputa_puntualidad();

create or replace function public.admin_resumen_disputas_perdidas_conductor(p_conductor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_total integer;
begin
  if not public.admin_tiene_permiso('conductores:leer') then
    raise exception using errcode = '42501', message = 'No tienes permiso para consultar conductores.';
  end if;
  select count(*)::integer into v_total
  from public.disputas d
  join public.traslados t on t.id = d.traslado_id
  where t.conductor_id = p_conductor_id
    and d.abierta_por::text = 'conductor'
    and d.tipo::text = 'calificacion_injusta'
    and d.resolucion::text = 'en_contra'
    and d.resuelta_en >= now() - interval '6 months';
  return jsonb_build_object('conductor_id', p_conductor_id, 'disputas_perdidas_6m', v_total,
    'requiere_revision', v_total >= 3);
end;
$$;

-- La contingencia manual usa la misma elegibilidad, permiso y congelación de pago.
create or replace function public.admin_asigna_conductor(
  p_traslado_id uuid,
  p_conductor_id uuid
) returns public.estado_traslado
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_traslado public.traslados%rowtype;
  v_elegibilidad jsonb;
  v_ganancia numeric;
  v_conductor_anterior uuid;
begin
  v_admin_id := public.admin_actual_id();
  if v_admin_id is null or not public.admin_tiene_permiso('viajes:gestionar') then
    raise exception using errcode = '42501', message = 'No tienes permiso para asignar conductores.';
  end if;
  select * into v_traslado from public.traslados where id = p_traslado_id for update;
  if v_traslado.id is null then raise exception 'No se encontró el traslado.'; end if;
  if v_traslado.estado::text not in ('pendiente_de_conductor', 'conductor_asignado') then
    raise exception 'La asignación manual solo procede desde pendiente_de_conductor o conductor_asignado.';
  end if;

  v_conductor_anterior := v_traslado.conductor_id;
  if v_traslado.estado::text = 'conductor_asignado' then
    update public.traslados set estado = 'pendiente_de_conductor', conductor_id = null where id = p_traslado_id;
  end if;
  v_elegibilidad := private.evaluar_elegibilidad_asignacion(p_traslado_id, p_conductor_id);
  if not (v_elegibilidad->>'elegible')::boolean then
    raise exception 'Conductor no elegible: %', array_to_string(array(select jsonb_array_elements_text(v_elegibilidad->'motivos')), ', ');
  end if;
  v_ganancia := public.calcular_pago_conductor_traslado(p_traslado_id, p_conductor_id);
  update public.traslados
    set estado = 'conductor_asignado', conductor_id = p_conductor_id, ganancia_conductor_congelada = v_ganancia
  where id = p_traslado_id;
  update public.competencias_asignacion
    set estado = 'cancelada', resuelta_en = now(), detalle_resolucion = jsonb_build_object('motivo', 'asignacion_manual')
  where traslado_id = p_traslado_id and estado = 'abierta';
  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (p_traslado_id, 'asignacion_conductor', 'admin', v_admin_id,
    jsonb_build_object('conductor_id', p_conductor_id, 'conductor_anterior_id', v_conductor_anterior,
      'estado_nuevo', 'conductor_asignado', 'ganancia_conductor_congelada', v_ganancia,
      'elegibilidad', v_elegibilidad));
  return 'conductor_asignado';
end;
$$;

revoke all on function public.conductor_solicita_asignacion(uuid, numeric, numeric) from public;
revoke all on function public.conductor_acepta_viaje(uuid) from public;
revoke all on function public.procesar_competencias_asignacion() from public;
revoke all on function public.admin_resumen_disputas_perdidas_conductor(uuid) from public;
revoke all on function public.admin_asigna_conductor(uuid, uuid) from public;
grant execute on function public.conductor_solicita_asignacion(uuid, numeric, numeric) to authenticated;
grant execute on function public.conductor_acepta_viaje(uuid) to authenticated;
grant execute on function public.procesar_competencias_asignacion() to service_role;
grant execute on function public.admin_resumen_disputas_perdidas_conductor(uuid) to authenticated;
grant execute on function public.admin_asigna_conductor(uuid, uuid) to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;

-- Activa el procesador sin asumir que pg_cron está disponible en cada entorno.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    execute $cron$
      select cron.schedule(
        'ruum-resolver-asignacion-automatica',
        '* * * * *',
        'select public.procesar_competencias_asignacion()'
      )
    $cron$;
  end if;
exception
  when insufficient_privilege or undefined_function or invalid_schema_name then
    raise notice 'pg_cron no disponible; programar public.procesar_competencias_asignacion() cada minuto en el entorno alojado.';
end;
$$;

-- Abre competencia para oportunidades que ya existían al aplicar la migración.
select private.abrir_competencia_asignacion(t.id)
from public.traslados t
where t.estado::text = 'pendiente_de_conductor' and t.conductor_id is null;
