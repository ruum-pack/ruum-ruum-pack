-- PRD §4.12 — Comunicación usuario-conductor, siempre dentro de la app o
-- enmascarada. Chat disponible desde asignación de conductor hasta 24h
-- después del cierre (esa ventana se valida en la capa de servicios, no aquí).
create type public.remitente_chat as enum ('usuario', 'conductor');

create table public.mensajes_chat (
  id            uuid primary key default gen_random_uuid(),
  traslado_id   uuid not null references public.traslados(id) on delete cascade,
  remitente     public.remitente_chat not null,
  contenido     text not null,
  enviado_en    timestamptz not null default now(),
  reportado     boolean not null default false
);

create index mensajes_chat_traslado_idx on public.mensajes_chat (traslado_id, enviado_en);

create table public.llamadas_enmascaradas (
  id                uuid primary key default gen_random_uuid(),
  traslado_id       uuid not null references public.traslados(id) on delete cascade,
  iniciada_por      public.remitente_chat not null,
  numero_virtual    text not null,
  duracion_segundos int,
  iniciada_en       timestamptz not null default now(),
  finalizada_en     timestamptz
);

create index llamadas_traslado_idx on public.llamadas_enmascaradas (traslado_id);

alter table public.mensajes_chat enable row level security;
alter table public.llamadas_enmascaradas enable row level security;

create policy "usuario_ve_y_envia_mensajes_de_sus_traslados"
  on public.mensajes_chat for all
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "conductor_ve_y_envia_mensajes_de_sus_traslados"
  on public.mensajes_chat for all
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_mensajes"
  on public.mensajes_chat for all
  using (public.es_admin());

create policy "usuario_ve_llamadas_de_sus_traslados"
  on public.llamadas_enmascaradas for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "conductor_ve_llamadas_de_sus_traslados"
  on public.llamadas_enmascaradas for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_llamadas"
  on public.llamadas_enmascaradas for all
  using (public.es_admin());
