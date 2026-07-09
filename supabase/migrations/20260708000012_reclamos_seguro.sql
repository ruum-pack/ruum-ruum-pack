-- PRD §4.9 — Seguro de traslado. La nota del PRD es explícita: "las reglas
-- de cobertura, deducible y tiempos de resolución deben validarse con la
-- aseguradora y área legal antes de construirse como lógica de negocio
-- definitiva". Por eso esta tabla solo modela el flujo de estados del
-- reclamo (igual que rules/cobertura-seguro.ts), sin columnas de monto,
-- deducible o porcentaje de cobertura.
create type public.estado_reclamo_seguro as enum ('abierto', 'en_revision', 'resuelto');

create table public.reclamos_seguro (
  id            uuid primary key default gen_random_uuid(),
  traslado_id   uuid not null references public.traslados(id) on delete cascade,
  estado        public.estado_reclamo_seguro not null default 'abierto',
  abierto_en    timestamptz not null default now(),
  resuelto_en   timestamptz,
  -- PRD §4.9 — "el usuario solo ve el estatus, nunca montos de póliza ni
  -- datos internos de la aseguradora dentro de la app." Las notas internas
  -- de Admin se exponen únicamente vía la política de Admin más abajo.
  notas_admin   text
);

create index reclamos_seguro_traslado_idx on public.reclamos_seguro (traslado_id);

alter table public.reclamos_seguro enable row level security;

-- El usuario ve el estatus del reclamo (PRD §4.9), pero NO la columna
-- notas_admin: RLS filtra filas, no columnas, así que las apps de usuario
-- deben seleccionar explícitamente solo (id, traslado_id, estado,
-- abierto_en, resuelto_en) y nunca notas_admin.
create policy "usuario_ve_reclamos_de_sus_traslados"
  on public.reclamos_seguro for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_reclamos_seguro"
  on public.reclamos_seguro for all
  using (public.es_admin());
