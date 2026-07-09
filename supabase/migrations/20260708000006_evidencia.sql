-- PRD §4.4 — Evidencia inicial y final, obligatoria, con ángulos mínimos.
create type public.tipo_evidencia as enum ('inicial', 'final');

create type public.angulo_evidencia as enum (
  'frente', 'lado_piloto', 'lado_copiloto', 'trasera', 'tablero', 'dano_previo', 'adicional'
);

create table public.evidencia_fotos (
  id            uuid primary key default gen_random_uuid(),
  traslado_id   uuid not null references public.traslados(id) on delete cascade,
  tipo          public.tipo_evidencia not null,
  angulo        public.angulo_evidencia not null,
  url           text,
  -- PRD §4.15 — modo offline: ruta local mientras no hay conexión para subir
  local_path    text,
  capturada_en  timestamptz not null default now(),
  lat           numeric(10,7),
  lng           numeric(10,7),
  sincronizada  boolean not null default false,
  constraint url_o_local_path check (url is not null or local_path is not null)
);

create index evidencia_fotos_traslado_idx on public.evidencia_fotos (traslado_id, tipo);

alter table public.evidencia_fotos enable row level security;

-- PRD §4.4 — "Usuario y torre de control pueden ver la evidencia en tiempo
-- real." / el conductor es quien la captura.
create policy "usuario_ve_evidencia_de_sus_traslados"
  on public.evidencia_fotos for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "conductor_administra_evidencia_de_sus_traslados"
  on public.evidencia_fotos for all
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_evidencia"
  on public.evidencia_fotos for all
  using (public.es_admin());
