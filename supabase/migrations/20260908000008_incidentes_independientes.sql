-- FASE 11 — Incidencias, reclamos y disputas como familia independiente del
-- lifecycle operacional. Criterio de salida: reportar/resolver ya no exige
-- mover traslados.estado (antes solo era cierto por accidente para incidencias
-- y falso para disputas/reclamos, que saltaban el estado a la fuerza).
-- Compatibilidad: los saltos legacy se conservan tras opt-in p_mantener_estado.

-- 11.1 — catálogo: tipo_incidencia ya existe (11 valores, PRD §8).

-- 11.2/11.3/11.5/11.6/11.7 — la incidencia como entidad con vida propia
alter table public.incidencias
  add column severidad text not null default 'medium'
    constraint incidencias_severidad_check
    check (severidad in ('low', 'medium', 'high', 'critical')),
  add column estado text not null default 'abierta'
    constraint incidencias_estado_check
    check (estado in ('abierta', 'en_atencion', 'escalada', 'resuelta', 'cerrada')),
  add column responsable_admin_id uuid references public.admins(id) on delete set null,
  add column asignada_en timestamptz,
  add column nivel_escalamiento int not null default 0
    constraint incidencias_nivel_check check (nivel_escalamiento >= 0),
  add column escalada_en timestamptz,
  add column sla_horas int constraint incidencias_sla_check check (sla_horas is null or sla_horas > 0),
  add column sla_vence_en timestamptz;

create index incidencias_estado_idx on public.incidencias (estado);
create index incidencias_severidad_idx on public.incidencias (severidad);
create index incidencias_sla_vence_idx on public.incidencias (sla_vence_en)
  where resuelta = false;

-- SLA por severidad (horas): critical 4, high 24, medium 72, low 168.
create or replace function public.incidencia_sla_horas(p_severidad text)
returns int
language sql
immutable
set search_path = public, pg_temp
as $$ select case p_severidad when 'critical' then 4 when 'high' then 24 when 'low' then 168 else 72 end $$;

create or replace function public.incidencia_aplicar_sla()
returns trigger
language plpgsql
as $$
begin
  if new.sla_vence_en is null then
    new.sla_horas := coalesce(new.sla_horas, public.incidencia_sla_horas(new.severidad));
    new.sla_vence_en := coalesce(new.creada_en, now()) + make_interval(hours => new.sla_horas);
  end if;
  -- el cierre funcional arrastra la bandera legacy (una sola dirección;
  -- nadie escribe resuelta directo: auditaría muestra solo lecturas)
  if tg_op = 'UPDATE'
     and new.estado in ('resuelta', 'cerrada')
     and old.estado is distinct from new.estado then
    new.resuelta := true;
    new.resuelta_en := coalesce(new.resuelta_en, now());
  end if;
  return new;
end;
$$;

create trigger incidencias_aplicar_sla
  before insert or update of estado, severidad, sla_horas on public.incidencias
  for each row execute function public.incidencia_aplicar_sla();

-- 11.4 — evidencia enlazada (join auditable, patrón custodia)
create table public.incidencia_evidencia_fotos (
  incidencia_id uuid not null references public.incidencias(id) on delete cascade,
  foto_id       uuid not null references public.evidencia_fotos(id) on delete cascade,
  primary key (incidencia_id, foto_id)
);

-- 11.10 — historial de la incidencia
create table public.incidencia_historial (
  id              uuid primary key default gen_random_uuid(),
  incidencia_id   uuid not null references public.incidencias(id) on delete cascade,
  accion          text not null
    constraint incidencia_historial_accion_check
    check (accion in ('creada', 'asignada', 'severidad', 'escalada', 'resuelta', 'cerrada', 'reabierta')),
  estado_anterior text,
  estado_nuevo    text,
  actor           text not null default 'sistema'
    constraint incidencia_historial_actor_check
    check (actor in ('usuario', 'conductor', 'admin', 'sistema')),
  actor_id        uuid,
  motivo          text,
  creado_en       timestamptz not null default now()
);

create index incidencia_historial_incidencia_idx
  on public.incidencia_historial (incidencia_id, creado_en);

create or replace function public.registrar_historial_incidencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text;
begin
  if tg_op = 'INSERT' then
    insert into public.incidencia_historial (incidencia_id, accion, estado_nuevo, actor, actor_id, motivo)
    values (new.id, 'creada', new.estado, 'sistema', null, 'Registro inicial.');
    return new;
  end if;

  select case
    when public.es_admin() then 'admin'
    when exists (select 1 from public.conductores c join public.traslados t on t.conductor_id = c.id where t.id = new.traslado_id and c.auth_user_id = auth.uid()) then 'conductor'
    when exists (select 1 from public.usuarios u join public.traslados t on t.usuario_id = u.id where t.id = new.traslado_id and u.auth_user_id = auth.uid()) then 'usuario'
    else 'sistema'
  end into v_actor;

  if new.estado is distinct from old.estado then
    insert into public.incidencia_historial (incidencia_id, accion, estado_anterior, estado_nuevo, actor, actor_id, motivo)
    values (new.id,
      case new.estado when 'resuelta' then 'resuelta' when 'cerrada' then 'cerrada' when 'escalada' then 'escalada' else 'asignada' end,
      old.estado, new.estado, v_actor, auth.uid(),
      nullif(current_setting('ruum.motivo_incidencia', true), ''));
  elsif new.responsable_admin_id is distinct from old.responsable_admin_id then
    insert into public.incidencia_historial (incidencia_id, accion, estado_anterior, estado_nuevo, actor, actor_id, motivo)
    values (new.id, 'asignada', old.estado, new.estado, v_actor, auth.uid(),
      nullif(current_setting('ruum.motivo_incidencia', true), ''));
  elsif new.severidad is distinct from old.severidad then
    insert into public.incidencia_historial (incidencia_id, accion, estado_anterior, estado_nuevo, actor, actor_id, motivo)
    values (new.id, 'severidad', old.estado, new.estado, v_actor, auth.uid(),
      nullif(current_setting('ruum.motivo_incidencia', true), ''));
  end if;

  return new;
end;
$$;

-- backfill: todo lo existente nace abierto con SLA y fila inicial
-- (el trigger de historial se crea DESPUÉS para no duplicar estas filas)
update public.incidencias
set sla_horas = public.incidencia_sla_horas(severidad),
    sla_vence_en = creada_en + make_interval(hours => public.incidencia_sla_horas(severidad))
where sla_vence_en is null;

insert into public.incidencia_historial (incidencia_id, accion, estado_nuevo, actor, motivo, creado_en)
select id, 'creada', estado, 'sistema', 'Estado existente al formalizar incidentes (Fase 11).', creada_en
from public.incidencias
where not exists (select 1 from public.incidencia_historial h where h.incidencia_id = incidencias.id);

create trigger incidencias_registrar_historial
  after insert or update of estado, responsable_admin_id, severidad on public.incidencias
  for each row execute function public.registrar_historial_incidencia();

-- RLS espejo de incidencias
alter table public.incidencia_historial enable row level security;
alter table public.incidencia_evidencia_fotos enable row level security;

create policy "admin_acceso_total_incidencia_historial"
  on public.incidencia_historial for all using (public.es_admin());
create policy "partes_ven_historial_incidencia"
  on public.incidencia_historial for select
  using (
    incidencia_id in (
      select i.id from public.incidencias i
      join public.traslados t on t.id = i.traslado_id
      left join public.usuarios u on u.id = t.usuario_id
      left join public.conductores c on c.id = t.conductor_id
      where u.auth_user_id = auth.uid() or c.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_incidencia_evidencia"
  on public.incidencia_evidencia_fotos for all using (public.es_admin());
create policy "partes_ven_evidencia_incidencia"
  on public.incidencia_evidencia_fotos for select
  using (
    incidencia_id in (
      select i.id from public.incidencias i
      join public.traslados t on t.id = i.traslado_id
      left join public.usuarios u on u.id = t.usuario_id
      left join public.conductores c on c.id = t.conductor_id
      where u.auth_user_id = auth.uid() or c.auth_user_id = auth.uid()
    )
  );
create policy "partes_enlazan_evidencia_incidencia"
  on public.incidencia_evidencia_fotos for insert
  with check (
    incidencia_id in (
      select i.id from public.incidencias i
      join public.traslados t on t.id = i.traslado_id
      left join public.usuarios u on u.id = t.usuario_id
      left join public.conductores c on c.id = t.conductor_id
      where u.auth_user_id = auth.uid() or c.auth_user_id = auth.uid()
    )
    or public.es_admin()
  );

grant select on public.incidencia_historial to authenticated;
grant select, insert on public.incidencia_evidencia_fotos to authenticated;
grant all on public.incidencia_historial to service_role;
grant all on public.incidencia_evidencia_fotos to service_role;

-- 11.12 — notificar a Torre (bandeja admin; alerta_id queda null: no es SLA)
create or replace function public.notificar_torre_incidencia(
  p_incidencia_id uuid,
  p_accion text,
  p_detalle text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_severidad text;
  v_traslado uuid;
begin
  select severidad, traslado_id into v_severidad, v_traslado
  from public.incidencias where id = p_incidencia_id;

  insert into public.notificaciones_admin_operativas (
    alerta_id, canal, destinatario_rol, titulo, cuerpo
  ) values (
    null,
    'bandeja_admin',
    case when v_severidad = 'critical' then 'direccion' else 'supervisor' end,
    'Incidencia ' || p_accion || ' (' || coalesce(v_severidad, '?') || ')',
    coalesce(p_detalle, '') || ' [traslado ' || coalesce(v_traslado::text, '?') || ' incidencia ' || p_incidencia_id::text || ']'
  );
end;
$$;

-- Gestión Torre: resolver / asignar / escalar sin tocar traslados.estado.
create or replace function public.resolver_incidencia(
  p_incidencia_id uuid,
  p_motivo text default null,
  p_severidad text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inc record;
begin
  select * into v_inc from public.incidencias where id = p_incidencia_id for update;
  if v_inc.id is null then raise exception 'Incidencia no encontrada.'; end if;

  if not public.es_admin()
     and not exists (
       select 1 from public.traslados t
       left join public.conductores c on c.id = t.conductor_id
       left join public.usuarios u on u.id = t.usuario_id
       where t.id = v_inc.traslado_id
         and (c.auth_user_id = auth.uid() or u.auth_user_id = auth.uid())
     ) then
    raise exception 'Sin permiso para resolver esta incidencia.';
  end if;

  if v_inc.estado in ('resuelta', 'cerrada') then return; end if;

  perform set_config('ruum.motivo_incidencia', coalesce(p_motivo, 'Resuelta por Torre.'), true);

  update public.incidencias
  set estado = 'resuelta',
      severidad = coalesce(p_severidad, severidad)
  where id = p_incidencia_id;

  -- apaga el flag solo si no quedan abiertas (nunca se toca traslados.estado)
  update public.traslados
  set tiene_incidencia_abierta = false
  where id = v_inc.traslado_id
    and not exists (
      select 1 from public.incidencias
      where traslado_id = v_inc.traslado_id and resuelta = false and id <> p_incidencia_id
    );

  perform public.notificar_torre_incidencia(p_incidencia_id, 'resuelta', p_motivo);
end;
$$;

create or replace function public.asignar_incidencia(
  p_incidencia_id uuid,
  p_admin_id uuid,
  p_severidad text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inc record;
begin
  if not public.es_admin() then raise exception 'Solo Torre asigna incidencias.'; end if;

  select * into v_inc from public.incidencias where id = p_incidencia_id for update;
  if v_inc.id is null then raise exception 'Incidencia no encontrada.'; end if;
  if v_inc.estado in ('resuelta', 'cerrada') then
    raise exception 'La incidencia ya está cerrada.';
  end if;
  if not exists (select 1 from public.admins where id = p_admin_id) then
    raise exception 'Admin responsable no encontrado.';
  end if;
  if p_severidad is not null and p_severidad not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Severidad inválida.';
  end if;

  perform set_config('ruum.motivo_incidencia', 'Asignada por Torre.', true);

  update public.incidencias
  set responsable_admin_id = p_admin_id,
      asignada_en = now(),
      severidad = coalesce(p_severidad, severidad),
      estado = case when estado = 'abierta' then 'en_atencion'::text else estado end
  where id = p_incidencia_id;

  perform public.notificar_torre_incidencia(p_incidencia_id, 'asignada', 'Responsable asignado por Torre.');
end;
$$;

create or replace function public.escalar_incidencia(
  p_incidencia_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inc record;
begin
  if not public.es_admin() then raise exception 'Solo Torre escala incidencias.'; end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'El escalamiento requiere motivo.';
  end if;

  select * into v_inc from public.incidencias where id = p_incidencia_id for update;
  if v_inc.id is null then raise exception 'Incidencia no encontrada.'; end if;
  if v_inc.estado in ('resuelta', 'cerrada') then
    raise exception 'La incidencia ya está cerrada.';
  end if;

  perform set_config('ruum.motivo_incidencia', p_motivo, true);

  update public.incidencias
  set nivel_escalamiento = nivel_escalamiento + 1,
      escalada_en = now(),
      estado = 'escalada'
  where id = p_incidencia_id;

  perform public.notificar_torre_incidencia(p_incidencia_id, 'escalada', p_motivo);
end;
$$;

grant execute on function public.resolver_incidencia(uuid, text, text) to authenticated;
grant execute on function public.asignar_incidencia(uuid, uuid, text) to authenticated;
grant execute on function public.escalar_incidencia(uuid, text) to authenticated;

-- 11.8/11.9 — Claim y Dispute ya tienen máquina propia; aquí se desacoplan
-- del estado del traslado con opt-in (default conserva el salto legacy).
create or replace function public.abrir_disputa_traslado(
  p_traslado_id uuid,
  p_abierta_por public.abierta_por_actor,
  p_tipo public.tipo_disputa,
  p_descripcion text,
  p_mantener_estado boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_conductor_id uuid;
  v_traslado record;
  v_disputa_id uuid;
begin
  select id into v_usuario_id
  from public.usuarios
  where auth_user_id = auth.uid();

  select id into v_conductor_id
  from public.conductores
  where auth_user_id = auth.uid();

  select id, usuario_id, conductor_id, estado, actualizado_en
  into v_traslado
  from public.traslados
  where id = p_traslado_id
  for update;

  if v_traslado.id is null then
    raise exception 'Traslado no encontrado.';
  end if;

  if p_abierta_por = 'usuario' and (v_usuario_id is null or v_traslado.usuario_id <> v_usuario_id) then
    raise exception 'Solo el usuario del traslado puede abrir esta disputa.';
  end if;

  if p_abierta_por = 'conductor' and (v_conductor_id is null or v_traslado.conductor_id <> v_conductor_id) then
    raise exception 'Solo el conductor asignado puede abrir esta disputa.';
  end if;

  if extract(epoch from (now() - v_traslado.actualizado_en)) / 3600 > 72 then
    raise exception 'El plazo de 72 horas para abrir disputa ya venció.';
  end if;

  if length(trim(coalesce(p_descripcion, ''))) < 10 then
    raise exception 'La descripción de la disputa debe tener al menos 10 caracteres.';
  end if;

  insert into public.disputas (
    traslado_id,
    abierta_por,
    tipo,
    descripcion
  ) values (
    p_traslado_id,
    p_abierta_por,
    p_tipo,
    trim(p_descripcion)
  )
  returning id into v_disputa_id;

  if not coalesce(p_mantener_estado, false)
     and v_traslado.estado in ('servicio_cerrado', 'reclamo_resuelto', 'cierre_operativo_con_incidencia_abierta') then
    update public.traslados
    set estado = 'disputa_abierta'
    where id = p_traslado_id;
  end if;

  insert into public.registro_auditoria (
    traslado_id,
    evento,
    actor,
    actor_id,
    datos
  ) values (
    p_traslado_id,
    'apertura_disputa',
    p_abierta_por::text::public.actor_auditoria,
    coalesce(v_usuario_id, v_conductor_id),
    jsonb_build_object(
      'disputa_id', v_disputa_id,
      'tipo', p_tipo,
      'estado_anterior', v_traslado.estado,
      'estado_nuevo', case
        when not coalesce(p_mantener_estado, false)
             and v_traslado.estado in ('servicio_cerrado', 'reclamo_resuelto', 'cierre_operativo_con_incidencia_abierta')
          then 'disputa_abierta'
        else v_traslado.estado::text
      end,
      'estado_mantenido', coalesce(p_mantener_estado, false)
    )
  );

  return v_disputa_id;
end;
$$;

create or replace function public.admin_resuelve_disputa(
  p_disputa_id uuid,
  p_estado public.estado_disputa,
  p_resolucion public.resolucion_disputa,
  p_detalle text,
  p_mantener_estado boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_disputa record;
  v_es_resuelta boolean;
begin
  v_admin_id := public.admin_actual_id();
  if v_admin_id is null then
    raise exception 'No se encontró un admin autenticado.';
  end if;

  select * into v_disputa
  from public.disputas
  where id = p_disputa_id
  for update;

  if v_disputa.id is null then
    raise exception 'No se encontró la disputa.';
  end if;

  v_es_resuelta := p_estado in ('resuelta', 'resuelta_senior');
  if v_es_resuelta and p_resolucion is null then
    raise exception 'Selecciona una resolución para cerrar la disputa.';
  end if;

  update public.disputas
    set estado = p_estado,
        resolucion = case when v_es_resuelta then p_resolucion else null end,
        resolucion_detalle = nullif(btrim(coalesce(p_detalle, '')), ''),
        resuelta_en = case when v_es_resuelta then now() else null end
  where id = p_disputa_id;

  if v_es_resuelta
     and not coalesce(p_mantener_estado, false) then
    update public.traslados
    set estado = 'disputa_resuelta'
    where id = v_disputa.traslado_id
      and estado = 'disputa_abierta';
  end if;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    v_disputa.traslado_id,
    'resolucion_disputa',
    'admin',
    v_admin_id,
    jsonb_build_object(
      'disputa_id', p_disputa_id,
      'estado', p_estado,
      'resolucion', p_resolucion,
      'detalle', nullif(btrim(coalesce(p_detalle, '')), ''),
      'estado_mantenido', coalesce(p_mantener_estado, false)
    )
  );
end;
$$;

create or replace function public.admin_actualiza_reclamo_seguro(
  p_reclamo_id uuid,
  p_estado public.estado_reclamo_seguro,
  p_responsable_pago text,
  p_notas_admin text,
  p_mantener_estado boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_reclamo record;
begin
  v_admin_id := public.admin_actual_id();
  if v_admin_id is null then
    raise exception 'No se encontró un admin autenticado.';
  end if;

  if p_responsable_pago is not null and p_responsable_pago not in ('aplicacion', 'conductor') then
    raise exception 'Responsable de pago inválido.';
  end if;

  if p_estado = 'resuelto' and p_responsable_pago is null then
    raise exception 'Selecciona responsable de pago antes de resolver el reclamo.';
  end if;

  select * into v_reclamo
  from public.reclamos_seguro
  where id = p_reclamo_id
  for update;

  if v_reclamo.id is null then
    raise exception 'No se encontró el reclamo.';
  end if;

  update public.reclamos_seguro
    set estado = p_estado,
        responsable_pago = p_responsable_pago,
        notas_admin = nullif(btrim(coalesce(p_notas_admin, '')), ''),
        resuelto_en = case when p_estado = 'resuelto' then now() else null end
  where id = p_reclamo_id;

  if p_estado = 'resuelto'
     and not coalesce(p_mantener_estado, false) then
    update public.traslados
    set estado = 'reclamo_resuelto'
    where id = v_reclamo.traslado_id
      and estado = 'reclamo_abierto';
  end if;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    v_reclamo.traslado_id,
    case when p_estado = 'resuelto' then 'resolucion_reclamo_seguro' else 'apertura_reclamo_seguro' end,
    'admin',
    v_admin_id,
    jsonb_build_object(
      'reclamo_id', p_reclamo_id,
      'estado', p_estado,
      'responsable_pago', p_responsable_pago,
      'notas', nullif(btrim(coalesce(p_notas_admin, '')), ''),
      'estado_mantenido', coalesce(p_mantener_estado, false)
    )
  );
end;
$$;

-- Autoverificación: entidades pobladas y máquinas coherentes.
do $$
declare
  v_sin_sla int;
  v_sin_historial int;
begin
  select count(*) into v_sin_sla from public.incidencias where sla_vence_en is null;
  if v_sin_sla <> 0 then
    raise exception 'Incidencias sin SLA: %', v_sin_sla;
  end if;

  select count(*) into v_sin_historial
  from public.incidencias i
  where not exists (select 1 from public.incidencia_historial h where h.incidencia_id = i.id);
  if v_sin_historial <> 0 then
    raise exception 'Incidencias sin historial: %', v_sin_historial;
  end if;
end $$;
