-- Tarifas administrables para Torre de Control.
-- Mantiene la configuracion de precios en Supabase en vez de dejarla como
-- contenido estatico del panel.
create table public.tarifas_admin (
  id                         uuid primary key default gen_random_uuid(),
  nombre                     text not null,
  tipo_vehiculo              public.tipo_vehiculo not null,
  base                       numeric(10,2) not null check (base >= 0),
  por_km                     numeric(10,2) not null check (por_km >= 0),
  minima                     numeric(10,2) not null check (minima >= 0),
  pago_conductor_porcentaje  numeric(5,2) not null check (pago_conductor_porcentaje between 0 and 100),
  recargos_notas             text,
  activa                     boolean not null default true,
  creada_por_admin_id        uuid references public.admins(id) on delete set null,
  creado_en                  timestamptz not null default now(),
  actualizado_en             timestamptz not null default now()
);

create trigger tarifas_admin_actualizado_en
  before update on public.tarifas_admin
  for each row execute function public.set_actualizado_en();

alter table public.tarifas_admin enable row level security;

create policy "admin_acceso_total_tarifas"
  on public.tarifas_admin for all
  using (public.es_admin())
  with check (public.es_admin());
