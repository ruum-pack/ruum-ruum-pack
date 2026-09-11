-- FASE 3 — Remodelar ciclo de vida del traslado: un estado operativo único
-- derivado del legacy, sin romper apps/panel/reportes/notificaciones.
--
-- 3.1 — Matriz legacy (34) -> dominio destino + estado operativo.
-- Dominio: Transfer = ciclo del traslado; Assignment = conductor;
-- Billing = pago; Claim = reclamo; Dispute = disputa;
-- Documentation = verificación documental y cotización.
--
-- legacy                               dominio         operativo
-- usuario_pendiente_verificacion       Transfer        requested
-- usuario_verificado                   Transfer        requested
-- solicitud_creada                     Transfer        requested
-- documentacion_pendiente              Documentation   requested
-- documentacion_en_revision            Documentation   requested
-- documentacion_validada               Documentation   requested
-- cotizacion_generada                  Documentation   requested
-- cotizacion_aceptada                  Documentation   requested
-- servicio_confirmado                  Transfer        confirmed
-- pendiente_de_conductor               Assignment      planned
-- conductor_asignado                   Assignment      assigned
-- conductor_en_camino_al_origen        Assignment      assigned
-- conductor_en_punto_de_recoleccion    Assignment      assigned
-- verificacion_vehiculo_en_proceso     Transfer        pickup_in_progress
-- evidencia_inicial_en_proceso         Transfer        pickup_in_progress
-- evidencia_inicial_completada         Transfer        pickup_in_progress
-- vehiculo_recibido                    Transfer        vehicle_received
-- traslado_en_curso                    Transfer        in_transit
-- incidencia_reportada                 Transfer        in_transit
-- llegada_a_destino                    Transfer        delivery_in_progress
-- evidencia_final_en_proceso           Transfer        delivery_in_progress
-- evidencia_final_completada           Transfer        delivery_in_progress
-- entrega_confirmada                   Transfer        delivered
-- pago_pendiente                       Billing         closed
-- pago_completado                      Billing         closed
-- servicio_cerrado                     Transfer        closed
-- servicio_cancelado                   Transfer        cancelled
-- traslado_fallido                     Transfer        failed
-- dano_no_reportado_en_revision        Claim           closed
-- reclamo_abierto                      Claim           closed
-- reclamo_resuelto                     Claim           closed
-- cierre_operativo_con_incidencia_abierta Claim         closed
-- disputa_abierta                      Dispute         closed
-- disputa_resuelta                     Dispute         closed
--
-- 3.4 — la columna legacy `estado` sigue intacta y siendo la entrada de
-- escritura. `estado_operativo` se deriva por trigger (dual-write).

-- 3.2 — nuevo enum operativo (nombres del plan en minúsculas, convención repo)
create type public.estado_operativo_traslado as enum (
  'draft',
  'requested',
  'confirmed',
  'planned',
  'assigned',
  'pickup_in_progress',
  'vehicle_received',
  'in_transit',
  'delivery_in_progress',
  'delivered',
  'closed',
  'cancelled',
  'failed'
);

-- 3.5 — traducción legacy -> operativo (pura; espejo en
-- packages/shared/src/states/operativo-traslado.ts::LEGACY_A_OPERATIVO)
create or replace function public.traducir_estado_operativo(e public.estado_traslado)
returns public.estado_operativo_traslado
language plpgsql
immutable
as $$
begin
  case e
    when 'usuario_pendiente_verificacion',
         'usuario_verificado',
         'solicitud_creada',
         'documentacion_pendiente',
         'documentacion_en_revision',
         'documentacion_validada',
         'cotizacion_generada',
         'cotizacion_aceptada' then
      return 'requested';
    when 'servicio_confirmado' then
      return 'confirmed';
    when 'pendiente_de_conductor' then
      return 'planned';
    when 'conductor_asignado',
         'conductor_en_camino_al_origen',
         'conductor_en_punto_de_recoleccion' then
      return 'assigned';
    when 'verificacion_vehiculo_en_proceso',
         'evidencia_inicial_en_proceso',
         'evidencia_inicial_completada' then
      return 'pickup_in_progress';
    when 'vehiculo_recibido' then
      return 'vehicle_received';
    when 'traslado_en_curso',
         'incidencia_reportada' then
      return 'in_transit';
    when 'llegada_a_destino',
         'evidencia_final_en_proceso',
         'evidencia_final_completada' then
      return 'delivery_in_progress';
    when 'entrega_confirmada' then
      return 'delivered';
    when 'pago_pendiente',
         'pago_completado',
         'servicio_cerrado',
         'dano_no_reportado_en_revision',
         'reclamo_abierto',
         'reclamo_resuelto',
         'cierre_operativo_con_incidencia_abierta',
         'disputa_abierta',
         'disputa_resuelta' then
      return 'closed';
    when 'servicio_cancelado' then
      return 'cancelled';
    when 'traslado_fallido' then
      return 'failed';
    else
      raise exception 'Estado legacy sin traducción operativa: %', e;
  end case;
end;
$$;

-- 3.3 — columna operativa (3.4: legacy intacto)
alter table public.traslados
  add column estado_operativo public.estado_operativo_traslado not null default 'requested';

update public.traslados
set estado_operativo = public.traducir_estado_operativo(estado);

-- 3.6 — transiciones operativas válidas (mismo patrón que 0005)
create table public.estado_operativo_transiciones_validas (
  estado_actual     public.estado_operativo_traslado not null,
  estado_siguiente  public.estado_operativo_traslado not null,
  primary key (estado_actual, estado_siguiente)
);

insert into public.estado_operativo_transiciones_validas (estado_actual, estado_siguiente) values
  ('draft', 'requested'),
  ('draft', 'cancelled'),
  ('requested', 'confirmed'),
  ('requested', 'cancelled'),
  ('confirmed', 'planned'),
  ('confirmed', 'cancelled'),
  ('planned', 'assigned'),
  ('planned', 'cancelled'),
  ('assigned', 'pickup_in_progress'),
  ('assigned', 'in_transit'),
  ('assigned', 'failed'),
  ('assigned', 'cancelled'),
  ('pickup_in_progress', 'vehicle_received'),
  ('pickup_in_progress', 'failed'),
  ('pickup_in_progress', 'cancelled'),
  ('vehicle_received', 'in_transit'),
  ('vehicle_received', 'failed'),
  ('vehicle_received', 'cancelled'),
  ('in_transit', 'delivery_in_progress'),
  ('in_transit', 'failed'),
  ('in_transit', 'cancelled'),
  ('delivery_in_progress', 'delivered'),
  ('delivery_in_progress', 'failed'),
  ('delivery_in_progress', 'cancelled'),
  ('delivered', 'closed')
on conflict do nothing;

-- Sincroniza operativo desde legacy y valida el salto operativo resultante.
create or replace function public.sincronizar_estado_operativo()
returns trigger
language plpgsql
as $$
declare
  v_nuevo public.estado_operativo_traslado;
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    v_nuevo := public.traducir_estado_operativo(new.estado);
    if tg_op = 'UPDATE'
       and old.estado_operativo is distinct from v_nuevo
       and not exists (
         select 1 from public.estado_operativo_transiciones_validas
         where estado_actual = old.estado_operativo
           and estado_siguiente = v_nuevo
       ) then
      raise exception 'Transición operativa inválida: % -> %', old.estado_operativo, v_nuevo;
    end if;
    new.estado_operativo := v_nuevo;
  elsif new.estado_operativo is distinct from old.estado_operativo then
    -- escritura directa del operativo (uso futuro): solo se valida
    if not exists (
      select 1 from public.estado_operativo_transiciones_validas
      where estado_actual = old.estado_operativo
        and estado_siguiente = new.estado_operativo
    ) then
      raise exception 'Transición operativa inválida: % -> %', old.estado_operativo, new.estado_operativo;
    end if;
  end if;
  return new;
end;
$$;

-- El nombre ordena alfabéticamente DESPUÉS de traslados_validar_transicion
-- (0005): los saltos legacy inválidos siguen reportando el mensaje original.
create trigger traslados_validar_transicion_operativa
  before insert or update of estado, estado_operativo on public.traslados
  for each row execute function public.sincronizar_estado_operativo();

-- 3.7 — historial (plan: transfer_status_history =
-- traslado_id/from_status/to_status/actor_id/actor_type/reason/metadata/created_at)
create table public.historial_estados_traslado (
  id                  uuid primary key default gen_random_uuid(),
  traslado_id         uuid not null references public.traslados(id) on delete cascade,
  estado_anterior     public.estado_traslado not null,
  estado_nuevo        public.estado_traslado not null,
  operativo_anterior  public.estado_operativo_traslado not null,
  operativo_nuevo     public.estado_operativo_traslado not null,
  actor_id            uuid,
  actor_tipo          text not null default 'sistema'
    constraint historial_traslado_actor_tipo_check
    check (actor_tipo in ('admin', 'conductor', 'usuario', 'sistema')),
  motivo              text,
  metadata            jsonb not null default '{}'::jsonb,
  creado_en           timestamptz not null default now()
);

create index historial_traslado_traslado_fecha_idx
  on public.historial_estados_traslado (traslado_id, creado_en desc);

-- backfill: una fila por traslado existente (patrón 00111 registro_inicial)
insert into public.historial_estados_traslado (
  traslado_id, estado_anterior, estado_nuevo,
  operativo_anterior, operativo_nuevo,
  actor_id, actor_tipo, motivo, metadata, creado_en
)
select id, estado, estado,
  estado_operativo, estado_operativo,
  null, 'sistema', 'Estado existente al habilitar el historial.',
  '{}'::jsonb, actualizado_en
from public.traslados;

-- 3.8/3.9/3.10 — registra actor, timestamp y motivo (vía setting
-- ruum.motivo_transicion_traslado, patrón 00111)
create or replace function public.registrar_transicion_traslado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_tipo text;
  v_motivo text;
begin
  if new.estado is not distinct from old.estado
     and new.estado_operativo is not distinct from old.estado_operativo then
    return new;
  end if;

  select case
    when public.es_admin() then 'admin'
    when exists (select 1 from public.conductores where auth_user_id = auth.uid()) then 'conductor'
    when exists (select 1 from public.usuarios where auth_user_id = auth.uid()) then 'usuario'
    else 'sistema'
  end into v_actor_tipo;

  v_motivo := nullif(current_setting('ruum.motivo_transicion_traslado', true), '');

  insert into public.historial_estados_traslado (
    traslado_id, estado_anterior, estado_nuevo,
    operativo_anterior, operativo_nuevo,
    actor_id, actor_tipo, motivo
  ) values (
    new.id, old.estado, new.estado,
    old.estado_operativo, new.estado_operativo,
    auth.uid(), v_actor_tipo, v_motivo
  );

  return new;
end;
$$;

create trigger traslados_registrar_transicion
  after update of estado on public.traslados
  for each row execute function public.registrar_transicion_traslado();

alter table public.historial_estados_traslado enable row level security;

create policy "admin_acceso_total_historial_traslado"
  on public.historial_estados_traslado for all
  using (public.es_admin());

create policy "usuario_ve_historial_sus_traslados"
  on public.historial_estados_traslado for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "conductor_ve_historial_asignados"
  on public.historial_estados_traslado for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

grant select on public.historial_estados_traslado to authenticated;
grant select on public.estado_operativo_transiciones_validas to authenticated;
grant all on public.historial_estados_traslado to service_role;
grant all on public.estado_operativo_transiciones_validas to service_role;

-- Autoverificación: la traducción cubre todo el enum legacy...
do $$
declare
  r record;
begin
  for r in select enumlabel as estado from pg_enum
           where enumtypid = 'public.estado_traslado'::regtype loop
    perform public.traducir_estado_operativo(r.estado::public.estado_traslado);
  end loop;
end $$;

-- ...todo salto legacy permitido produce un salto operativo permitido...
do $$
declare
  r record;
  v_de public.estado_operativo_traslado;
  v_a public.estado_operativo_traslado;
begin
  for r in select estado_actual, estado_siguiente
           from public.estado_transiciones_validas loop
    v_de := public.traducir_estado_operativo(r.estado_actual);
    v_a := public.traducir_estado_operativo(r.estado_siguiente);
    if v_de is distinct from v_a
       and not exists (
         select 1 from public.estado_operativo_transiciones_validas
         where estado_actual = v_de and estado_siguiente = v_a
       ) then
      raise exception 'Salto operativo sin transición válida: % -> % (legacy % -> %)',
        v_de, v_a, r.estado_actual, r.estado_siguiente;
    end if;
  end loop;
end $$;

-- ...y todo operativo salvo draft es alcanzable por traducción.
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from unnest(enum_range(null::public.estado_operativo_traslado)) as e(estado)
  where e.estado <> 'draft'
    and not exists (
      select 1 from unnest(enum_range(null::public.estado_traslado)) as l(legacy)
      where public.traducir_estado_operativo(l.legacy) = e.estado
    );
  if v_count <> 0 then
    raise exception 'Hay % estados operativos inalcanzables por traducción', v_count;
  end if;
end $$;
