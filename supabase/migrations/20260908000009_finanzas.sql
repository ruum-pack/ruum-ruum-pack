-- FASE 12 — Finanzas y pricing: separar precio cliente, costo conductor,
-- margen, cargos y conciliación por operación.
-- Revenue - Driver payout - Direct expenses - Processing fees = Contribution.
-- No se toca Stripe (webhook llena comision_mxn cuando exista); la tarifa
-- estimada usa tasa configurable hasta entonces.

-- 12.3/12.4 — versiones de política tarifaria (una por transacción que toque reglas)
create table public.tarifas_politica_versiones (
  id          bigint generated always as identity primary key,
  snapshot    jsonb not null,
  creada_por  uuid references public.admins(id) on delete set null,
  creada_en   timestamptz not null default now(),
  xact_id     bigint not null
);

create index tarifas_politica_versiones_fecha_idx
  on public.tarifas_politica_versiones (creada_en desc);

create or replace function public.registrar_version_politica()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid;
begin
  if exists (
    select 1 from public.tarifas_politica_versiones
    where xact_id = pg_current_xact_id()::text::bigint
  ) then
    return null;
  end if;

  select id into v_admin from public.admins where auth_user_id = auth.uid();

  insert into public.tarifas_politica_versiones (snapshot, creada_por, xact_id)
  values (
    jsonb_build_object(
      'config', (select row_to_json(c) from public.tarifas_config c where id = true),
      'vehiculo', (select coalesce(jsonb_agg(row_to_json(t) order by base desc), '[]'::jsonb) from public.tarifas_vehiculo t),
      'gama', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from public.tarifas_gama t),
      'condicion', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from public.tarifas_condicion t),
      'horario', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from public.tarifas_horario t),
      'dia', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from public.tarifas_dia t),
      'certificacion_pago', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from public.certificacion_pago_conductor t)
    ),
    v_admin,
    pg_current_xact_id()::text::bigint
  );
  return null;
end;
$$;

create trigger tarifas_vehiculo_versionar
  after insert or update or delete on public.tarifas_vehiculo
  for each statement execute function public.registrar_version_politica();
create trigger tarifas_gama_versionar
  after insert or update or delete on public.tarifas_gama
  for each row execute function public.registrar_version_politica();
create trigger tarifas_condicion_versionar
  after insert or update or delete on public.tarifas_condicion
  for each row execute function public.registrar_version_politica();
create trigger tarifas_horario_versionar
  after insert or update or delete on public.tarifas_horario
  for each row execute function public.registrar_version_politica();
create trigger tarifas_dia_versionar
  after insert or update or delete on public.tarifas_dia
  for each row execute function public.registrar_version_politica();
create trigger tarifas_config_versionar
  after update on public.tarifas_config
  for each row execute function public.registrar_version_politica();
create trigger certificacion_pago_versionar
  after insert or update or delete on public.certificacion_pago_conductor
  for each row execute function public.registrar_version_politica();

-- 12.5/12.6 — quote persistente: cada precio emitido queda congelado con sus reglas
create table public.cotizaciones (
  id                  uuid primary key default gen_random_uuid(),
  traslado_id         uuid not null references public.traslados(id) on delete cascade,
  version             int not null check (version > 0),
  precio              numeric(12,2) not null check (precio >= 0),
  moneda              text not null default 'MXN',
  reglas_snapshot     jsonb not null default '{}'::jsonb,
  politica_tarifa_version bigint references public.tarifas_politica_versiones(id) on delete set null,
  emitida_por_admin_id uuid references public.admins(id) on delete set null,
  emitida_en          timestamptz not null default now(),
  expira_en           timestamptz,
  aceptada_en         timestamptz,
  estado              text not null default 'emitida'
    constraint cotizaciones_estado_check
    check (estado in ('emitida', 'aceptada', 'vencida', 'reemplazada')),
  unique (traslado_id, version)
);

create index cotizaciones_traslado_idx on public.cotizaciones (traslado_id, version desc);

-- captura automática: todo cambio de precio congela su quote (cero cambios en RPCs)
create or replace function public.capturar_cotizacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version int;
  v_politica bigint;
  v_admin uuid;
begin
  if tg_op = 'UPDATE' and new.precio_cotizado is not distinct from old.precio_cotizado then
    -- solo marca aceptación sin re-emitir
    if new.estado = 'cotizacion_aceptada' and old.estado is distinct from new.estado then
      update public.cotizaciones
      set aceptada_en = coalesce(aceptada_en, now()), estado = 'aceptada'
      where traslado_id = new.id and estado = 'emitida';
    end if;
    return new;
  end if;

  -- precio nuevo (INSERT con precio) o cambiado: congela quote
  if new.precio_cotizado is null then
    return new;
  end if;

  select id into v_admin from public.admins where auth_user_id = auth.uid();
  select id into v_politica from public.tarifas_politica_versiones order by id desc limit 1;
  select coalesce(max(version), 0) + 1 into v_version
  from public.cotizaciones where traslado_id = new.id;

  update public.cotizaciones
  set estado = 'reemplazada'
  where traslado_id = new.id and estado = 'emitida';

  insert into public.cotizaciones (
    traslado_id, version, precio, moneda, reglas_snapshot, politica_tarifa_version,
    emitida_por_admin_id, expira_en, estado
  )
  select
    new.id, v_version, new.precio_cotizado, 'MXN',
    jsonb_build_object(
      'precio', new.precio_cotizado,
      'tipo_pago', new.tipo_pago,
      'distancia_km', new.distancia_km,
      'tiempo_estimado_horas', new.tiempo_estimado_horas,
      'vehiculo', jsonb_build_object('tipo', v.tipo, 'gama', v.gama, 'condicion', v.condicion),
      'politica_version', v_politica,
      'origen', 'trigger_captura'
    ),
    v_politica, v_admin, new.cotizacion_expira_en, 'emitida'
  from public.vehiculos v
  where v.id = new.vehiculo_id;

  return new;
end;
$$;

-- backfill: una quote v1 por traslado con precio (aceptada si ya avanzó).
-- OJO: el trigger de captura se crea DESPUÉS para no duplicar estas filas.
insert into public.cotizaciones (traslado_id, version, precio, reglas_snapshot, emitida_en, expira_en, aceptada_en, estado)
select
  t.id, 1, t.precio_cotizado,
  jsonb_build_object('precio', t.precio_cotizado, 'origen', 'backfill_fase12'),
  t.creado_en, t.cotizacion_expira_en,
  case when t.estado in ('cotizacion_aceptada', 'servicio_confirmado', 'pendiente_de_conductor', 'conductor_asignado', 'conductor_en_camino_al_origen', 'conductor_en_punto_de_recoleccion', 'verificacion_vehiculo_en_proceso', 'evidencia_inicial_en_proceso', 'evidencia_inicial_completada', 'vehiculo_recibido', 'traslado_en_curso', 'incidencia_reportada', 'llegada_a_destino', 'evidencia_final_en_proceso', 'evidencia_final_completada', 'entrega_confirmada', 'pago_pendiente', 'pago_completado', 'servicio_cerrado') then t.actualizado_en end,
  case when t.estado in ('cotizacion_aceptada', 'servicio_confirmado', 'pendiente_de_conductor', 'conductor_asignado', 'conductor_en_camino_al_origen', 'conductor_en_punto_de_recoleccion', 'verificacion_vehiculo_en_proceso', 'evidencia_inicial_en_proceso', 'evidencia_inicial_completada', 'vehiculo_recibido', 'traslado_en_curso', 'incidencia_reportada', 'llegada_a_destino', 'evidencia_final_en_proceso', 'evidencia_final_completada', 'entrega_confirmada', 'pago_pendiente', 'pago_completado', 'servicio_cerrado') then 'aceptada' else 'emitida' end
from public.traslados t
where t.precio_cotizado is not null;

create trigger traslados_capturar_cotizacion
  after insert or update of precio_cotizado, estado on public.traslados
  for each row execute function public.capturar_cotizacion();

-- 12.12 — comisión real por pago (el webhook la llenará; mientras tanto es 0)
alter table public.pagos
  add column comision_mxn numeric(10,2) constraint pagos_comision_check check (comision_mxn is null or comision_mxn >= 0);

-- 12.12/12.13 base — finanzas agregadas por operación
create or replace function public.admin_finanzas_operacion(p_operacion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_facturado numeric := 0;
  v_costo numeric := 0;
  v_gastos numeric := 0;
  v_comisiones numeric := 0;
  v_traslados int := 0;
  v_sin_pago uuid[] := '{}';
begin
  if not (public.admin_tiene_permiso('viajes:leer') and public.admin_tiene_permiso('pagos:leer')) then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  if not exists (select 1 from public.operaciones where id = p_operacion_id) then
    raise exception using errcode='22023', message='OPERACION_NO_ENCONTRADA';
  end if;

  select count(*) into v_traslados from public.traslados where operation_id = p_operacion_id;

  select coalesce(sum(p.monto) filter (where p.estado = 'completado'), 0)
    into v_facturado
  from public.pagos p
  join public.traslados t on t.id = p.traslado_id
  where t.operation_id = p_operacion_id;

  select coalesce(sum(t.ganancia_conductor_congelada), 0)
    into v_costo
  from public.traslados t
  where t.operation_id = p_operacion_id;

  select coalesce(sum(g.monto), 0)
    into v_gastos
  from public.gastos_traslado g
  join public.traslados t on t.id = g.traslado_id
  where t.operation_id = p_operacion_id;

  select coalesce(sum(p.comision_mxn), 0)
    into v_comisiones
  from public.pagos p
  join public.traslados t on t.id = p.traslado_id
  where t.operation_id = p_operacion_id;

  select coalesce(array_agg(t.id), '{}')
    into v_sin_pago
  from public.traslados t
  where t.operation_id = p_operacion_id
    and coalesce(t.precio_final, t.precio_cotizado, 0) > 0
    and not exists (
      select 1 from public.pagos p
      where p.traslado_id = t.id and p.estado = 'completado'
    );

  return jsonb_build_object(
    'operacion_id', p_operacion_id,
    'traslados', v_traslados,
    'facturado', v_facturado,
    'costo_conductor', v_costo,
    'gastos_directos', v_gastos,
    'comisiones', v_comisiones,
    'margen_contribucion', v_facturado - v_costo - v_gastos - v_comisiones,
    'traslados_sin_pago', v_sin_pago,
    'corte_en', now()
  );
end;
$$;

alter table public.cotizaciones enable row level security;
alter table public.tarifas_politica_versiones enable row level security;

create policy "admin_acceso_total_cotizaciones"
  on public.cotizaciones for all using (public.es_admin());
create policy "partes_ven_cotizaciones"
  on public.cotizaciones for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      left join public.usuarios u on u.id = t.usuario_id
      left join public.conductores c on c.id = t.conductor_id
      where u.auth_user_id = auth.uid() or c.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_politica_versiones"
  on public.tarifas_politica_versiones for all using (public.es_admin());

grant select on public.cotizaciones to authenticated;
grant select on public.tarifas_politica_versiones to authenticated;
grant all on public.cotizaciones to service_role;
grant all on public.tarifas_politica_versiones to service_role;
grant execute on function public.admin_finanzas_operacion(uuid) to authenticated;

-- Autoverificación: versionado y quotes coherentes.
do $$
declare
  v_antes int;
  v_despues int;
begin
  select count(*) into v_antes from public.tarifas_politica_versiones;
  update public.tarifas_config set tarifa_hora = tarifa_hora where id = true;
  select count(*) into v_despues from public.tarifas_politica_versiones;
  if v_despues <> v_antes + 1 then
    raise exception 'Versionado de política no registra (antes %, después %) hará', v_antes, v_despues;
  end if;
  delete from public.tarifas_politica_versiones where id = (select max(id) from public.tarifas_politica_versiones);
end $$;

do $$
declare
  v_huerfanas int;
begin
  select count(*) into v_huerfanas
  from public.cotizaciones q
  where not exists (select 1 from public.traslados t where t.id = q.traslado_id);
  if v_huerfanas <> 0 then
    raise exception 'Cotizaciones huérfanas: %', v_huerfanas;
  end if;
end $$;
