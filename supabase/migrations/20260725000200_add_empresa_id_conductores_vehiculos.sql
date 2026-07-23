-- Agregar columna empresa_id a las tablas conductores y vehiculos
alter table public.conductores
  add column if not exists empresa_id uuid references public.empresas(id) on delete set null;

alter table public.vehiculos
  add column if not exists empresa_id uuid references public.empresas(id) on delete set null;

create index if not exists conductores_empresa_id_idx on public.conductores(empresa_id);
create index if not exists vehiculos_empresa_id_idx on public.vehiculos(empresa_id);
