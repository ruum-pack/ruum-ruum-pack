-- Alertas y SLA operacionales.
-- Fuente server-side para reglas oficiales, vencimientos, deduplicacion,
-- asignacion, acuse, escalamiento, resolucion, cierre e historial.

create table if not exists public.sla_reglas_operativas (
  id uuid primary key default gen_random_uuid(),
  tipo_alerta text not null,
  tipo_servicio text not null default 'general',
  cliente_segmento text not null default 'general',
  horas_limite numeric(8,2) not null check (horas_limite > 0),
  umbral_alerta_pct int not null default 80 check (umbral_alerta_pct between 1 and 100),
  zona_horaria text not null default 'America/Mexico_City',
  pausa_fuera_horario boolean not null default true,
  prioridad int not null default 50 check (prioridad between 1 and 100),
  severidad_base text not null check (severidad_base in ('critica','alta','media')),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (tipo_alerta, tipo_servicio, cliente_segmento)
);

create trigger sla_reglas_operativas_actualizado_en
  before update on public.sla_reglas_operativas
  for each row execute function public.set_actualizado_en();

insert into public.sla_reglas_operativas
  (tipo_alerta, tipo_servicio, cliente_segmento, horas_limite, umbral_alerta_pct, prioridad, severidad_base)
values
  ('cuenta_nueva_usuario', 'general', 'general', 2, 80, 60, 'media'),
  ('documentos_usuario', 'general', 'general', 4, 80, 65, 'alta'),
  ('conductor_primera_vez', 'general', 'general', 24, 80, 55, 'media'),
  ('documentos_conductor', 'general', 'general', 24, 80, 65, 'alta'),
  ('traslado_sin_conductor', 'general', 'general', 2, 80, 75, 'alta'),
  ('conductor_sin_senal', 'general', 'general', 1.5, 80, 80, 'alta'),
  ('incidencia_sin_responsable', 'general', 'general', 1, 80, 70, 'media'),
  ('desviacion_ruta', 'general', 'general', 1, 80, 85, 'alta'),
  ('emergencia', 'general', 'general', 0.25, 1, 100, 'critica')
on conflict (tipo_alerta, tipo_servicio, cliente_segmento) do update set
  horas_limite = excluded.horas_limite,
  umbral_alerta_pct = excluded.umbral_alerta_pct,
  prioridad = excluded.prioridad,
  severidad_base = excluded.severidad_base,
  activo = true,
  actualizado_en = now();

create table if not exists public.alertas_sla_operacionales (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  categoria text not null check (categoria in (
    'emergencia','sla_vencido','sla_en_riesgo','traslado_sin_conductor',
    'conductor_sin_senal','desviacion_ruta','incidencia_sin_responsable',
    'documentacion_bloqueante'
  )),
  severidad text not null check (severidad in ('critica','alta','media')),
  prioridad int not null default 50,
  entidad_tipo text not null,
  entidad_id uuid not null,
  traslado_id uuid references public.traslados(id) on delete set null,
  folio text not null,
  descripcion text not null,
  regla_id uuid references public.sla_reglas_operativas(id) on delete set null,
  origen_creado_en timestamptz not null,
  vence_en timestamptz not null,
  horas_transcurridas numeric(10,2) not null default 0,
  horas_limite numeric(8,2) not null,
  sla_restante_horas numeric(10,2) not null,
  porcentaje_consumido int not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta','acusada','escalada','resuelta','cerrada')),
  responsable text,
  asignado_por_admin_id uuid references public.admins(id) on delete set null,
  asignado_en timestamptz,
  acuse_por_admin_id uuid references public.admins(id) on delete set null,
  acuse_en timestamptz,
  escalado_por_admin_id uuid references public.admins(id) on delete set null,
  escalado_en timestamptz,
  resuelto_por_admin_id uuid references public.admins(id) on delete set null,
  resuelto_en timestamptz,
  cerrado_por_admin_id uuid references public.admins(id) on delete set null,
  cerrado_en timestamptz,
  notificacion_estado text not null default 'pendiente' check (notificacion_estado in ('pendiente','encolada','enviada','fallida','no_aplica')),
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists alertas_sla_estado_prioridad_idx
  on public.alertas_sla_operacionales (estado, prioridad desc, creado_en);
create index if not exists alertas_sla_entidad_idx
  on public.alertas_sla_operacionales (entidad_tipo, entidad_id);
create index if not exists alertas_sla_traslado_idx
  on public.alertas_sla_operacionales (traslado_id);

create trigger alertas_sla_operacionales_actualizado_en
  before update on public.alertas_sla_operacionales
  for each row execute function public.set_actualizado_en();

create table if not exists public.alertas_sla_historial (
  id uuid primary key default gen_random_uuid(),
  alerta_id uuid not null references public.alertas_sla_operacionales(id) on delete cascade,
  accion text not null check (accion in ('creada','actualizada','asignada','acuse','escalada','resuelta','cerrada')),
  admin_id uuid references public.admins(id) on delete set null,
  estado_anterior text,
  estado_nuevo text,
  responsable_anterior text,
  responsable_nuevo text,
  comentario text,
  datos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists alertas_sla_historial_alerta_idx
  on public.alertas_sla_historial (alerta_id, creado_en desc);

create table if not exists public.notificaciones_admin_operativas (
  id uuid primary key default gen_random_uuid(),
  alerta_id uuid references public.alertas_sla_operacionales(id) on delete cascade,
  canal text not null default 'bandeja_admin',
  destinatario_rol text not null default 'supervisor',
  titulo text not null,
  cuerpo text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','enviada','fallida')),
  creado_en timestamptz not null default now(),
  enviado_en timestamptz
);

alter table public.sla_reglas_operativas enable row level security;
alter table public.alertas_sla_operacionales enable row level security;
alter table public.alertas_sla_historial enable row level security;
alter table public.notificaciones_admin_operativas enable row level security;

drop policy if exists admin_lee_sla_reglas_operativas on public.sla_reglas_operativas;
create policy admin_lee_sla_reglas_operativas
  on public.sla_reglas_operativas for select to authenticated
  using (public.admin_tiene_permiso('incidencias:leer') or public.admin_tiene_permiso('viajes:leer'));

drop policy if exists admin_lee_alertas_sla_operacionales on public.alertas_sla_operacionales;
create policy admin_lee_alertas_sla_operacionales
  on public.alertas_sla_operacionales for select to authenticated
  using (public.admin_tiene_permiso('incidencias:leer') or public.admin_tiene_permiso('viajes:leer'));

drop policy if exists admin_lee_alertas_sla_historial on public.alertas_sla_historial;
create policy admin_lee_alertas_sla_historial
  on public.alertas_sla_historial for select to authenticated
  using (public.admin_tiene_permiso('incidencias:leer') or public.admin_tiene_permiso('viajes:leer'));

drop policy if exists admin_lee_notificaciones_admin_operativas on public.notificaciones_admin_operativas;
create policy admin_lee_notificaciones_admin_operativas
  on public.notificaciones_admin_operativas for select to authenticated
  using (public.admin_tiene_permiso('incidencias:leer') or public.admin_tiene_permiso('viajes:leer'));

grant select on public.sla_reglas_operativas to authenticated;
grant select on public.alertas_sla_operacionales to authenticated;
grant select on public.alertas_sla_historial to authenticated;
grant select on public.notificaciones_admin_operativas to authenticated;

create or replace function public.sla_horas_operativas_desde(p_inicio timestamptz, p_zona_horaria text, p_pausar boolean default true)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_inicio is null then 0::numeric
    when not p_pausar then round(greatest(extract(epoch from (now() - p_inicio)) / 3600, 0)::numeric, 2)
    else coalesce((
      select round(count(*)::numeric, 2)
      from generate_series(date_trunc('hour', p_inicio), now(), interval '1 hour') as hora
      where extract(isodow from hora at time zone coalesce(nullif(p_zona_horaria, ''), 'America/Mexico_City')) between 1 and 5
        and extract(hour from hora at time zone coalesce(nullif(p_zona_horaria, ''), 'America/Mexico_City')) between 9 and 17
    ), 0::numeric)
  end
$$;

create or replace function public.sla_categoria_desde_tipo(p_tipo text, p_vencido boolean)
returns text
language sql
immutable
as $$
  select case
    when p_tipo = 'emergencia' then 'emergencia'
    when p_tipo = 'traslado_sin_conductor' then 'traslado_sin_conductor'
    when p_tipo = 'conductor_sin_senal' then 'conductor_sin_senal'
    when p_tipo = 'desviacion_ruta' then 'desviacion_ruta'
    when p_tipo = 'incidencia_sin_responsable' then 'incidencia_sin_responsable'
    when p_tipo in ('documentos_usuario','documentos_conductor') then 'documentacion_bloqueante'
    when p_vencido then 'sla_vencido'
    else 'sla_en_riesgo'
  end
$$;

create or replace function public.admin_sincroniza_alertas_sla_operacionales()
returns setof public.alertas_sla_operacionales
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
begin
  if not (public.admin_tiene_permiso('incidencias:leer') or public.admin_tiene_permiso('viajes:leer')) then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  with fuentes as (
    select
      'usuario:' || u.id || ':' || case when u.estado_verificacion = 'pendiente' then 'cuenta_nueva_usuario' else 'documentos_usuario' end as dedupe_key,
      case when u.estado_verificacion = 'pendiente' then 'cuenta_nueva_usuario' else 'documentos_usuario' end as tipo_alerta,
      'usuario' as entidad_tipo,
      u.id as entidad_id,
      null::uuid as traslado_id,
      'Usuario ' || upper(left(u.id::text, 8)) as folio,
      'Cuenta de usuario pendiente de verificacion operacional.' as descripcion,
      u.creado_en as origen_creado_en,
      jsonb_build_object('estado_verificacion', u.estado_verificacion) as metadata
    from public.usuarios u
    where u.estado_verificacion in ('pendiente','en_revision')
    union all
    select
      'conductor:' || c.id || ':' || case when coalesce(c.traslados_completados, 0) = 0 then 'conductor_primera_vez' else 'documentos_conductor' end,
      case when coalesce(c.traslados_completados, 0) = 0 then 'conductor_primera_vez' else 'documentos_conductor' end,
      'conductor',
      c.id,
      null::uuid,
      'Conductor ' || upper(left(c.id::text, 8)),
      'Conductor pendiente de verificacion o documentos vigentes.',
      c.creado_en,
      jsonb_build_object('estado', c.estado, 'documentos_vigentes', c.documentos_vigentes)
    from public.conductores c
    where c.estado = 'pendiente_verificacion'
    union all
    select
      'traslado:' || t.id || ':traslado_sin_conductor',
      'traslado_sin_conductor',
      'traslado',
      t.id,
      t.id,
      'Traslado ' || upper(left(t.id::text, 8)),
      'Traslado activo sin conductor asignado.',
      t.actualizado_en,
      jsonb_build_object('estado', t.estado)
    from public.traslados t
    where t.estado = 'pendiente_de_conductor'
    union all
    select
      'traslado:' || t.id || ':conductor_sin_senal',
      'conductor_sin_senal',
      'traslado',
      t.id,
      t.id,
      'Traslado ' || upper(left(t.id::text, 8)),
      'Conductor sin actualizacion GPS dentro del SLA oficial.',
      coalesce(ts.ultima_ubicacion_en, t.actualizado_en),
      jsonb_build_object('estado', t.estado, 'ultima_ubicacion_en', ts.ultima_ubicacion_en)
    from public.traslados t
    left join public.tracking_salud_traslado ts on ts.traslado_id = t.id
    where t.conductor_id is not null
      and t.estado in ('conductor_asignado','conductor_en_camino_al_origen','conductor_en_punto_de_recoleccion','traslado_en_curso','incidencia_reportada','llegada_a_destino')
    union all
    select
      'incidencia:' || i.id || ':' || case when i.tipo in ('perdida_conectividad','descompostura_en_ruta','infraccion_autoridad_vial') then 'desviacion_ruta' else 'incidencia_sin_responsable' end,
      case when i.tipo in ('perdida_conectividad','descompostura_en_ruta','infraccion_autoridad_vial') then 'desviacion_ruta' else 'incidencia_sin_responsable' end,
      'incidencia',
      i.id,
      i.traslado_id,
      'Traslado ' || upper(left(i.traslado_id::text, 8)),
      coalesce(nullif(i.descripcion, ''), replace(i.tipo::text, '_', ' ')),
      i.creada_en,
      jsonb_build_object('tipo', i.tipo, 'momento', i.momento)
    from public.incidencias i
    where not i.resuelta
    union all
    select
      'emergencia:' || ra.id,
      'emergencia',
      'emergencia',
      ra.id,
      ra.traslado_id,
      coalesce('Traslado ' || upper(left(ra.traslado_id::text, 8)), 'Evento ' || upper(left(ra.id::text, 8))),
      'Emergencia activada desde canal operativo. Requiere acuse inmediato.',
      ra.timestamp,
      coalesce(ra.datos, '{}'::jsonb)
    from public.registro_auditoria ra
    where ra.evento = 'activacion_soporte_emergencia'
  ), calculadas as (
    select
      f.*,
      r.id as regla_id,
      r.horas_limite,
      r.umbral_alerta_pct,
      r.prioridad,
      r.severidad_base,
      r.zona_horaria,
      r.pausa_fuera_horario,
      public.sla_horas_operativas_desde(f.origen_creado_en, r.zona_horaria, r.pausa_fuera_horario) as horas_transcurridas
    from fuentes f
    join public.sla_reglas_operativas r
      on r.tipo_alerta = f.tipo_alerta
     and r.tipo_servicio = 'general'
     and r.cliente_segmento = 'general'
     and r.activo
  ), filtradas as (
    select
      *,
      greatest(round(((horas_transcurridas / horas_limite) * 100)::numeric), 0)::int as porcentaje_consumido,
      horas_limite - horas_transcurridas as sla_restante_horas,
      (horas_transcurridas >= horas_limite) as vencido
    from calculadas
    where tipo_alerta = 'emergencia'
       or greatest(round(((horas_transcurridas / horas_limite) * 100)::numeric), 0)::int >= umbral_alerta_pct
  ), upserted as (
    insert into public.alertas_sla_operacionales (
      dedupe_key, categoria, severidad, prioridad, entidad_tipo, entidad_id, traslado_id,
      folio, descripcion, regla_id, origen_creado_en, vence_en, horas_transcurridas,
      horas_limite, sla_restante_horas, porcentaje_consumido, metadata, notificacion_estado
    )
    select
      dedupe_key,
      public.sla_categoria_desde_tipo(tipo_alerta, vencido),
      case when tipo_alerta = 'emergencia' or porcentaje_consumido >= 150 then 'critica' else severidad_base end,
      prioridad,
      entidad_tipo,
      entidad_id,
      traslado_id,
      folio,
      descripcion,
      regla_id,
      origen_creado_en,
      origen_creado_en + make_interval(hours => ceil(horas_limite)::int),
      horas_transcurridas,
      horas_limite,
      sla_restante_horas,
      porcentaje_consumido,
      metadata || jsonb_build_object('tipo_alerta', tipo_alerta, 'zona_horaria', zona_horaria, 'pausa_fuera_horario', pausa_fuera_horario),
      case when tipo_alerta = 'emergencia' then 'encolada' else 'pendiente' end
    from filtradas
    on conflict (dedupe_key) do update set
      categoria = excluded.categoria,
      severidad = excluded.severidad,
      prioridad = excluded.prioridad,
      folio = excluded.folio,
      descripcion = excluded.descripcion,
      regla_id = excluded.regla_id,
      horas_transcurridas = excluded.horas_transcurridas,
      horas_limite = excluded.horas_limite,
      sla_restante_horas = excluded.sla_restante_horas,
      porcentaje_consumido = excluded.porcentaje_consumido,
      metadata = excluded.metadata,
      actualizado_en = now()
    where public.alertas_sla_operacionales.estado <> 'cerrada'
    returning *
  )
  insert into public.alertas_sla_historial(alerta_id, accion, admin_id, estado_nuevo, datos)
  select u.id, 'actualizada', v_admin_id, u.estado, jsonb_build_object('porcentaje_consumido', u.porcentaje_consumido)
  from upserted u
  where not exists (
    select 1 from public.alertas_sla_historial h
    where h.alerta_id = u.id and h.accion in ('creada','actualizada') and h.creado_en > now() - interval '15 minutes'
  );

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values(auth.uid(), v_admin_id, 'consulta', 'alertas_sla', 'sincronizar',
    jsonb_build_object('abiertas', (select count(*) from public.alertas_sla_operacionales where estado <> 'cerrada')));

  return query
    select *
    from public.alertas_sla_operacionales
    where estado <> 'cerrada'
    order by prioridad desc, case severidad when 'critica' then 3 when 'alta' then 2 else 1 end desc, origen_creado_en asc
    limit 200;
end
$$;

create or replace function public.admin_actualiza_alerta_sla(
  p_alerta_id uuid,
  p_accion text,
  p_responsable text default null,
  p_comentario text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_alerta public.alertas_sla_operacionales%rowtype;
  v_estado_nuevo text;
  v_responsable_nuevo text;
  v_estado_anterior text;
  v_responsable_anterior text;
begin
  if not (public.admin_tiene_permiso('incidencias:leer') or public.admin_tiene_permiso('viajes:gestionar')) then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if p_accion not in ('asignar','acuse','escalar','resolver','cerrar') then
    raise exception using errcode='22023', message='ACCION_ALERTA_INVALIDA';
  end if;
  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();
  select * into strict v_alerta from public.alertas_sla_operacionales where id = p_alerta_id for update;
  v_estado_anterior := v_alerta.estado;
  v_responsable_anterior := v_alerta.responsable;

  v_estado_nuevo := case
    when p_accion = 'acuse' then 'acusada'
    when p_accion = 'escalar' then 'escalada'
    when p_accion = 'resolver' then 'resuelta'
    when p_accion = 'cerrar' then 'cerrada'
    else v_alerta.estado
  end;
  v_responsable_nuevo := coalesce(nullif(btrim(p_responsable), ''), v_alerta.responsable);

  if p_accion = 'asignar' and v_responsable_nuevo is null then
    raise exception using errcode='22023', message='RESPONSABLE_OBLIGATORIO';
  end if;
  if p_accion = 'cerrar' and v_alerta.estado <> 'resuelta' then
    raise exception using errcode='22023', message='ALERTA_DEBE_RESOLVERSE_ANTES_DE_CERRAR';
  end if;

  update public.alertas_sla_operacionales
  set
    estado = v_estado_nuevo,
    responsable = v_responsable_nuevo,
    asignado_por_admin_id = case when p_accion = 'asignar' then v_admin_id else asignado_por_admin_id end,
    asignado_en = case when p_accion = 'asignar' then now() else asignado_en end,
    acuse_por_admin_id = case when p_accion = 'acuse' then v_admin_id else acuse_por_admin_id end,
    acuse_en = case when p_accion = 'acuse' then now() else acuse_en end,
    escalado_por_admin_id = case when p_accion = 'escalar' then v_admin_id else escalado_por_admin_id end,
    escalado_en = case when p_accion = 'escalar' then now() else escalado_en end,
    resuelto_por_admin_id = case when p_accion = 'resolver' then v_admin_id else resuelto_por_admin_id end,
    resuelto_en = case when p_accion = 'resolver' then now() else resuelto_en end,
    cerrado_por_admin_id = case when p_accion = 'cerrar' then v_admin_id else cerrado_por_admin_id end,
    cerrado_en = case when p_accion = 'cerrar' then now() else cerrado_en end
  where id = p_alerta_id
  returning * into v_alerta;

  insert into public.alertas_sla_historial(
    alerta_id, accion, admin_id, estado_anterior, estado_nuevo,
    responsable_anterior, responsable_nuevo, comentario, datos
  )
  values (
    p_alerta_id,
    case
      when p_accion = 'asignar' then 'asignada'
      when p_accion = 'escalar' then 'escalada'
      when p_accion = 'resolver' then 'resuelta'
      when p_accion = 'cerrar' then 'cerrada'
      else p_accion
    end,
    v_admin_id,
    v_estado_anterior,
    v_estado_nuevo,
    v_responsable_anterior,
    v_responsable_nuevo,
    nullif(btrim(coalesce(p_comentario, '')), ''),
    jsonb_build_object('accion', p_accion)
  );

  if p_accion = 'escalar' then
    insert into public.notificaciones_admin_operativas(alerta_id, destinatario_rol, titulo, cuerpo)
    values (p_alerta_id, 'supervisor', 'Alerta SLA escalada', v_alerta.folio || ': ' || v_alerta.descripcion);
    update public.alertas_sla_operacionales set notificacion_estado = 'encolada' where id = p_alerta_id;
  end if;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values(auth.uid(), v_admin_id, 'mutacion', 'alertas_sla', p_accion,
    jsonb_build_object('alerta_id', p_alerta_id, 'responsable', v_responsable_nuevo, 'comentario', nullif(btrim(coalesce(p_comentario, '')), '')));

  return jsonb_build_object('alerta_id', p_alerta_id, 'estado', v_estado_nuevo, 'responsable', v_responsable_nuevo);
end
$$;

revoke all on function public.sla_horas_operativas_desde(timestamptz, text, boolean) from public;
revoke all on function public.admin_sincroniza_alertas_sla_operacionales() from public;
revoke all on function public.admin_actualiza_alerta_sla(uuid, text, text, text) from public;
grant execute on function public.sla_horas_operativas_desde(timestamptz, text, boolean) to authenticated;
grant execute on function public.admin_sincroniza_alertas_sla_operacionales() to authenticated;
grant execute on function public.admin_actualiza_alerta_sla(uuid, text, text, text) to authenticated;
