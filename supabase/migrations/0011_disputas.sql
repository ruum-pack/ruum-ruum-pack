-- PRD §4.14 — Mecanismo de resolución de disputas.
create type public.tipo_disputa as enum (
  'cobro_incorrecto', 'cancelacion_fuera_de_politica', 'dano_no_reconocido', 'no_presentacion', 'calificacion_injusta'
);

create type public.estado_disputa as enum ('abierta', 'en_revision', 'resuelta', 'escalada', 'resuelta_senior');
create type public.resolucion_disputa as enum ('favor_reclamante', 'en_contra', 'solucion_parcial');
create type public.abierta_por_actor as enum ('usuario', 'conductor');

create table public.disputas (
  id            uuid primary key default gen_random_uuid(),
  traslado_id   uuid not null references public.traslados(id) on delete cascade,
  abierta_por   public.abierta_por_actor not null,
  tipo          public.tipo_disputa not null,
  estado        public.estado_disputa not null default 'abierta',
  resolucion    public.resolucion_disputa,
  -- PRD §4.14 — máx 72h post-cierre del traslado
  abierta_en    timestamptz not null default now(),
  -- PRD §4.14 — SLA 5 días hábiles (10 si escala)
  resuelta_en   timestamptz,
  -- PRD §4.14 — ventana de 48h para escalar tras la resolución
  escalada_en   timestamptz,
  constraint resolucion_solo_si_resuelta
    check (estado in ('resuelta', 'resuelta_senior') or resolucion is null)
);

create index disputas_traslado_idx on public.disputas (traslado_id);

alter table public.disputas enable row level security;

create policy "usuario_ve_y_abre_disputas_de_sus_traslados"
  on public.disputas for all
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "conductor_ve_y_abre_disputas_de_sus_traslados"
  on public.disputas for all
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_disputas"
  on public.disputas for all
  using (public.es_admin());
