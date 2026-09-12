-- FASE 13 — SLA y motor de alertas: que la Torre opere por excepción.
-- La plataforma avisa ANTES de incumplir (warning) y registra el breach.
-- Jerarquía de política efectiva: operación > empresa > global (sla_policies).
-- Evaluación periódica (13.4) + eventos inmutables (13.5) + puente a la
-- bandeja existente alertas_sla_operacionales (13.8) + cola priorizada (13.9)
-- + reportes históricos desde sla_events (13.10).
-- Convive con RT-46 (sla_reglas_operativas) y Fase 11 (SLA por severidad):
-- no se toca ninguna tabla previa; el puente solo hace UPSERT de alertas.

-- 13.1 — catálogo global de políticas SLA
create table public.sla_policies (
  codigo text primary key
    constraint sla_policies_codigo_check
    check (codigo in ('asignacion','recoleccion','entrega','sin_gps','respuesta_incidencia')),
  nombre text not null,
  descripcion text not null default '',
  horas_limite numeric(10,2) not null check (horas_limite > 0),
  warning_pct int not null default 80 check (warning_pct between 1 and 99),
  severidad text not null default 'alta'
    check (severidad in ('critica','alta','media')),
  prioridad_base int not null default 60 check (prioridad_base between 1 and 100),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger sla_policies_actualizado_en
  before update on public.sla_policies
  for each row execute function public.set_actualizado_en();

insert into public.sla_policies (codigo, nombre, descripcion, horas_limite, warning_pct, severidad, prioridad_base) values
  ('asignacion', 'Tiempo máximo de asignación', 'De solicitud confirmada a conductor asignado.', 2, 75, 'alta', 75),
  ('recoleccion', 'Ventana de recolección', 'De solicitud a vehículo recibido.', 24, 80, 'alta', 70),
  ('entrega', 'Ventana de entrega', 'De vehículo recibido a entrega confirmada.', 48, 80, 'alta', 70),
  ('sin_gps', 'Tiempo máximo sin GPS', 'Sin señal GPS en viaje activo.', 0.5, 80, 'alta', 85),
  ('respuesta_incidencia', 'Tiempo de respuesta a incidencia', 'De incidencia abierta a primera atención/resolución.', 4, 75, 'alta', 80)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  horas_limite = excluded.horas_limite,
  warning_pct = excluded.warning_pct,
  severidad = excluded.severidad,
  prioridad_base = excluded.prioridad_base,
  activo = true,
  actualizado_en = now();

-- 13.2 — override por empresa (NULL = hereda global)
create table public.sla_empresa_politicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  policy_codigo text not null references public.sla_policies(codigo) on delete cascade,
  horas_limite numeric(10,2) check (horas_limite is null or horas_limite > 0),
  warning_pct int check (warning_pct is null or (warning_pct between 1 and 99)),
  severidad text check (severidad is null or severidad in ('critica','alta','media')),
  prioridad_base int check (prioridad_base is null or (prioridad_base between 1 and 100)),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, policy_codigo)
);

create trigger sla_empresa_politicas_actualizado_en
  before update on public.sla_empresa_politicas
  for each row execute function public.set_actualizado_en();

create index sla_empresa_politicas_empresa_idx
  on public.sla_empresa_politicas (empresa_id);

-- 13.3 — override por operación (máxima prioridad en la jerarquía)
create table public.sla_operacion_politicas (
  id uuid primary key default gen_random_uuid(),
  operacion_id uuid not null references public.operaciones(id) on delete cascade,
  policy_codigo text not null references public.sla_policies(codigo) on delete cascade,
  horas_limite numeric(10,2) check (horas_limite is null or horas_limite > 0),
  warning_pct int check (warning_pct is null or (warning_pct between 1 and 99)),
  severidad text check (severidad is null or severidad in ('critica','alta','media')),
  prioridad_base int check (prioridad_base is null or (prioridad_base between 1 and 100)),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (operacion_id, policy_codigo)
);

create trigger sla_operacion_politicas_actualizado_en
  before update on public.sla_operacion_politicas
  for each row execute function public.set_actualizado_en();

create index sla_operacion_politicas_operacion_idx
  on public.sla_operacion_politicas (operacion_id);

-- Resolución efectiva: operación > empresa > global
create or replace function public.sla_politica_efectiva(
  p_policy text,
  p_empresa_id uuid,
  p_operacion_id uuid
)
returns table (
  horas_limite numeric,
  warning_pct int,
  severidad text,
  prioridad_base int,
  activo boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_horas numeric;
  v_warn int;
  v_sev text;
  v_prio int;
  v_act boolean;
  r_emp record;
  r_op record;
begin
  select p.horas_limite, p.warning_pct, p.severidad, p.prioridad_base, p.activo
    into v_horas, v_warn, v_sev, v_prio, v_act
  from public.sla_policies p where p.codigo = p_policy;
  if not found then
    raise exception 'Política SLA desconocida: %', p_policy;
  end if;

  if p_empresa_id is not null then
    select e.horas_limite, e.warning_pct, e.severidad, e.prioridad_base, e.activo
      into r_emp
    from public.sla_empresa_politicas e
    where e.empresa_id = p_empresa_id and e.policy_codigo = p_policy;
    if found then
      v_act := r_emp.activo;
      v_horas := coalesce(r_emp.horas_limite, v_horas);
      v_warn := coalesce(r_emp.warning_pct, v_warn);
      v_sev := coalesce(r_emp.severidad, v_sev);
      v_prio := coalesce(r_emp.prioridad_base, v_prio);
    end if;
  end if;

  if p_operacion_id is not null then
    select o.horas_limite, o.warning_pct, o.severidad, o.prioridad_base, o.activo
      into r_op
    from public.sla_operacion_politicas o
    where o.operacion_id = p_operacion_id and o.policy_codigo = p_policy;
    if found then
      v_act := r_op.activo;
      v_horas := coalesce(r_op.horas_limite, v_horas);
      v_warn := coalesce(r_op.warning_pct, v_warn);
      v_sev := coalesce(r_op.severidad, v_sev);
      v_prio := coalesce(r_op.prioridad_base, v_prio);
    end if;
  end if;

  horas_limite := v_horas;
  warning_pct := v_warn;
  severidad := v_sev;
  prioridad_base := v_prio;
  activo := v_act;

  return next;
end;
$$;

-- 13.4 — estado de la última evaluación por traslado+política (+incidencia)
create table public.sla_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  traslado_id uuid not null references public.traslados(id) on delete cascade,
  incidencia_id uuid references public.incidencias(id) on delete cascade,
  policy_codigo text not null references public.sla_policies(codigo) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete set null,
  operacion_id uuid references public.operaciones(id) on delete set null,
  inicio timestamptz not null,
  deadline timestamptz not null,
  horas_transcurridas numeric(10,2) not null default 0,
  horas_limite numeric(10,2) not null,
  porcentaje int not null default 0,
  estado text not null default 'ok'
    constraint sla_evaluaciones_estado_check check (estado in ('ok','warning','breach')),
  ultima_evaluacion_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger sla_evaluaciones_actualizado_en
  before update on public.sla_evaluaciones
  for each row execute function public.set_actualizado_en();

-- un traslado tiene una fila por política; respuesta_incidencia una por incidencia
create unique index sla_evaluaciones_traslado_policy_uidx
  on public.sla_evaluaciones (traslado_id, policy_codigo)
  where incidencia_id is null;
create unique index sla_evaluaciones_traslado_policy_inc_uidx
  on public.sla_evaluaciones (traslado_id, policy_codigo, incidencia_id)
  where incidencia_id is not null;
create index sla_evaluaciones_estado_idx
  on public.sla_evaluaciones (estado, deadline);
create index sla_evaluaciones_traslado_idx
  on public.sla_evaluaciones (traslado_id);

-- 13.5 — eventos inmutables (append-only; warning avisa ANTES del breach)
create table public.sla_events (
  id uuid primary key default gen_random_uuid(),
  traslado_id uuid not null references public.traslados(id) on delete cascade,
  incidencia_id uuid references public.incidencias(id) on delete cascade,
  operacion_id uuid references public.operaciones(id) on delete set null,
  empresa_id uuid references public.empresas(id) on delete set null,
  policy_codigo text not null references public.sla_policies(codigo) on delete restrict,
  tipo_evento text not null
    constraint sla_events_tipo_check check (tipo_evento in ('warning','breach','recuperado')),
  estado_traslado text,
  horas_transcurridas numeric(10,2) not null default 0,
  horas_limite numeric(10,2) not null,
  porcentaje int not null default 0,
  deadline timestamptz not null,
  inicio timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create index sla_events_traslado_policy_fecha_idx
  on public.sla_events (traslado_id, policy_codigo, creado_en desc);
create index sla_events_fecha_idx
  on public.sla_events (creado_en desc);
create index sla_events_empresa_fecha_idx
  on public.sla_events (empresa_id, creado_en desc) where empresa_id is not null;
create index sla_events_operacion_fecha_idx
  on public.sla_events (operacion_id, creado_en desc) where operacion_id is not null;
create index sla_events_tipo_fecha_idx
  on public.sla_events (tipo_evento, creado_en desc);

-- inmutabilidad: sin UPDATE ni DELETE (solo Torre vía service_role en-compensación)
create or replace function public.sla_events_inmutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'sla_events es append-only (fase 13).';
end;
$$;

create trigger sla_events_sin_update
  before update or delete on public.sla_events
  for each row execute function public.sla_events_inmutable();

-- 13.8 — puente a la bandeja existente: cada warning/breach crea o escala
-- la alerta operacional (sla_en_riesgo -> sla_vencido); recuperado la resuelve.
create or replace function public.sla_events_puente_alertas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dedupe text;
  v_categoria text;
  v_sev text;
  v_alerta uuid;
  v_ef record;
begin
  v_dedupe := 'fase13:' || new.traslado_id::text || ':' || new.policy_codigo
    || ':' || coalesce(new.incidencia_id::text, '-');

  if new.tipo_evento = 'recuperado' then
    update public.alertas_sla_operacionales
    set estado = 'resuelta',
        resuelto_en = now(),
        metadata = metadata || jsonb_build_object('fase13_recuperado_en', now(), 'fase13_evento', new.id),
        actualizado_en = now()
    where dedupe_key = v_dedupe and estado not in ('resuelta', 'cerrada');
    return new;
  end if;

  v_categoria := case when new.tipo_evento = 'breach' then 'sla_vencido' else 'sla_en_riesgo' end;

  select * into v_ef
  from public.sla_politica_efectiva(new.policy_codigo, new.empresa_id, new.operacion_id);

  v_sev := case v_ef.severidad when 'critica' then 'critica' when 'media' then 'media' else 'alta' end;
  -- breach siempre escala a crítica para operar por excepción
  if new.tipo_evento = 'breach' and v_sev <> 'critica' and new.policy_codigo in ('sin_gps', 'respuesta_incidencia') then
    v_sev := 'critica';
  end if;

  insert into public.alertas_sla_operacionales (
    dedupe_key, categoria, severidad, prioridad, entidad_tipo, entidad_id, traslado_id,
    folio, descripcion, regla_id, origen_creado_en, vence_en,
    horas_transcurridas, horas_limite, sla_restante_horas, porcentaje_consumido,
    estado, metadata, notificacion_estado
  ) values (
    v_dedupe, v_categoria, v_sev, v_ef.prioridad_base,
    'traslado', new.traslado_id, new.traslado_id,
    'Traslado ' || upper(left(new.traslado_id::text, 8)) || ' · ' || new.policy_codigo,
    case new.policy_codigo
      when 'asignacion' then 'Sin conductor asignado dentro del SLA.'
      when 'recoleccion' then 'Recolección fuera de ventana SLA.'
      when 'entrega' then 'Entrega fuera de ventana SLA.'
      when 'sin_gps' then 'Conductor sin señal GPS dentro del SLA.'
      when 'respuesta_incidencia' then 'Incidencia sin atención dentro del SLA.'
      else 'Riesgo SLA ' || new.policy_codigo
    end,
    null, new.inicio, new.deadline,
    new.horas_transcurridas, new.horas_limite,
    new.horas_limite - new.horas_transcurridas, new.porcentaje,
    'abierta',
    jsonb_build_object('fase13', true, 'policy_codigo', new.policy_codigo,
      'tipo_evento', new.tipo_evento, 'evento_id', new.id,
      'incidencia_id', new.incidencia_id),
    'pendiente'
  )
  on conflict (dedupe_key) do update set
    categoria = excluded.categoria,
    severidad = excluded.severidad,
    prioridad = excluded.prioridad,
    vence_en = excluded.vence_en,
    horas_transcurridas = excluded.horas_transcurridas,
    horas_limite = excluded.horas_limite,
    sla_restante_horas = excluded.sla_restante_horas,
    porcentaje_consumido = excluded.porcentaje_consumido,
    metadata = alertas_sla_operacionales.metadata || excluded.metadata,
    actualizado_en = now()
  where alertas_sla_operacionales.estado not in ('cerrada')
  returning id into v_alerta;

  -- reabrir si se había resuelto y vuelve a sonar (rechazo a perder el aviso)
  update public.alertas_sla_operacionales
  set estado = 'abierta', resuelto_en = null, actualizado_en = now()
  where id = v_alerta and estado = 'resuelta';

  insert into public.notificaciones_admin_operativas (
    alerta_id, canal, destinatario_rol, titulo, cuerpo
  ) values (
    v_alerta, 'bandeja_admin',
    case when v_sev = 'critica' then 'direccion' else 'supervisor' end,
    case when new.tipo_evento = 'breach' then 'SLA incumplido (' || new.policy_codigo || ')'
         else 'SLA en riesgo (' || new.policy_codigo || ')' end,
    'Traslado ' || left(new.traslado_id::text, 8) || ' · ' || new.policy_codigo
      || ' · ' || new.porcentaje::text || '% consumido, vence ' || new.deadline::text
  );

  update public.alertas_sla_operacionales
  set notificacion_estado = 'encolada' where id = v_alerta;

  return new;
end;
$$;

create trigger sla_events_puente_alertas_trg
  after insert on public.sla_events
  for each row execute function public.sla_events_puente_alertas();

-- 13.4 — evaluación periódica (idempotente; solo inserta eventos en transición)
-- Diseñada para cron cada 5-15 min con service_role o Torre autenticada.
create or replace function public.sla_evaluar_traslados(p_limite int default 500)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_es_cron boolean := (auth.uid() is null);
  v_ahora timestamptz := now();
  v_evaluados int := 0;
  v_warnings int := 0;
  v_breaches int := 0;
  v_recuperados int := 0;
  r_traslado record;
  v_empresa uuid;
  v_ef record;
  v_pol record;
  v_inicio timestamptz;
  v_aplica boolean;
  v_cumplido boolean;
  v_elapsed numeric;
  v_porcentaje int;
  v_estado text;
  v_deadline timestamptz;
  r_inc record;
  v_prev text;
begin
  if not v_es_cron and not public.es_admin() then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  if p_limite is null or p_limite < 1 or p_limite > 5000 then
    raise exception using errcode='22023', message='LIMITE_INVALIDO';
  end if;

  for r_traslado in
    select t.id, t.estado, t.estado_operativo, t.conductor_id, t.usuario_id,
           t.operation_id, t.creado_en, t.actualizado_en
    from public.traslados t
    where t.estado not in ('servicio_cerrado','servicio_cancelado','traslado_fallido')
    order by t.actualizado_en asc
    limit p_limite
  loop
    v_evaluados := v_evaluados + 1;

    select u.empresa_id into v_empresa
    from public.usuarios u where u.id = r_traslado.usuario_id;

    -- políticas a nivel traslado (4)
    for v_pol in
      select unnest(array['asignacion','recoleccion','entrega','sin_gps']) as policy
    loop
      begin
        select * into v_ef from public.sla_politica_efectiva(
          v_pol.policy, v_empresa, r_traslado.operation_id);
      exception when others then
        continue;
      end;
      if not v_ef.activo then continue; end if;

      v_aplica := true;
      v_cumplido := false;
      v_inicio := null;

      if v_pol.policy = 'asignacion' then
        if r_traslado.conductor_id is not null then
          v_cumplido := true;
          v_inicio := r_traslado.creado_en;
        else
          v_inicio := r_traslado.creado_en;
        end if;
      elsif v_pol.policy = 'recoleccion' then
        if r_traslado.estado_operativo in ('vehicle_received','in_transit','delivery_in_progress','delivered','closed') then
          v_cumplido := true;
          v_inicio := r_traslado.creado_en;
        elsif r_traslado.estado_operativo in ('requested','confirmed','planned','assigned','pickup_in_progress') then
          v_inicio := r_traslado.creado_en;
        else
          v_aplica := false;
        end if;
      elsif v_pol.policy = 'entrega' then
        if r_traslado.estado_operativo in ('delivered','closed') then
          v_cumplido := true;
          select coalesce(min(h.creado_en), r_traslado.creado_en) into v_inicio
          from public.historial_estados_traslado h
          where h.traslado_id = r_traslado.id and h.estado_nuevo = 'vehiculo_recibido';
        elsif r_traslado.estado_operativo in ('vehicle_received','in_transit','delivery_in_progress') then
          select min(h.creado_en) into v_inicio
          from public.historial_estados_traslado h
          where h.traslado_id = r_traslado.id and h.estado_nuevo = 'vehiculo_recibido';
          v_inicio := coalesce(v_inicio, r_traslado.creado_en);
        else
          v_aplica := false; -- aún no inicia la ventana de entrega
        end if;
      elsif v_pol.policy = 'sin_gps' then
        if r_traslado.conductor_id is null then
          v_aplica := false;
        elsif r_traslado.estado_operativo not in ('assigned','pickup_in_progress','vehicle_received','in_transit','delivery_in_progress') then
          v_aplica := false;
        else
          select coalesce(s.ultima_ubicacion_en, s.ultimo_envio_en, r_traslado.actualizado_en)
            into v_inicio
          from public.tracking_salud_traslado s
          where s.traslado_id = r_traslado.id;
          v_inicio := coalesce(v_inicio, r_traslado.actualizado_en);
        end if;
      end if;

      if not v_aplica or v_inicio is null then continue; end if;

      v_deadline := v_inicio + make_interval(hours => ceil(v_ef.horas_limite)::int);
      -- sin_gps usa límite fraccionario exacto (30 min); el resto usa techo horario
      if v_pol.policy = 'sin_gps' then
        v_deadline := v_inicio + (v_ef.horas_limite * interval '1 hour');
      end if;

      if v_cumplido then
        v_elapsed := 0; v_porcentaje := 0; v_estado := 'ok';
      else
        v_elapsed := round((extract(epoch from (v_ahora - v_inicio)) / 3600)::numeric, 2);
        if v_elapsed < 0 then v_elapsed := 0; end if;
        v_porcentaje := greatest(floor((v_elapsed / v_ef.horas_limite) * 100)::int, 0);
        v_estado := case
          when v_elapsed >= v_ef.horas_limite then 'breach'
          when v_porcentaje >= v_ef.warning_pct then 'warning'
          else 'ok' end;
      end if;

      select estado into v_prev from public.sla_evaluaciones
      where traslado_id = r_traslado.id and policy_codigo = v_pol.policy
        and incidencia_id is null;

      if v_prev is distinct from v_estado then
        if v_prev in ('warning','breach') and v_estado = 'ok' then
          insert into public.sla_events (
            traslado_id, operacion_id, empresa_id, policy_codigo, tipo_evento,
            estado_traslado, horas_transcurridas, horas_limite, porcentaje, deadline, inicio,
            metadata
          ) values (
            r_traslado.id, r_traslado.operation_id, v_empresa, v_pol.policy, 'recuperado',
            r_traslado.estado::text, v_elapsed, v_ef.horas_limite, v_porcentaje, v_deadline, v_inicio,
            jsonb_build_object('origen', 'evaluacion_periodica', 'cumplido', v_cumplido)
          );
          v_recuperados := v_recuperados + 1;
        elsif v_estado = 'warning' and coalesce(v_prev, 'ok') = 'ok' then
          insert into public.sla_events (
            traslado_id, operacion_id, empresa_id, policy_codigo, tipo_evento,
            estado_traslado, horas_transcurridas, horas_limite, porcentaje, deadline, inicio,
            metadata
          ) values (
            r_traslado.id, r_traslado.operation_id, v_empresa, v_pol.policy, 'warning',
            r_traslado.estado::text, v_elapsed, v_ef.horas_limite, v_porcentaje, v_deadline, v_inicio,
            jsonb_build_object('origen', 'evaluacion_periodica')
          );
          v_warnings := v_warnings + 1;
        elsif v_estado = 'breach' and coalesce(v_prev, 'ok') <> 'breach' then
          insert into public.sla_events (
            traslado_id, operacion_id, empresa_id, policy_codigo, tipo_evento,
            estado_traslado, horas_transcurridas, horas_limite, porcentaje, deadline, inicio,
            metadata
          ) values (
            r_traslado.id, r_traslado.operation_id, v_empresa, v_pol.policy, 'breach',
            r_traslado.estado::text, v_elapsed, v_ef.horas_limite, v_porcentaje, v_deadline, v_inicio,
            jsonb_build_object('origen', 'evaluacion_periodica', 'previo', v_prev)
          );
          v_breaches := v_breaches + 1;
        end if;
      end if;

      insert into public.sla_evaluaciones (
        traslado_id, policy_codigo, empresa_id, operacion_id,
        inicio, deadline, horas_transcurridas, horas_limite, porcentaje, estado,
        ultima_evaluacion_en
      ) values (
        r_traslado.id, v_pol.policy, v_empresa, r_traslado.operation_id,
        v_inicio, v_deadline, v_elapsed, v_ef.horas_limite, v_porcentaje, v_estado, v_ahora
      )
      on conflict (traslado_id, policy_codigo) where incidencia_id is null
      do update set
        empresa_id = excluded.empresa_id,
        operacion_id = excluded.operacion_id,
        inicio = excluded.inicio,
        deadline = excluded.deadline,
        horas_transcurridas = excluded.horas_transcurridas,
        horas_limite = excluded.horas_limite,
        porcentaje = excluded.porcentaje,
        estado = excluded.estado,
        ultima_evaluacion_en = excluded.ultima_evaluacion_en,
        actualizado_en = now();
    end loop;

    -- respuesta_incidencia: una evaluación por incidencia abierta del traslado
    for r_inc in
      select i.id, i.creada_en, i.estado
      from public.incidencias i
      where i.traslado_id = r_traslado.id and i.resuelta = false
        and i.estado not in ('resuelta','cerrada')
    loop
      begin
        select * into v_ef from public.sla_politica_efectiva(
          'respuesta_incidencia', v_empresa, r_traslado.operation_id);
      exception when others then
        continue;
      end;
      if not v_ef.activo then continue; end if;

      v_inicio := r_inc.creada_en;
      v_deadline := v_inicio + (v_ef.horas_limite * interval '1 hour');
      v_elapsed := round((extract(epoch from (v_ahora - v_inicio)) / 3600)::numeric, 2);
      if v_elapsed < 0 then v_elapsed := 0; end if;
      v_porcentaje := greatest(floor((v_elapsed / v_ef.horas_limite) * 100)::int, 0);
      v_estado := case
        when v_elapsed >= v_ef.horas_limite then 'breach'
        when v_porcentaje >= v_ef.warning_pct then 'warning'
        else 'ok' end;

      select estado into v_prev from public.sla_evaluaciones
      where traslado_id = r_traslado.id and policy_codigo = 'respuesta_incidencia'
        and incidencia_id = r_inc.id;

      if v_prev is distinct from v_estado then
        if v_estado = 'warning' and coalesce(v_prev, 'ok') = 'ok' then
          insert into public.sla_events (
            traslado_id, incidencia_id, operacion_id, empresa_id, policy_codigo, tipo_evento,
            estado_traslado, horas_transcurridas, horas_limite, porcentaje, deadline, inicio, metadata
          ) values (
            r_traslado.id, r_inc.id, r_traslado.operation_id, v_empresa, 'respuesta_incidencia', 'warning',
            r_traslado.estado::text, v_elapsed, v_ef.horas_limite, v_porcentaje, v_deadline, v_inicio,
            jsonb_build_object('origen', 'evaluacion_periodica', 'incidencia_estado', r_inc.estado)
          );
          v_warnings := v_warnings + 1;
        elsif v_estado = 'breach' and coalesce(v_prev, 'ok') <> 'breach' then
          insert into public.sla_events (
            traslado_id, incidencia_id, operacion_id, empresa_id, policy_codigo, tipo_evento,
            estado_traslado, horas_transcurridas, horas_limite, porcentaje, deadline, inicio, metadata
          ) values (
            r_traslado.id, r_inc.id, r_traslado.operation_id, v_empresa, 'respuesta_incidencia', 'breach',
            r_traslado.estado::text, v_elapsed, v_ef.horas_limite, v_porcentaje, v_deadline, v_inicio,
            jsonb_build_object('origen', 'evaluacion_periodica', 'previo', v_prev, 'incidencia_estado', r_inc.estado)
          );
          v_breaches := v_breaches + 1;
        end if;
      end if;

      insert into public.sla_evaluaciones (
        traslado_id, incidencia_id, policy_codigo, empresa_id, operacion_id,
        inicio, deadline, horas_transcurridas, horas_limite, porcentaje, estado,
        ultima_evaluacion_en
      ) values (
        r_traslado.id, r_inc.id, 'respuesta_incidencia', v_empresa, r_traslado.operation_id,
        v_inicio, v_deadline, v_elapsed, v_ef.horas_limite, v_porcentaje, v_estado, v_ahora
      )
      on conflict (traslado_id, policy_codigo, incidencia_id) where incidencia_id is not null
      do update set
        empresa_id = excluded.empresa_id,
        operacion_id = excluded.operacion_id,
        inicio = excluded.inicio,
        deadline = excluded.deadline,
        horas_transcurridas = excluded.horas_transcurridas,
        horas_limite = excluded.horas_limite,
        porcentaje = excluded.porcentaje,
        estado = excluded.estado,
        ultima_evaluacion_en = excluded.ultima_evaluacion_en,
        actualizado_en = now();
    end loop;

    -- incidencias resueltas: cierra evaluaciones abiertas con recuperado
    for r_inc in
      select e.incidencia_id
      from public.sla_evaluaciones e
      where e.traslado_id = r_traslado.id
        and e.policy_codigo = 'respuesta_incidencia'
        and e.incidencia_id is not null
        and e.estado in ('warning','breach')
        and not exists (
          select 1 from public.incidencias i
          where i.id = e.incidencia_id and i.resuelta = false
            and i.estado not in ('resuelta','cerrada')
        )
    loop
      insert into public.sla_events (
        traslado_id, incidencia_id, operacion_id, empresa_id, policy_codigo, tipo_evento,
        estado_traslado, horas_transcurridas, horas_limite, porcentaje, deadline, inicio, metadata
      ) values (
        r_traslado.id, r_inc.incidencia_id, r_traslado.operation_id, v_empresa,
        'respuesta_incidencia', 'recuperado', r_traslado.estado::text,
        0, (select horas_limite from public.sla_evaluaciones
            where traslado_id = r_traslado.id and incidencia_id = r_inc.incidencia_id
              and policy_codigo = 'respuesta_incidencia'),
        0,
        (select deadline from public.sla_evaluaciones
            where traslado_id = r_traslado.id and incidencia_id = r_inc.incidencia_id
              and policy_codigo = 'respuesta_incidencia'),
        (select inicio from public.sla_evaluaciones
            where traslado_id = r_traslado.id and incidencia_id = r_inc.incidencia_id
              and policy_codigo = 'respuesta_incidencia'),
        jsonb_build_object('origen', 'incidencia_resuelta')
      );
      update public.sla_evaluaciones set estado = 'ok', porcentaje = 0,
        horas_transcurridas = 0, ultima_evaluacion_en = v_ahora
      where traslado_id = r_traslado.id and incidencia_id = r_inc.incidencia_id
        and policy_codigo = 'respuesta_incidencia';
      v_recuperados := v_recuperados + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'evaluados', v_evaluados,
    'warnings', v_warnings,
    'breaches', v_breaches,
    'recuperados', v_recuperados,
    'evaluado_en', v_ahora
  );
end;
$$;

-- 13.9 — cola de Torre: operar por excepción (breach primero, prioridad, deadline)
create or replace view public.sla_torre_cola
with (security_invoker = true) as
select
  e.traslado_id,
  e.policy_codigo,
  e.incidencia_id,
  e.estado,
  e.porcentaje,
  e.deadline,
  e.horas_transcurridas,
  e.horas_limite,
  coalesce(op.prioridad_base, emp.prioridad_base, g.prioridad_base, 60)
    + case e.estado when 'breach' then 50 when 'warning' then 20 else 0 end
    as prioridad_torre,
  coalesce(op.severidad, emp.severidad, g.severidad) as severidad,
  t.estado as estado_traslado,
  t.estado_operativo,
  t.operation_id as operacion_id,
  u.empresa_id as empresa_id,
  e.ultima_evaluacion_en
from public.sla_evaluaciones e
join public.traslados t on t.id = e.traslado_id
left join public.usuarios u on u.id = t.usuario_id
join public.sla_policies g on g.codigo = e.policy_codigo
left join public.sla_empresa_politicas emp
  on emp.empresa_id = u.empresa_id and emp.policy_codigo = e.policy_codigo
left join public.sla_operacion_politicas op
  on op.operacion_id = t.operation_id and op.policy_codigo = e.policy_codigo
where e.estado in ('warning','breach')
  and t.estado not in ('servicio_cerrado','servicio_cancelado','traslado_fallido');

create or replace function public.admin_sla_cola_torre(
  p_empresa_id uuid default null,
  p_operacion_id uuid default null,
  p_limite int default 100
)
returns setof public.sla_torre_cola
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_admin()
     and not (public.admin_tiene_permiso('viajes:leer') or public.admin_tiene_permiso('incidencias:leer')) then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 500 then
    raise exception using errcode='22023', message='LIMITE_INVALIDO';
  end if;

  return query
  select *
  from public.sla_torre_cola c
  where (p_empresa_id is null or c.empresa_id = p_empresa_id)
    and (p_operacion_id is null or c.operacion_id = p_operacion_id)
  order by
    case c.estado when 'breach' then 0 else 1 end,
    c.prioridad_torre desc,
    c.deadline asc
  limit p_limite;
end;
$$;

-- 13.10 — reportes históricos desde eventos inmutables
create or replace view public.sla_eventos_diario
with (security_invoker = true) as
select
  date_trunc('day', creado_en)::date as dia,
  policy_codigo,
  tipo_evento,
  empresa_id,
  operacion_id,
  count(*)::int as total
from public.sla_events
group by 1, 2, 3, 4, 5;

create or replace function public.admin_sla_reporte_historico(
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
  v_por_politica jsonb;
  v_totales jsonb;
begin
  if not (public.admin_tiene_permiso('viajes:leer') or public.admin_tiene_permiso('incidencias:leer')) then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception using errcode='22023', message='RANGO_INVALIDO';
  end if;

  select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) into v_por_politica
  from (
    select
      policy_codigo,
      count(*) filter (where tipo_evento = 'warning')::int as warnings,
      count(*) filter (where tipo_evento = 'breach')::int as breaches,
      count(*) filter (where tipo_evento = 'recuperado')::int as recuperados,
      count(distinct traslado_id)::int as traslados_afectados
    from public.sla_events
    where creado_en >= p_desde and creado_en <= p_hasta
      and (p_empresa_id is null or empresa_id = p_empresa_id)
      and (p_operacion_id is null or operacion_id = p_operacion_id)
    group by policy_codigo
    order by policy_codigo
  ) p;

  select jsonb_build_object(
    'warnings', count(*) filter (where tipo_evento = 'warning'),
    'breaches', count(*) filter (where tipo_evento = 'breach'),
    'recuperados', count(*) filter (where tipo_evento = 'recuperado'),
    'traslados_afectados', count(distinct traslado_id),
    'eventos', count(*)
  ) into v_totales
  from public.sla_events
  where creado_en >= p_desde and creado_en <= p_hasta
    and (p_empresa_id is null or empresa_id = p_empresa_id)
    and (p_operacion_id is null or operacion_id = p_operacion_id);

  return jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'empresa_id', p_empresa_id,
    'operacion_id', p_operacion_id,
    'por_politica', coalesce(v_por_politica, '[]'::jsonb),
    'totales', coalesce(v_totales, jsonb_build_object('warnings',0,'breaches',0,'recuperados',0,'traslados_afectados',0,'eventos',0)),
    'generado_en', now()
  );
end;
$$;

-- RLS: Torre total; partes ven lo de sus traslados
alter table public.sla_policies enable row level security;
alter table public.sla_empresa_politicas enable row level security;
alter table public.sla_operacion_politicas enable row level security;
alter table public.sla_evaluaciones enable row level security;
alter table public.sla_events enable row level security;

create policy "admin_acceso_total_sla_policies"
  on public.sla_policies for all using (public.es_admin());
create policy "autenticado_lee_sla_policies"
  on public.sla_policies for select to authenticated using (true);

create policy "admin_acceso_total_sla_empresa"
  on public.sla_empresa_politicas for all using (public.es_admin());
create policy "miembros_ven_sla_empresa"
  on public.sla_empresa_politicas for select
  using (empresa_id in (select public.mis_empresas_miembro()));

create policy "admin_acceso_total_sla_operacion"
  on public.sla_operacion_politicas for all using (public.es_admin());
create policy "partes_ven_sla_operacion"
  on public.sla_operacion_politicas for select
  using (
    operacion_id in (select id from public.operaciones where empresa_id in (select public.mis_empresas_miembro()))
    or exists (
      select 1 from public.traslados t
      left join public.conductores c on c.id = t.conductor_id
      left join public.usuarios u on u.id = t.usuario_id
      where t.operation_id = sla_operacion_politicas.operacion_id
        and (c.auth_user_id = auth.uid() or u.auth_user_id = auth.uid())
    )
  );

create policy "admin_acceso_total_sla_evaluaciones"
  on public.sla_evaluaciones for all using (public.es_admin());
create policy "partes_ven_sla_evaluaciones"
  on public.sla_evaluaciones for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      left join public.usuarios u on u.id = t.usuario_id
      left join public.conductores c on c.id = t.conductor_id
      where u.auth_user_id = auth.uid() or c.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_sla_events"
  on public.sla_events for all using (public.es_admin());
create policy "partes_ven_sla_events"
  on public.sla_events for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      left join public.usuarios u on u.id = t.usuario_id
      left join public.conductores c on c.id = t.conductor_id
      where u.auth_user_id = auth.uid() or c.auth_user_id = auth.uid()
    )
  );

grant select on public.sla_policies to authenticated;
grant select on public.sla_empresa_politicas to authenticated;
grant select on public.sla_operacion_politicas to authenticated;
grant select on public.sla_evaluaciones to authenticated;
grant select on public.sla_events to authenticated;
grant select on public.sla_torre_cola to authenticated;
grant select on public.sla_eventos_diario to authenticated;
grant all on public.sla_policies to service_role;
grant all on public.sla_empresa_politicas to service_role;
grant all on public.sla_operacion_politicas to service_role;
grant all on public.sla_evaluaciones to service_role;
grant all on public.sla_events to service_role;
grant execute on function public.sla_politica_efectiva(text, uuid, uuid) to authenticated;
grant execute on function public.sla_politica_efectiva(text, uuid, uuid) to service_role;
grant execute on function public.sla_evaluar_traslados(int) to authenticated;
grant execute on function public.sla_evaluar_traslados(int) to service_role;
grant execute on function public.admin_sla_cola_torre(uuid, uuid, int) to authenticated;
grant execute on function public.admin_sla_reporte_historico(timestamptz, timestamptz, uuid, uuid) to authenticated;

-- Autoverificación: catálogo completo y jerarquía coherente
do $$
declare
  v_policies int;
begin
  select count(*) into v_policies from public.sla_policies where activo;
  if v_policies <> 5 then
    raise exception 'Catálogo SLA incompleto: % (esperado 5)', v_policies;
  end if;
end $$;

do $$
declare
  v_limite numeric;
begin
  select horas_limite into v_limite
  from public.sla_politica_efectiva('asignacion', null, null);
  if v_limite <> 2 then
    raise exception 'Política efectiva global rota: asignacion %', v_limite;
  end if;
end $$;
