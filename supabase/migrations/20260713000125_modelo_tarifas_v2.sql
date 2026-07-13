-- RT-12 — Modelo de tarifas v2.
-- Reemplaza tarifas_admin (huérfana: nunca fue leída ni escrita por código
-- de aplicación) por tablas normalizadas que reflejan la fórmula acordada:
--
--   Base_categoria = BaseVehiculo(rango) x F_gama
--   Subtotal       = Base_categoria + (km x $/km_vehiculo) + (horas x tarifa_hora)
--   Factor_variable = MIN(F_condicion x F_horario x F_dia, tope_factor_variable)
--   Tarifa final    = Subtotal x Factor_variable
--
-- Regla de acceso (explícita a pedido de negocio): el admin, vía este
-- módulo, es la ÚNICA instancia que puede crear, modificar o actualizar
-- la configuración de la fórmula. Ni usuarios ni conductores tienen
-- select/insert/update/delete sobre estas tablas -- solo consumen el
-- resultado ya calculado a través de calcular_tarifa_traslado().

drop table if exists public.tarifas_admin;

create type public.categoria_tarifa_vehiculo as enum ('ligero_a', 'ligero_b', 'mediano', 'camion');
create type public.rango_distancia as enum ('rango_1', 'rango_2', 'rango_3', 'rango_4');
create type public.gama_vehiculo as enum ('entrada', 'media', 'alta', 'premium');
create type public.condicion_vehiculo as enum ('nueva', 'seminueva', 'rescate_mecanico');
create type public.horario_traslado as enum ('diurno', 'nocturno');
create type public.dia_traslado as enum ('entre_semana', 'fin_semana');
create type public.certificacion_conductor as enum ('estandar', 'tipo_b', 'federal', 'premium');

-- Base y $/km por categoría de vehículo y rango de distancia.
create table public.tarifas_vehiculo (
  id              uuid primary key default gen_random_uuid(),
  categoria       public.categoria_tarifa_vehiculo not null,
  rango           public.rango_distancia not null,
  base            numeric(10,2) not null check (base >= 0),
  por_km          numeric(10,2) not null check (por_km >= 0),
  actualizado_en  timestamptz not null default now(),
  actualizado_por_admin_id uuid references public.admins(id) on delete set null,
  unique (categoria, rango)
);

create table public.tarifas_gama (
  gama    public.gama_vehiculo primary key,
  factor  numeric(4,2) not null check (factor > 0),
  actualizado_en timestamptz not null default now(),
  actualizado_por_admin_id uuid references public.admins(id) on delete set null
);

create table public.tarifas_condicion (
  condicion public.condicion_vehiculo primary key,
  factor    numeric(4,2) not null check (factor > 0),
  actualizado_en timestamptz not null default now(),
  actualizado_por_admin_id uuid references public.admins(id) on delete set null
);

create table public.tarifas_horario (
  horario public.horario_traslado primary key,
  factor  numeric(4,2) not null check (factor > 0),
  actualizado_en timestamptz not null default now(),
  actualizado_por_admin_id uuid references public.admins(id) on delete set null
);

create table public.tarifas_dia (
  dia     public.dia_traslado primary key,
  factor  numeric(4,2) not null check (factor > 0),
  actualizado_en timestamptz not null default now(),
  actualizado_por_admin_id uuid references public.admins(id) on delete set null
);

-- Fila única de configuración global: tarifa por hora y tope del factor variable.
create table public.tarifas_config (
  id                      boolean primary key default true check (id),
  tarifa_hora             numeric(10,2) not null check (tarifa_hora >= 0),
  tope_factor_variable    numeric(4,2) not null check (tope_factor_variable >= 1),
  actualizado_en          timestamptz not null default now(),
  actualizado_por_admin_id uuid references public.admins(id) on delete set null
);

-- Certificación del chofer: no afecta el precio al usuario, solo el pago al conductor.
create table public.certificacion_pago_conductor (
  certificacion public.certificacion_conductor primary key,
  porcentaje    numeric(5,2) not null check (porcentaje between 0 and 100),
  actualizado_en timestamptz not null default now(),
  actualizado_por_admin_id uuid references public.admins(id) on delete set null
);

-- Semilla con los valores acordados en RT-12.
insert into public.tarifas_vehiculo (categoria, rango, base, por_km) values
  ('ligero_a', 'rango_1', 650, 7.00), ('ligero_a', 'rango_2', 700, 7.00), ('ligero_a', 'rango_3', 720, 7.00), ('ligero_a', 'rango_4', 750, 7.00),
  ('ligero_b', 'rango_1', 700, 7.50), ('ligero_b', 'rango_2', 750, 7.50), ('ligero_b', 'rango_3', 780, 7.50), ('ligero_b', 'rango_4', 820, 7.50),
  ('mediano',  'rango_1', 1100, 11.00), ('mediano', 'rango_2', 1800, 11.00), ('mediano', 'rango_3', 2600, 11.00), ('mediano', 'rango_4', 3800, 11.00),
  ('camion',   'rango_1', 1800, 16.00), ('camion',  'rango_2', 3200, 16.00), ('camion',  'rango_3', 4800, 16.00), ('camion',  'rango_4', 7200, 16.00);

insert into public.tarifas_gama (gama, factor) values
  ('entrada', 1.00), ('media', 1.15), ('alta', 1.40), ('premium', 1.80);

insert into public.tarifas_condicion (condicion, factor) values
  ('nueva', 1.10), ('seminueva', 1.00), ('rescate_mecanico', 1.25);

insert into public.tarifas_horario (horario, factor) values
  ('diurno', 1.00), ('nocturno', 1.15);

insert into public.tarifas_dia (dia, factor) values
  ('entre_semana', 1.00), ('fin_semana', 1.10);

insert into public.tarifas_config (id, tarifa_hora, tope_factor_variable) values (true, 21.50, 2.00);

insert into public.certificacion_pago_conductor (certificacion, porcentaje) values
  ('estandar', 40), ('tipo_b', 45), ('federal', 48), ('premium', 52);

-- Auditoría automática de "quién tocó qué" (además de actualizado_por_admin_id,
-- que la app debe llenar explícitamente al hacer el update).
create or replace function public.set_actualizado_en_tarifas()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end; $$;

create trigger tarifas_vehiculo_actualizado_en before update on public.tarifas_vehiculo for each row execute function public.set_actualizado_en_tarifas();
create trigger tarifas_gama_actualizado_en before update on public.tarifas_gama for each row execute function public.set_actualizado_en_tarifas();
create trigger tarifas_condicion_actualizado_en before update on public.tarifas_condicion for each row execute function public.set_actualizado_en_tarifas();
create trigger tarifas_horario_actualizado_en before update on public.tarifas_horario for each row execute function public.set_actualizado_en_tarifas();
create trigger tarifas_dia_actualizado_en before update on public.tarifas_dia for each row execute function public.set_actualizado_en_tarifas();
create trigger tarifas_config_actualizado_en before update on public.tarifas_config for each row execute function public.set_actualizado_en_tarifas();
create trigger certificacion_pago_actualizado_en before update on public.certificacion_pago_conductor for each row execute function public.set_actualizado_en_tarifas();

-- RLS: admin es la ÚNICA instancia con acceso. Sin política para usuario ni
-- conductor -- con RLS habilitado y sin policy, el acceso queda denegado por
-- defecto para cualquier rol que no sea admin o service_role.
alter table public.tarifas_vehiculo enable row level security;
alter table public.tarifas_gama enable row level security;
alter table public.tarifas_condicion enable row level security;
alter table public.tarifas_horario enable row level security;
alter table public.tarifas_dia enable row level security;
alter table public.tarifas_config enable row level security;
alter table public.certificacion_pago_conductor enable row level security;

create policy "admin_acceso_total_tarifas_vehiculo" on public.tarifas_vehiculo for all using (public.es_admin()) with check (public.es_admin());
create policy "admin_acceso_total_tarifas_gama" on public.tarifas_gama for all using (public.es_admin()) with check (public.es_admin());
create policy "admin_acceso_total_tarifas_condicion" on public.tarifas_condicion for all using (public.es_admin()) with check (public.es_admin());
create policy "admin_acceso_total_tarifas_horario" on public.tarifas_horario for all using (public.es_admin()) with check (public.es_admin());
create policy "admin_acceso_total_tarifas_dia" on public.tarifas_dia for all using (public.es_admin()) with check (public.es_admin());
create policy "admin_acceso_total_tarifas_config" on public.tarifas_config for all using (public.es_admin()) with check (public.es_admin());
create policy "admin_acceso_total_certificacion_pago" on public.certificacion_pago_conductor for all using (public.es_admin()) with check (public.es_admin());

-- Función de cálculo: security definer para poder leer las tablas de tarifas
-- (vedadas por RLS a usuario/conductor) sin exponerlas directamente. Devuelve
-- el precio calculado; admin_emite_cotizacion la puede usar como sugerencia
-- o como fuente directa del precio, según se decida en el flujo de admin.
create or replace function public.calcular_tarifa_traslado(
  p_categoria public.categoria_tarifa_vehiculo,
  p_rango public.rango_distancia,
  p_gama public.gama_vehiculo,
  p_condicion public.condicion_vehiculo,
  p_horario public.horario_traslado,
  p_dia public.dia_traslado,
  p_distancia_km numeric,
  p_tiempo_horas numeric
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_base numeric; v_por_km numeric; v_factor_gama numeric;
  v_factor_condicion numeric; v_factor_horario numeric; v_factor_dia numeric;
  v_tarifa_hora numeric; v_tope numeric;
  v_base_categoria numeric; v_subtotal numeric; v_factor_variable numeric;
begin
  if p_distancia_km is null or p_distancia_km < 0 then raise exception 'Distancia inválida'; end if;
  if p_tiempo_horas is null or p_tiempo_horas < 0 then raise exception 'Tiempo inválido'; end if;

  select base, por_km into v_base, v_por_km from public.tarifas_vehiculo where categoria = p_categoria and rango = p_rango;
  if v_base is null then raise exception 'No hay tarifa configurada para % / %', p_categoria, p_rango; end if;

  select factor into v_factor_gama from public.tarifas_gama where gama = p_gama;
  select factor into v_factor_condicion from public.tarifas_condicion where condicion = p_condicion;
  select factor into v_factor_horario from public.tarifas_horario where horario = p_horario;
  select factor into v_factor_dia from public.tarifas_dia where dia = p_dia;
  select tarifa_hora, tope_factor_variable into v_tarifa_hora, v_tope from public.tarifas_config where id = true;

  v_base_categoria := v_base * v_factor_gama;
  v_subtotal := v_base_categoria + (p_distancia_km * v_por_km) + (p_tiempo_horas * v_tarifa_hora);
  v_factor_variable := least(v_factor_condicion * v_factor_horario * v_factor_dia, v_tope);

  return round(v_subtotal * v_factor_variable, 2);
end; $$;

revoke all on function public.calcular_tarifa_traslado(
  public.categoria_tarifa_vehiculo, public.rango_distancia, public.gama_vehiculo,
  public.condicion_vehiculo, public.horario_traslado, public.dia_traslado, numeric, numeric
) from public;
grant execute on function public.calcular_tarifa_traslado(
  public.categoria_tarifa_vehiculo, public.rango_distancia, public.gama_vehiculo,
  public.condicion_vehiculo, public.horario_traslado, public.dia_traslado, numeric, numeric
) to authenticated;
