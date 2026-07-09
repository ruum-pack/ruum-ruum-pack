-- Fase 6 — Storage para evidencia offline.
-- Bucket público para que el Pasaporte Digital pueda renderizar imágenes con
-- URL directa. La visibilidad de qué URLs existen sigue controlada por RLS en
-- public.evidencia_fotos.

insert into storage.buckets (id, name, public)
values ('evidencia', 'evidencia', true)
on conflict (id) do update set public = excluded.public;

create policy "conductores_suben_evidencia_storage"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'evidencia');

create policy "conductores_actualizan_evidencia_storage"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'evidencia')
  with check (bucket_id = 'evidencia');

create policy "usuarios_leen_evidencia_storage"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'evidencia');
