alter table public.conductores
  add column if not exists foto_perfil_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-perfil-conductor',
  'fotos-perfil-conductor',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "conductor_sube_su_foto_perfil" on storage.objects;
create policy "conductor_sube_su_foto_perfil"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-perfil-conductor'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 2
    and exists (
      select 1
      from public.conductores c
      where c.auth_user_id = auth.uid()
        and c.id::text = (storage.foldername(name))[1]
    )
    and (storage.foldername(name))[2] in ('perfil.jpg', 'perfil.jpeg', 'perfil.png', 'perfil.webp')
  );

drop policy if exists "conductor_actualiza_su_foto_perfil" on storage.objects;
create policy "conductor_actualiza_su_foto_perfil"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fotos-perfil-conductor'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 2
    and exists (
      select 1
      from public.conductores c
      where c.auth_user_id = auth.uid()
        and c.id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'fotos-perfil-conductor'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 2
    and exists (
      select 1
      from public.conductores c
      where c.auth_user_id = auth.uid()
        and c.id::text = (storage.foldername(name))[1]
    )
    and (storage.foldername(name))[2] in ('perfil.jpg', 'perfil.jpeg', 'perfil.png', 'perfil.webp')
  );

drop policy if exists "todos_ven_fotos_perfil_conductor" on storage.objects;
create policy "todos_ven_fotos_perfil_conductor"
  on storage.objects for select
  using (bucket_id = 'fotos-perfil-conductor');
