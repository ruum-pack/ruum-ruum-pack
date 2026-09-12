-- FASE 14 — Observabilidad y auditoría: poder diagnosticar problemas
-- técnicos y operacionales.
-- Se centraliza sobre lo existente sin romperlo: eventos_observabilidad
-- (server) + eventos_operativos_app (cliente) + registro_auditoria
-- (auditoría operacional) conviven; aquí se les suma correlation ID,
-- asociación a transfer/operation/user, medición de latencias/errores/
-- tracking/cola-offline, dashboards, eventos de auditoría y retención.

-- 14.2 — correlation ID: un UUID por operación que viaja en
-- ruum.correlation_id, se acepta por parámetro o se genera.
create or replace function public.obs_nuevo_correlation_id()
returns text
language sql
stable
set search_path = public, pg_temp
as $$ select gen_random_uuid()::text $$;

create or replace function public.obs_resolver_correlation(p_correlation_id text default null)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_setting text := nullif(current_setting('ruum.correlation_id', true), '');
begin
  return coalesce(nullif(btrim(coalesce(p_correlation_id, '')), ''), v_setting, gen_random_uuid()::text);
end;
$$;

-- Rechazo de telemetría con datos sensibles (mismo criterio que
-- registrar_evento_operativo_app: CURP/CLABE/tarjeta/tokens/URLs/fotos).
create or replace function public.obs_rechazar_si_sensible(p_datos jsonb)
returns void
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(p_datos::text, '')) ~ '(curp|clabe|numero.?de.?cuenta|tarjeta|access.?token|refresh.?token|signed.?url|fotografia|imagen)' then
    raise exception 'SENSITIVE_TELEMETRY_REJECTED' using errcode='22023';
  end if;
end;
$$;

-- 14.1/14.3/14.4/14.5 — el log centralizado asocia transfer, operation y user.
alter table public.eventos_observabilidad
  add column if not exists correlation_id text,
  add column if not exists traslado_id uuid references public.traslados(id) on delete set null,
  add column if not exists operacion_id uuid references public.operaciones(id) on delete set null,
  add column if not exists usuario_id uuid references public.usuarios(id) on delete set null;

create index if not exists eventos_observabilidad_correlation_idx
  on public.eventos_observabilidad (correlation_id) where correlation_id is not null;
create index if not exists eventos_observabilidad_traslado_idx
  on public.eventos_observabilidad (traslado_id) where traslado_id is not null;
create index if not exists eventos_observabilidad_operacion_idx
  on public.eventos_observabilidad (operacion_id) where operacion_id is not null;

-- el evento de app también viaja con correlation y transfer.
alter table public.eventos_operativos_app
  add column if not exists correlation_id text,
  add column if not exists traslado_id uuid references public.traslados(id) on delete set null;

create index if not exists eventos_operativos_app_correlation_idx
  on public.eventos_operativos_app (correlation_id) where correlation_id is not null;
create index if not exists eventos_operativos_app_traslado_idx
  on public.eventos_operativos_app (traslado_id) where traslado_id is not null;

-- registrar_evento_operativo_app acepta correlation/transfer sin romper
-- a los clientes actuales (parámetros nuevos opcionales al final).
create or replace function public.registrar_evento_operativo_app(
  p_tipo text, p_version_app text, p_detalle jsonb default '{}'::jsonb,
  p_correlation_id text default null, p_traslado_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  perform public.obs_rechazar_si_sensible(coalesce(p_detalle, '{}'::jsonb));
  insert into public.eventos_operativos_app(usuario_id, version_app, tipo, detalle, correlation_id, traslado_id)
  values (auth.uid(), left(coalesce(p_version_app, 'desconocida'), 40), p_tipo,
    coalesce(p_detalle, '{}'::jsonb),
    public.obs_resolver_correlation(p_correlation_id), p_traslado_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- 14.1 — escritura centralizada de logs server-side (edge functions,
-- cron, backend): service_role o Torre; nunca datos sensibles.
create or replace function public.obs_registrar_log(
  p_nivel text,
  p_servicio text,
  p_nombre text,
  p_correlation_id text default null,
  p_traslado_id uuid default null,
  p_operacion_id uuid default null,
  p_usuario_id uuid default null,
  p_duracion_ms integer default null,
  p_datos jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_corr text := public.obs_resolver_correlation(p_correlation_id);
begin
  if auth.uid() is not null and not public.es_admin() then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if p_nivel not in ('info', 'warn', 'error') then
    raise exception using errcode='22023', message='NIVEL_INVALIDO';
  end if;
  if nullif(btrim(coalesce(p_servicio, '')), '') is null
     or nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception using errcode='22023', message='SERVICIO_O_NOMBRE_REQUERIDO';
  end if;
  if p_duracion_ms is not null and (p_duracion_ms < 0 or p_duracion_ms > 3600000) then
    raise exception using errcode='22023', message='DURACION_INVALIDA';
  end if;
  perform public.obs_rechazar_si_sensible(coalesce(p_datos, '{}'::jsonb));

  insert into public.eventos_observabilidad (
    servicio, nivel, nombre, trace_id, duracion_ms, datos,
    correlation_id, traslado_id, operacion_id, usuario_id
  ) values (
    left(p_servicio, 80), p_nivel, left(p_nombre, 120), v_corr,
    p_duracion_ms, coalesce(p_datos, '{}'::jsonb),
    v_corr, p_traslado_id, p_operacion_id, p_usuario_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- 14.6 — latencia de RPC: la app mide y reporta; el servidor agrega p95.
create table public.obs_rpc_latency (
  id bigserial primary key,
  creado_en timestamptz not null default now(),
  funcion text not null,
  correlation_id text,
  traslado_id uuid references public.traslados(id) on delete set null,
  duracion_ms integer not null check (duracion_ms >= 0),
  ok boolean not null default true,
  codigo_error text
);

create index obs_rpc_latency_funcion_fecha_idx
  on public.obs_rpc_latency (funcion, creado_en desc);
create index obs_rpc_latency_correlation_idx
  on public.obs_rpc_latency (correlation_id) where correlation_id is not null;

create or replace function public.obs_registrar_latencia_rpc(
  p_funcion text,
  p_duracion_ms integer,
  p_ok boolean default true,
  p_codigo_error text default null,
  p_correlation_id text default null,
  p_traslado_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_funcion, '')), '') is null then
    raise exception using errcode='22023', message='FUNCION_REQUERIDA';
  end if;
  if p_duracion_ms is null or p_duracion_ms < 0 or p_duracion_ms > 3600000 then
    raise exception using errcode='22023', message='DURACION_INVALIDA';
  end if;
  insert into public.obs_rpc_latency (funcion, duracion_ms, ok, codigo_error, correlation_id, traslado_id)
  values (left(p_funcion, 120), p_duracion_ms, coalesce(p_ok, true),
    left(nullif(btrim(coalesce(p_codigo_error, '')), ''), 40),
    public.obs_resolver_correlation(p_correlation_id), p_traslado_id)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace view public.obs_rpc_latencia_resumen
with (security_invoker = true) as
select
  funcion,
  count(*)::int as llamadas_24h,
  count(*) filter (where not ok)::int as errores_24h,
  round(avg(duracion_ms))::int as promedio_ms,
  percentile_cont(0.95) within group (order by duracion_ms)::int as p95_ms,
  max(duracion_ms)::int as max_ms
from public.obs_rpc_latency
where creado_en > now() - interval '24 hours'
group by funcion;

-- 14.7 — errores de Edge Functions: la función edge reporta con su
-- service_role; el mensaje se trunca y se rechaza PII.
create table public.obs_edge_errors (
  id bigserial primary key,
  creado_en timestamptz not null default now(),
  funcion text not null,
  correlation_id text,
  traslado_id uuid references public.traslados(id) on delete set null,
  codigo text not null,
  mensaje text not null,
  datos jsonb not null default '{}'::jsonb
);

create index obs_edge_errors_funcion_fecha_idx
  on public.obs_edge_errors (funcion, creado_en desc);
create index obs_edge_errors_correlation_idx
  on public.obs_edge_errors (correlation_id) where correlation_id is not null;

create or replace function public.obs_registrar_error_edge(
  p_funcion text,
  p_codigo text,
  p_mensaje text,
  p_correlation_id text default null,
  p_traslado_id uuid default null,
  p_datos jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if auth.uid() is not null and not public.es_admin() then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if nullif(btrim(coalesce(p_funcion, '')), '') is null
     or nullif(btrim(coalesce(p_codigo, '')), '') is null then
    raise exception using errcode='22023', message='FUNCION_O_CODIGO_REQUERIDO';
  end if;
  perform public.obs_rechazar_si_sensible(coalesce(p_datos, '{}'::jsonb));
  insert into public.obs_edge_errors (funcion, codigo, mensaje, correlation_id, traslado_id, datos)
  values (left(p_funcion, 120), left(p_codigo, 40), left(coalesce(p_mensaje, ''), 500),
    public.obs_resolver_correlation(p_correlation_id), p_traslado_id,
    coalesce(p_datos, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- 14.8 — fallos de tracking: traslados activos con señal vieja, sesión
-- perdida o desviación (mismo umbral que Fase 10: STALE >5 min,
-- OFFLINE >15 min), más eventos de app de las últimas 24h.
create or replace view public.obs_tracking_fallos
with (security_invoker = true) as
select
  t.id as traslado_id,
  t.estado as estado_traslado,
  t.estado_operativo,
  t.conductor_id,
  t.operation_id as operacion_id,
  u.empresa_id as empresa_id,
  s.ultimo_envio_en,
  round(extract(epoch from (now() - s.ultimo_envio_en)) / 60)::int as minutos_sin_senal,
  case
    when s.ultimo_envio_en is null then 'OFFLINE'
    when s.ultimo_envio_en < now() - interval '15 minutes' then 'OFFLINE'
    when s.ultimo_envio_en < now() - interval '5 minutes' then 'STALE'
    else 'OK'
  end as salud,
  (ses.id is null) as sin_sesion_activa,
  coalesce(ses.desviacion_sospechosa, false) as desviacion_sospechosa
from public.traslados t
join public.usuarios u on u.id = t.usuario_id
left join public.tracking_salud_traslado s on s.traslado_id = t.id
left join public.tracking_sesiones ses
  on ses.traslado_id = t.id and ses.estado = 'activa'
where t.conductor_id is not null
  and t.estado not in ('servicio_cerrado', 'servicio_cancelado', 'traslado_fallido')
  and (
    s.ultimo_envio_en is null
    or s.ultimo_envio_en < now() - interval '5 minutes'
    or ses.id is null
    or ses.desviacion_sospechosa
  );

create or replace function public.admin_obs_tracking_fallos(p_limite int default 100)
returns setof public.obs_tracking_fallos
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.admin_tiene_permiso('viajes:leer') or public.admin_tiene_permiso('auditoria:leer')) then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 500 then
    raise exception using errcode='22023', message='LIMITE_INVALIDO';
  end if;
  return query
  select *
  from public.obs_tracking_fallos
  order by
    case salud when 'OFFLINE' then 0 when 'STALE' then 1 else 2 end,
    minutos_sin_senal desc nulls first
  limit p_limite;
end;
$$;

-- 14.9 — cola offline: lo que el servidor sí puede ver. Retraso
-- dispositivo→servidor por punto (lotes que llegaron tarde) más eventos
-- de app sync_failure/tracking_stopped/evidence_stuck de 24h.
create or replace function public.admin_obs_cola_offline()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_puntos jsonb;
  v_eventos jsonb;
  v_tardios jsonb;
begin
  if not (public.admin_tiene_permiso('viajes:leer') or public.admin_tiene_permiso('auditoria:leer')) then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select jsonb_build_object(
    'puntos_24h', count(*),
    'retraso_promedio_min', round(avg(extract(epoch from (servidor_timestamp - dispositivo_timestamp)) / 60)::numeric, 1),
    'retraso_max_min', round((max(extract(epoch from (servidor_timestamp - dispositivo_timestamp))) / 60)::numeric, 1),
    'tardios_mas_6h', count(*) filter (
      where servidor_timestamp - dispositivo_timestamp > interval '6 hours')
  ) into v_puntos
  from public.ubicaciones_traslado
  where servidor_timestamp is not null and dispositivo_timestamp is not null
    and registrado_en > now() - interval '24 hours';

  select coalesce(jsonb_agg(row_to_json(e)), '[]'::jsonb) into v_eventos
  from (
    select tipo, count(*)::int as total
    from public.eventos_operativos_app
    where creado_en > now() - interval '24 hours'
      and tipo in ('sync_failure', 'tracking_stopped', 'evidence_stuck')
    group by tipo
    order by tipo
  ) e;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_tardios
  from (
    select traslado_id,
      count(*)::int as puntos_tardios,
      round((max(extract(epoch from (servidor_timestamp - dispositivo_timestamp))) / 3600)::numeric, 1) as max_retraso_horas
    from public.ubicaciones_traslado
    where servidor_timestamp is not null and dispositivo_timestamp is not null
      and registrado_en > now() - interval '24 hours'
      and servidor_timestamp - dispositivo_timestamp > interval '6 hours'
    group by traslado_id
    order by puntos_tardios desc
    limit 20
  ) t;

  return jsonb_build_object(
    'telemetria_lote', coalesce(v_puntos, jsonb_build_object('puntos_24h', 0)),
    'eventos_app_24h', coalesce(v_eventos, '[]'::jsonb),
    'traslados_tardios', coalesce(v_tardios, '[]'::jsonb),
    'generado_en', now()
  );
end;
$$;

-- 14.10 — dashboards: rollup diario + panel único para Torre.
create or replace view public.obs_dashboard_diario
with (security_invoker = true) as
select
  dia,
  sum(logs_info)::int as logs_info,
  sum(logs_warn)::int as logs_warn,
  sum(logs_error)::int as logs_error,
  sum(latencias)::int as latencias,
  sum(edge_errores)::int as edge_errores,
  sum(eventos_app)::int as eventos_app
from (
  select creado_en::date as dia,
    count(*) filter (where nivel = 'info') as logs_info,
    count(*) filter (where nivel = 'warn') as logs_warn,
    count(*) filter (where nivel = 'error') as logs_error,
    0 as latencias, 0 as edge_errores, 0 as eventos_app
  from public.eventos_observabilidad group by 1
  union all
  select creado_en::date, 0, 0, 0, count(*), 0, 0
  from public.obs_rpc_latency group by 1
  union all
  select creado_en::date, 0, 0, 0, 0, count(*), 0
  from public.obs_edge_errors group by 1
  union all
  select creado_en::date, 0, 0, 0, 0, 0, count(*)
  from public.eventos_operativos_app group by 1
) u
group by dia;

create or replace function public.admin_obs_dashboard(p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_logs jsonb;
  v_rpc jsonb;
  v_edge jsonb;
  v_app jsonb;
  v_tracking int;
begin
  if not (public.admin_tiene_permiso('auditoria:leer') or public.admin_tiene_permiso('viajes:leer')) then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception using errcode='22023', message='RANGO_INVALIDO';
  end if;

  select jsonb_build_object(
    'info', count(*) filter (where nivel = 'info'),
    'warn', count(*) filter (where nivel = 'warn'),
    'error', count(*) filter (where nivel = 'error')
  ) into v_logs
  from public.eventos_observabilidad
  where creado_en >= p_desde and creado_en <= p_hasta;

  select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) into v_rpc
  from (
    select funcion, count(*)::int as llamadas,
      count(*) filter (where not ok)::int as errores,
      percentile_cont(0.95) within group (order by duracion_ms)::int as p95_ms
    from public.obs_rpc_latency
    where creado_en >= p_desde and creado_en <= p_hasta
    group by funcion
    order by p95_ms desc nulls last
    limit 20
  ) r;

  select coalesce(jsonb_agg(row_to_json(e)), '[]'::jsonb) into v_edge
  from (
    select funcion, codigo, count(*)::int as total
    from public.obs_edge_errors
    where creado_en >= p_desde and creado_en <= p_hasta
    group by funcion, codigo
    order by total desc
    limit 20
  ) e;

  select coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb) into v_app
  from (
    select tipo, count(*)::int as total
    from public.eventos_operativos_app
    where creado_en >= p_desde and creado_en <= p_hasta
    group by tipo
    order by total desc
  ) a;

  select count(*)::int into v_tracking from public.obs_tracking_fallos;

  return jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'logs_por_nivel', coalesce(v_logs, jsonb_build_object('info', 0, 'warn', 0, 'error', 0)),
    'rpc_lentas', coalesce(v_rpc, '[]'::jsonb),
    'edge_errores', coalesce(v_edge, '[]'::jsonb),
    'eventos_app', coalesce(v_app, '[]'::jsonb),
    'tracking_fallos_actuales', coalesce(v_tracking, 0),
    'generado_en', now()
  );
end;
$$;

-- 14.11 — eventos de auditoría: la bitácora gana alcance a operación y
-- usuario más correlation, y vocabulario para acceso técnico y purgas.
alter table public.registro_auditoria
  add column if not exists operacion_id uuid references public.operaciones(id) on delete set null,
  add column if not exists usuario_id uuid references public.usuarios(id) on delete set null,
  add column if not exists correlation_id text;

create index if not exists registro_auditoria_operacion_idx
  on public.registro_auditoria (operacion_id) where operacion_id is not null;
create index if not exists registro_auditoria_correlation_idx
  on public.registro_auditoria (correlation_id) where correlation_id is not null;

alter type public.evento_auditable add value if not exists 'consulta_dato_sensible';
alter type public.evento_auditable add value if not exists 'acceso_torre';
alter type public.evento_auditable add value if not exists 'purga_observabilidad';

-- Escritura de auditoría con alcance completo: el actor escribe lo propio,
-- Torre lo de cualquiera, y el cron/service lo técnico.
create or replace function public.obs_registrar_auditoria(
  p_evento public.evento_auditable,
  p_actor public.actor_auditoria,
  p_actor_id uuid,
  p_traslado_id uuid default null,
  p_operacion_id uuid default null,
  p_usuario_id uuid default null,
  p_correlation_id text default null,
  p_datos jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_es_cron boolean := (auth.uid() is null);
begin
  if not v_es_cron
     and p_actor_id not in (select id from public.usuarios where auth_user_id = auth.uid())
     and p_actor_id not in (select id from public.conductores where auth_user_id = auth.uid())
     and not public.es_admin() then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  perform public.obs_rechazar_si_sensible(coalesce(p_datos, '{}'::jsonb));

  insert into public.registro_auditoria (
    traslado_id, operacion_id, usuario_id, evento, actor, actor_id,
    correlation_id, datos
  ) values (
    p_traslado_id, p_operacion_id, p_usuario_id, p_evento, p_actor, p_actor_id,
    public.obs_resolver_correlation(p_correlation_id), coalesce(p_datos, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- 14.12 — política de retención por tabla y purga auditada.
-- La auditoría operacional se conserva 2 años; la telemetría, meses.
create table public.obs_retencion_politicas (
  tabla text primary key,
  dias int not null check (dias > 0),
  descripcion text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger obs_retencion_politicas_actualizado_en
  before update on public.obs_retencion_politicas
  for each row execute function public.set_actualizado_en();

insert into public.obs_retencion_politicas (tabla, dias, descripcion) values
  ('obs_rpc_latency', 90, 'Latencias de RPC: 90 días.'),
  ('obs_edge_errors', 180, 'Errores de Edge Functions: 180 días.'),
  ('eventos_operativos_app', 180, 'Telemetría de apps: 180 días.'),
  ('eventos_observabilidad', 180, 'Logs centralizados: 180 días.'),
  ('registro_auditoria', 730, 'Auditoría operacional: 2 años, solo dirección purga.')
on conflict (tabla) do update set
  dias = excluded.dias,
  descripcion = excluded.descripcion,
  actualizado_en = now();

-- Purga por política: solo dirección, por lotes, con evento de auditoría.
-- La columna de corte difiere por tabla y se resuelve en allowlist cerrada.
create or replace function public.admin_obs_purgar(p_tabla text, p_limite int default 5000)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dias int;
  v_eliminados int := 0;
  v_admin uuid;
  v_es_direccion boolean := false;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='PURGA_SOLO_DIRECCION';
  end if;
  select id, coalesce(rol_operativo = 'direccion', false) into v_admin, v_es_direccion
  from public.admins where auth_user_id = auth.uid();
  if v_admin is null or not v_es_direccion then
    raise exception using errcode='42501', message='PURGA_SOLO_DIRECCION';
  end if;

  select dias into v_dias from public.obs_retencion_politicas where tabla = p_tabla;
  if v_dias is null then
    raise exception using errcode='22023', message='TABLA_SIN_POLITICA';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 50000 then
    raise exception using errcode='22023', message='LIMITE_INVALIDO';
  end if;

  case p_tabla
    when 'obs_rpc_latency' then
      with borrados as (
        delete from public.obs_rpc_latency
        where id in (
          select id from public.obs_rpc_latency
          where creado_en < now() - make_interval(days => v_dias)
          order by creado_en limit p_limite
        )
        returning id
      ) select count(*)::int into v_eliminados from borrados;
    when 'obs_edge_errors' then
      with borrados as (
        delete from public.obs_edge_errors
        where id in (
          select id from public.obs_edge_errors
          where creado_en < now() - make_interval(days => v_dias)
          order by creado_en limit p_limite
        )
        returning id
      ) select count(*)::int into v_eliminados from borrados;
    when 'eventos_operativos_app' then
      with borrados as (
        delete from public.eventos_operativos_app
        where id in (
          select id from public.eventos_operativos_app
          where creado_en < now() - make_interval(days => v_dias)
          order by creado_en limit p_limite
        )
        returning id
      ) select count(*)::int into v_eliminados from borrados;
    when 'eventos_observabilidad' then
      with borrados as (
        delete from public.eventos_observabilidad
        where id in (
          select id from public.eventos_observabilidad
          where creado_en < now() - make_interval(days => v_dias)
          order by creado_en limit p_limite
        )
        returning id
      ) select count(*)::int into v_eliminados from borrados;
    when 'registro_auditoria' then
      with borrados as (
        delete from public.registro_auditoria
        where id in (
          select id from public.registro_auditoria
          where timestamp < now() - make_interval(days => v_dias)
          order by timestamp limit p_limite
        )
        returning id
      ) select count(*)::int into v_eliminados from borrados;
    else
      raise exception using errcode='22023', message='TABLA_SIN_POLITICA';
  end case;

  insert into public.registro_auditoria (evento, actor, actor_id, datos, correlation_id)
  values ('purga_observabilidad', 'admin', v_admin,
    jsonb_build_object('tabla', p_tabla, 'eliminados', v_eliminados, 'dias', v_dias),
    public.obs_resolver_correlation(null));

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin, 'mutacion', 'observabilidad', 'purgar',
    jsonb_build_object('tabla', p_tabla, 'eliminados', v_eliminados));

  return jsonb_build_object('tabla', p_tabla, 'eliminados', v_eliminados, 'dias', v_dias);
end;
$$;

-- Métricas de negocio: un solo panel para dirección y Torre.
-- Ventanas: creados/aceptados/cerrados en [p_desde, p_hasta]; tracking es
-- snapshot actual; margen replica la fórmula de Fase 12 en el alcance dado.
create or replace function public.admin_obs_metricas_negocio(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_empresa_id uuid default null,
  p_operacion_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tt_assign numeric;
  v_pickup_rate numeric;
  v_delivery_rate numeric;
  v_avg_dur numeric;
  v_tracking numeric;
  v_incident numeric;
  v_claim numeric;
  v_accept numeric;
  v_evidence numeric;
  v_fact numeric := 0; v_cost numeric := 0; v_gast numeric := 0; v_com numeric := 0;
begin
  if not (public.admin_tiene_permiso('auditoria:leer') or public.admin_tiene_permiso('viajes:leer')) then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception using errcode='22023', message='RANGO_INVALIDO';
  end if;

  -- time_to_assign: creado → aceptación (horas, promedio)
  select round(avg(extract(epoch from (a.aceptada_en - t.creado_en)) / 3600)::numeric, 2)
    into v_tt_assign
  from public.asignaciones a
  join public.traslados t on t.id = a.traslado_id
  join public.usuarios u on u.id = t.usuario_id
  where a.aceptada_en >= p_desde and a.aceptada_en <= p_hasta
    and a.estado in ('aceptada', 'activa', 'completada')
    and (p_empresa_id is null or u.empresa_id = p_empresa_id)
    and (p_operacion_id is null or t.operation_id = p_operacion_id);

  -- pickup/delivery on-time: evaluados SLA sin breach en el rango
  -- (null si el motor SLA aún no evaluó nada en la ventana).
  select case when count(*) = 0 then null
      else round((1 - count(*) filter (where e.estado = 'breach')::numeric / count(*))::numeric, 4)
    end
    into v_pickup_rate
  from public.sla_evaluaciones e
  join public.traslados t on t.id = e.traslado_id
  join public.usuarios u on u.id = t.usuario_id
  where e.policy_codigo = 'recoleccion' and e.incidencia_id is null
    and e.ultima_evaluacion_en >= p_desde and e.ultima_evaluacion_en <= p_hasta
    and (p_empresa_id is null or coalesce(e.empresa_id, u.empresa_id) = p_empresa_id)
    and (p_operacion_id is null or e.operacion_id = p_operacion_id);

  select case when count(*) = 0 then null
      else round((1 - count(*) filter (where e.estado = 'breach')::numeric / count(*))::numeric, 4)
    end
    into v_delivery_rate
  from public.sla_evaluaciones e
  join public.traslados t on t.id = e.traslado_id
  join public.usuarios u on u.id = t.usuario_id
  where e.policy_codigo = 'entrega' and e.incidencia_id is null
    and e.ultima_evaluacion_en >= p_desde and e.ultima_evaluacion_en <= p_hasta
    and (p_empresa_id is null or coalesce(e.empresa_id, u.empresa_id) = p_empresa_id)
    and (p_operacion_id is null or e.operacion_id = p_operacion_id);

  -- average_transfer_duration: creado → cierre (horas, promedio)
  select round(avg(extract(epoch from (t.actualizado_en - t.creado_en)) / 3600)::numeric, 2)
    into v_avg_dur
  from public.traslados t
  join public.usuarios u on u.id = t.usuario_id
  where t.estado = 'servicio_cerrado'
    and t.actualizado_en >= p_desde and t.actualizado_en <= p_hasta
    and (p_empresa_id is null or u.empresa_id = p_empresa_id)
    and (p_operacion_id is null or t.operation_id = p_operacion_id);

  -- tracking_uptime: snapshot actual, señal fresca sobre flota con salud
  select round((count(*) filter (where s.ultimo_envio_en > now() - interval '15 minutes')::numeric
      / nullif(count(*), 0))::numeric, 4)
    into v_tracking
  from public.traslados t
  join public.tracking_salud_traslado s on s.traslado_id = t.id
  join public.usuarios u on u.id = t.usuario_id
  where t.conductor_id is not null
    and t.estado not in ('servicio_cerrado', 'servicio_cancelado', 'traslado_fallido')
    and (p_empresa_id is null or u.empresa_id = p_empresa_id)
    and (p_operacion_id is null or t.operation_id = p_operacion_id);

  -- incident_rate: creados con incidencia sobre creados
  select round((count(distinct i.traslado_id)::numeric
      / nullif(count(distinct t.id), 0))::numeric, 4)
    into v_incident
  from public.traslados t
  join public.usuarios u on u.id = t.usuario_id
  left join public.incidencias i on i.traslado_id = t.id
  where t.creado_en >= p_desde and t.creado_en <= p_hasta
    and (p_empresa_id is null or u.empresa_id = p_empresa_id)
    and (p_operacion_id is null or t.operation_id = p_operacion_id);

  -- claim_rate: con reclamo o disputa sobre cerrados en el rango
  select round((count(distinct c.traslado_id)::numeric
      / nullif((select count(*)
        from public.traslados t2
        join public.usuarios u2 on u2.id = t2.usuario_id
        where t2.estado = 'servicio_cerrado'
          and t2.actualizado_en >= p_desde and t2.actualizado_en <= p_hasta
          and (p_empresa_id is null or u2.empresa_id = p_empresa_id)
          and (p_operacion_id is null or t2.operation_id = p_operacion_id)), 0))::numeric, 4)
    into v_claim
  from (
    select r.traslado_id from public.reclamos_seguro r
    join public.traslados t on t.id = r.traslado_id
    join public.usuarios u on u.id = t.usuario_id
    where r.abierto_en >= p_desde and r.abierto_en <= p_hasta
      and (p_empresa_id is null or u.empresa_id = p_empresa_id)
      and (p_operacion_id is null or t.operation_id = p_operacion_id)
    union
    select d.traslado_id from public.disputas d
    join public.traslados t on t.id = d.traslado_id
    join public.usuarios u on u.id = t.usuario_id
    where d.abierta_en >= p_desde and d.abierta_en <= p_hasta
      and (p_empresa_id is null or u.empresa_id = p_empresa_id)
      and (p_operacion_id is null or t.operation_id = p_operacion_id)
  ) c;

  -- driver_acceptance_rate: aceptadas sobre decididas en el rango
  select round((count(*) filter (where a.estado in ('aceptada', 'activa', 'completada'))::numeric
      / nullif(count(*) filter (where a.estado in ('aceptada', 'activa', 'completada', 'rechazada')), 0))::numeric, 4)
    into v_accept
  from public.asignaciones a
  join public.traslados t on t.id = a.traslado_id
  join public.usuarios u on u.id = t.usuario_id
  where coalesce(a.aceptada_en, a.rechazada_en) >= p_desde
    and coalesce(a.aceptada_en, a.rechazada_en) <= p_hasta
    and (p_empresa_id is null or u.empresa_id = p_empresa_id)
    and (p_operacion_id is null or t.operation_id = p_operacion_id);

  -- evidence_completion_rate: entregados con foto final sobre entregados
  select round((count(distinct f.traslado_id)::numeric
      / nullif(count(distinct h.traslado_id), 0))::numeric, 4)
    into v_evidence
  from public.historial_estados_traslado h
  join public.traslados t on t.id = h.traslado_id
  join public.usuarios u on u.id = t.usuario_id
  left join public.evidencia_fotos f
    on f.traslado_id = h.traslado_id and f.tipo = 'final'
  where h.estado_nuevo = 'entrega_confirmada'
    and h.creado_en >= p_desde and h.creado_en <= p_hasta
    and (p_empresa_id is null or u.empresa_id = p_empresa_id)
    and (p_operacion_id is null or t.operation_id = p_operacion_id);

  -- operation_margin: misma fórmula que Fase 12 sobre el alcance
  select coalesce(sum(p.monto) filter (where p.estado = 'completado'), 0)
    into v_fact
  from public.pagos p
  join public.traslados t on t.id = p.traslado_id
  join public.usuarios u on u.id = t.usuario_id
  where p.registrado_en >= p_desde and p.registrado_en <= p_hasta
    and (p_empresa_id is null or u.empresa_id = p_empresa_id)
    and (p_operacion_id is null or t.operation_id = p_operacion_id);

  select coalesce(sum(t.ganancia_conductor_congelada), 0)
    into v_cost
  from public.traslados t
  join public.usuarios u on u.id = t.usuario_id
  where t.creado_en >= p_desde and t.creado_en <= p_hasta
    and (p_empresa_id is null or u.empresa_id = p_empresa_id)
    and (p_operacion_id is null or t.operation_id = p_operacion_id);

  select coalesce(sum(g.monto), 0)
    into v_gast
  from public.gastos_traslado g
  join public.traslados t on t.id = g.traslado_id
  join public.usuarios u on u.id = t.usuario_id
  where g.registrado_en >= p_desde and g.registrado_en <= p_hasta
    and (p_empresa_id is null or u.empresa_id = p_empresa_id)
    and (p_operacion_id is null or t.operation_id = p_operacion_id);

  select coalesce(sum(p.comision_mxn), 0)
    into v_com
  from public.pagos p
  join public.traslados t on t.id = p.traslado_id
  join public.usuarios u on u.id = t.usuario_id
  where p.registrado_en >= p_desde and p.registrado_en <= p_hasta
    and (p_empresa_id is null or u.empresa_id = p_empresa_id)
    and (p_operacion_id is null or t.operation_id = p_operacion_id);

  return jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'empresa_id', p_empresa_id,
    'operacion_id', p_operacion_id,
    'time_to_assign_horas', v_tt_assign,
    'pickup_on_time_rate', v_pickup_rate,
    'delivery_on_time_rate', v_delivery_rate,
    'average_transfer_duration_horas', v_avg_dur,
    'tracking_uptime', v_tracking,
    'incident_rate', v_incident,
    'claim_rate', v_claim,
    'driver_acceptance_rate', v_accept,
    'evidence_completion_rate', v_evidence,
    'operation_margin', jsonb_build_object(
      'facturado', v_fact, 'costo_conductor', v_cost,
      'gastos_directos', v_gast, 'comisiones', v_com,
      'margen_contribucion', v_fact - v_cost - v_gast - v_com
    ),
    'generado_en', now()
  );
end;
$$;

-- RLS: Torre con auditoria:leer; escritura solo vía RPC/service_role.
alter table public.obs_rpc_latency enable row level security;
alter table public.obs_edge_errors enable row level security;
alter table public.obs_retencion_politicas enable row level security;

drop policy if exists obs_rpc_latency_lectura_auditoria on public.obs_rpc_latency;
create policy obs_rpc_latency_lectura_auditoria
  on public.obs_rpc_latency for select to authenticated
  using (public.admin_tiene_permiso('auditoria:leer'));

drop policy if exists obs_edge_errors_lectura_auditoria on public.obs_edge_errors;
create policy obs_edge_errors_lectura_auditoria
  on public.obs_edge_errors for select to authenticated
  using (public.admin_tiene_permiso('auditoria:leer'));

create policy "autenticado_lee_retencion"
  on public.obs_retencion_politicas for select to authenticated using (true);
create policy "admin_gestiona_retencion"
  on public.obs_retencion_politicas for all using (public.es_admin());

grant select on public.obs_rpc_latency to authenticated;
grant select on public.obs_edge_errors to authenticated;
grant select on public.obs_retencion_politicas to authenticated;
grant select on public.obs_rpc_latencia_resumen to authenticated;
grant select on public.obs_tracking_fallos to authenticated;
grant select on public.obs_dashboard_diario to authenticated;
grant all on public.obs_rpc_latency to service_role;
grant all on public.obs_edge_errors to service_role;
grant all on public.obs_retencion_politicas to service_role;
grant execute on function public.obs_nuevo_correlation_id() to authenticated;
grant execute on function public.obs_nuevo_correlation_id() to service_role;
grant execute on function public.obs_resolver_correlation(text) to authenticated;
grant execute on function public.obs_resolver_correlation(text) to service_role;
grant execute on function public.obs_registrar_log(text, text, text, text, uuid, uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.obs_registrar_log(text, text, text, text, uuid, uuid, uuid, integer, jsonb) to service_role;
grant execute on function public.obs_registrar_latencia_rpc(text, integer, boolean, text, text, uuid) to authenticated;
grant execute on function public.obs_registrar_error_edge(text, text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.obs_registrar_error_edge(text, text, text, text, uuid, jsonb) to service_role;
grant execute on function public.obs_registrar_auditoria(public.evento_auditable, public.actor_auditoria, uuid, uuid, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.obs_registrar_auditoria(public.evento_auditable, public.actor_auditoria, uuid, uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.admin_obs_tracking_fallos(int) to authenticated;
grant execute on function public.admin_obs_cola_offline() to authenticated;
grant execute on function public.admin_obs_dashboard(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_obs_purgar(text, int) to authenticated;
grant execute on function public.admin_obs_metricas_negocio(timestamptz, timestamptz, uuid, uuid) to authenticated;

-- Autoverificación: retención completa y correlation operativo.
do $$
declare
  v_politicas int;
begin
  select count(*) into v_politicas from public.obs_retencion_politicas;
  if v_politicas <> 5 then
    raise exception 'Políticas de retención incompletas: % (esperado 5)', v_politicas;
  end if;
  if public.obs_resolver_correlation(null) is null then
    raise exception 'Correlation ID no resuelve';
  end if;
  if public.obs_resolver_correlation('abc-123') <> 'abc-123' then
    raise exception 'Correlation ID no propaga el dado';
  end if;
end $$;
