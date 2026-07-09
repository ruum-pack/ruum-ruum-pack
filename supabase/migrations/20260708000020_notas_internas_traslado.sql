-- PRD §17.4, bloque 7 — "Notas internas: observaciones visibles solo para
-- el equipo de operación." No existía ninguna tabla para esto. Se modela
-- como tabla propia (no como columna de texto libre en traslados) porque
-- el PRD implica una bitácora de varias notas a lo largo del tiempo
-- ("agregar nota interna" como acción repetible en §17.4/§17.5/§17.6), no
-- un campo único que se sobrescribe.
create table public.notas_internas_traslado (
  id            uuid primary key default gen_random_uuid(),
  traslado_id   uuid not null references public.traslados(id) on delete cascade,
  admin_id      uuid not null references public.admins(id),
  contenido     text not null,
  creada_en     timestamptz not null default now()
);

create index notas_internas_traslado_idx on public.notas_internas_traslado (traslado_id, creada_en desc);

alter table public.notas_internas_traslado enable row level security;

-- Solo Admin — son notas internas, ni el usuario ni el conductor deben verlas.
create policy "admin_acceso_total_notas_internas"
  on public.notas_internas_traslado for all
  using (public.es_admin());
