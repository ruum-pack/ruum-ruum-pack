-- Configuracion editable del conductor: preferencias y expediente documental.
-- Antes la app mostraba estos bloques con contenido estatico; estas tablas
-- permiten persistirlos con RLS del conductor autenticado.

create table public.preferencias_conductor (
  conductor_id              uuid primary key references public.conductores(id) on delete cascade,
  notificaciones_push       boolean not null default true,
  modo_no_molestar          boolean not null default false,
  alertas_viaje             boolean not null default true,
  alertas_pago              boolean not null default true,
  alertas_documentos        boolean not null default true,
  alertas_admin             boolean not null default false,
  viajes_locales            boolean not null default true,
  viajes_foraneos           boolean not null default true,
  viajes_nocturnos          boolean not null default false,
  viajes_empresariales      boolean not null default true,
  viajes_personales         boolean not null default true,
  actualizado_en            timestamptz not null default now()
);

create trigger preferencias_conductor_actualizado_en
  before update on public.preferencias_conductor
  for each row execute function public.set_actualizado_en();

alter table public.preferencias_conductor enable row level security;

create policy "conductor_administra_sus_preferencias"
  on public.preferencias_conductor for all
  using (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()))
  with check (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

create policy "admin_acceso_total_preferencias_conductor"
  on public.preferencias_conductor for all
  using (public.es_admin())
  with check (public.es_admin());

create table public.documentos_conductor (
  id                 uuid primary key default gen_random_uuid(),
  conductor_id       uuid not null references public.conductores(id) on delete cascade,
  tipo               text not null,
  nombre_archivo     text not null,
  url                text not null,
  estado             text not null default 'en_revision'
                     check (estado in ('pendiente', 'en_revision', 'aprobado', 'rechazado', 'vencido', 'actualizacion')),
  notas_admin        text,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

create index documentos_conductor_idx on public.documentos_conductor (conductor_id, creado_en desc);

create trigger documentos_conductor_actualizado_en
  before update on public.documentos_conductor
  for each row execute function public.set_actualizado_en();

alter table public.documentos_conductor enable row level security;

create policy "conductor_administra_sus_documentos"
  on public.documentos_conductor for all
  using (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()))
  with check (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

create policy "admin_acceso_total_documentos_conductor"
  on public.documentos_conductor for all
  using (public.es_admin())
  with check (public.es_admin());

insert into storage.buckets (id, name, public)
values ('documentos-conductor', 'documentos-conductor', false)
on conflict (id) do update set public = false;

create policy "conductor_sube_sus_documentos_storage"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documentos-conductor'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "conductor_lee_sus_documentos_storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documentos-conductor'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admin_lee_documentos_conductor_storage"
  on storage.objects for select
  using (
    bucket_id = 'documentos-conductor'
    and public.es_admin()
  );
