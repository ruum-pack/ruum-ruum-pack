-- PRD §4.13 — Mecanismo de recuperación: un conductor con calificación menor
-- a 4.0 puede operar en modo de prueba supervisada. Admin asigna un número
-- limitado de traslados monitoreados (el número exacto no está fijado en el
-- PRD; lo decide Admin caso por caso — ver rules/modo-prueba-supervisada.ts).
-- Requerida para el exclusion constraint con igualdad sobre uuid más abajo
-- (GiST no soporta igualdad escalar nativamente sin esta extensión).
create extension if not exists btree_gist;

create table public.modo_prueba_supervisada (
  id                    uuid primary key default gen_random_uuid(),
  conductor_id          uuid not null references public.conductores(id) on delete cascade,
  traslados_asignados   int not null check (traslados_asignados > 0),
  traslados_completados int not null default 0,
  iniciado_en           timestamptz not null default now(),
  finalizado_en         timestamptz,
  -- Resultado final, una vez evaluado (ver rules/modo-prueba-supervisada.ts::evaluarResultadoModoPrueba)
  recuperado            boolean,
  constraint un_periodo_activo_por_conductor
    exclude using gist (conductor_id with =) where (finalizado_en is null)
);

create index modo_prueba_conductor_idx on public.modo_prueba_supervisada (conductor_id);

alter table public.modo_prueba_supervisada enable row level security;

create policy "conductor_ve_su_modo_prueba"
  on public.modo_prueba_supervisada for select
  using (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

create policy "admin_acceso_total_modo_prueba"
  on public.modo_prueba_supervisada for all
  using (public.es_admin());
