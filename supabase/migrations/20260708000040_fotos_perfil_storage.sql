-- Fotos de perfil de usuarios.
insert into storage.buckets (id, name, public)
values ('fotos-perfil', 'fotos-perfil', true)
on conflict (id) do update set public = true;

drop policy if exists "usuario_sube_su_foto_perfil" on storage.objects;
create policy "usuario_sube_su_foto_perfil"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-perfil'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "usuario_actualiza_su_foto_perfil" on storage.objects;
create policy "usuario_actualiza_su_foto_perfil"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fotos-perfil'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'fotos-perfil'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "todos_ven_fotos_perfil" on storage.objects;
create policy "todos_ven_fotos_perfil"
  on storage.objects for select
  using (bucket_id = 'fotos-perfil');
