-- RT-25 / RT-27 — Permisos de service_role y telemetría operativa sin datos sensibles.

-- Las tablas del expediente se crearon con privilegios explícitos para los
-- clientes. service_role también necesita privilegios SQL además de BYPASSRLS.
grant all on table public.solicitudes_conductor to service_role;
grant all on table public.documentos_conductor to service_role;
grant all on table public.consentimientos_usuario to service_role;
grant all on table public.historial_estados_solicitud_conductor to service_role;

create table public.eventos_registro_conductor (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  solicitud_id uuid references public.solicitudes_conductor(id) on delete set null,
  evento text not null check (evento in (
    'registro_iniciado',
    'paso_visto',
    'paso_completado',
    'otp_error',
    'rpc_error',
    'documento_fallo',
    'solicitud_enviada'
  )),
  paso smallint check (paso between 1 and 5),
  codigo text check (
    codigo is null or codigo ~ '^[a-z0-9_.:-]{1,64}$'
  ),
  duracion_ms integer check (duracion_ms between 0 and 2678400000),
  creado_en timestamptz not null default now()
);

create index eventos_registro_evento_fecha_idx
  on public.eventos_registro_conductor(evento, creado_en desc);
create index eventos_registro_sesion_fecha_idx
  on public.eventos_registro_conductor(sesion_id, creado_en desc);
create index eventos_registro_solicitud_fecha_idx
  on public.eventos_registro_conductor(solicitud_id, creado_en desc)
  where solicitud_id is not null;

create or replace function public.bloquear_mutacion_evento_registro_conductor()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'La telemetría de registro es inmutable.';
end;
$$;

create trigger bloquear_mutacion_evento_registro_conductor
  before update or delete on public.eventos_registro_conductor
  for each row execute function public.bloquear_mutacion_evento_registro_conductor();

alter table public.eventos_registro_conductor enable row level security;
create policy "admin_lee_eventos_registro_conductor"
  on public.eventos_registro_conductor for select
  using (public.es_admin());

revoke all on table public.eventos_registro_conductor from public, anon, authenticated;
grant select on table public.eventos_registro_conductor to authenticated;
grant all on table public.eventos_registro_conductor to service_role;

create or replace function public.registrar_evento_registro_conductor(
  p_sesion_id uuid,
  p_evento text,
  p_paso smallint default null,
  p_codigo text default null,
  p_duracion_ms integer default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_auth uuid:=auth.uid();
  v_solicitud uuid;
  v_id uuid;
  v_codigo text:=nullif(lower(btrim(p_codigo)), '');
begin
  if p_sesion_id is null then
    raise exception 'La sesión de telemetría es obligatoria.';
  end if;
  if p_evento not in (
    'registro_iniciado','paso_visto','paso_completado','otp_error',
    'rpc_error','documento_fallo','solicitud_enviada'
  ) then
    raise exception 'Evento de registro no permitido.';
  end if;
  if p_paso is not null and p_paso not between 1 and 5 then
    raise exception 'Paso de registro no permitido.';
  end if;
  if v_codigo is not null and v_codigo !~ '^[a-z0-9_.:-]{1,64}$' then
    raise exception 'Código de telemetría no permitido.';
  end if;
  if p_duracion_ms is not null and p_duracion_ms not between 0 and 2678400000 then
    raise exception 'Duración de telemetría no permitida.';
  end if;

  if v_auth is not null then
    select id into v_solicitud
    from public.solicitudes_conductor
    where auth_user_id=v_auth
    order by (estado not in ('aprobado','rechazado')) desc, actualizado_en desc
    limit 1;
  end if;

  insert into public.eventos_registro_conductor(
    sesion_id,auth_user_id,solicitud_id,evento,paso,codigo,duracion_ms
  ) values(
    p_sesion_id,v_auth,v_solicitud,p_evento,p_paso,v_codigo,p_duracion_ms
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.registrar_evento_registro_conductor(uuid,text,smallint,text,integer)
  from public;
grant execute on function public.registrar_evento_registro_conductor(uuid,text,smallint,text,integer)
  to anon, authenticated, service_role;

create or replace function public.obtener_metricas_registro_conductor(
  p_desde date default (current_date - 30),
  p_hasta date default current_date
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_desde timestamptz:=p_desde::timestamptz;
  v_hasta timestamptz:=(p_hasta + 1)::timestamptz;
  v_resultado jsonb;
begin
  if not public.es_admin() then
    raise exception 'Acceso exclusivo de administradores.';
  end if;
  if p_desde is null or p_hasta is null or p_desde>p_hasta
    or p_hasta-p_desde>366 then
    raise exception 'El periodo solicitado no es válido.';
  end if;

  with
  abandonos as (
    select paso_actual as paso,count(*)::integer as total
    from public.solicitudes_conductor
    where creado_en<v_hasta
      and actualizado_en>=v_desde and actualizado_en<v_hasta
      and actualizado_en<least(now(),v_hasta)-interval '24 hours'
      and estado in (
        'borrador','correo_pendiente','datos_incompletos',
        'documentos_pendientes','listo_para_enviar','requiere_correccion'
      )
    group by paso_actual
  ),
  documentos_rechazados as (
    select d.tipo,count(*)::integer as total
    from public.historial_estados_solicitud_conductor h
    join public.documentos_conductor d on d.id=h.documento_id
    where h.decision='rechazar_documento'
      and h.revisado_en>=v_desde and h.revisado_en<v_hasta
    group by d.tipo
  ),
  revisiones as (
    select s.id,
      min(h.revisado_en) filter (where h.estado_nuevo='en_revision') as inicio,
      min(h.revisado_en) filter (where h.estado_nuevo in ('requiere_correccion','aprobado','rechazado')) as fin
    from public.solicitudes_conductor s
    join public.historial_estados_solicitud_conductor h on h.solicitud_id=s.id
    where s.enviado_en>=v_desde and s.enviado_en<v_hasta
    group by s.id
  )
  select jsonb_build_object(
    'periodo',jsonb_build_object('desde',p_desde,'hasta',p_hasta),
    'abandono_por_paso',coalesce((
      select jsonb_agg(jsonb_build_object('paso',paso,'total',total) order by paso)
      from abandonos
    ),'[]'::jsonb),
    'errores_otp',(select count(*) from public.eventos_registro_conductor
      where evento='otp_error' and creado_en>=v_desde and creado_en<v_hasta),
    'errores_rpc',(select count(*) from public.eventos_registro_conductor
      where evento='rpc_error' and creado_en>=v_desde and creado_en<v_hasta),
    'fallos_documentos',(select count(*) from public.eventos_registro_conductor
      where evento='documento_fallo' and creado_en>=v_desde and creado_en<v_hasta),
    'tiempo_promedio_registro_segundos',(select round(avg(extract(epoch from (enviado_en-creado_en))))
      from public.solicitudes_conductor
      where enviado_en>=v_desde and enviado_en<v_hasta),
    'tiempo_promedio_revision_segundos',(select round(avg(extract(epoch from (fin-inicio))))
      from revisiones where inicio is not null and fin is not null and fin>=inicio),
    'documentos_rechazados_por_tipo',coalesce((
      select jsonb_agg(jsonb_build_object('tipo',tipo,'total',total) order by total desc,tipo)
      from documentos_rechazados
    ),'[]'::jsonb),
    'solicitudes_enviadas',(select count(*) from public.solicitudes_conductor
      where enviado_en>=v_desde and enviado_en<v_hasta)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.obtener_metricas_registro_conductor(date,date)
  from public, anon;
grant execute on function public.obtener_metricas_registro_conductor(date,date)
  to authenticated, service_role;

comment on table public.eventos_registro_conductor is
  'Telemetría mínima e inmutable del registro; no admite PII ni mensajes libres.';
comment on function public.registrar_evento_registro_conductor(uuid,text,smallint,text,integer) is
  'Registra eventos operativos de onboarding sin confiar identificadores de usuario o solicitud enviados por el cliente.';
comment on function public.obtener_metricas_registro_conductor(date,date) is
  'Resumen administrativo de abandono, errores, documentos y tiempos del registro de conductores.';
