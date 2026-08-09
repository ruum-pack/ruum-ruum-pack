-- Corregir políticas RLS de Supabase Storage para fotos-perfil-conductor
-- storage.foldername(name) sólo devuelve las carpetas antes del nombre del archivo (longitud 1)
-- El nombre del archivo se evalúa mediante storage.filename(name)

drop policy if exists "conductor_sube_su_foto_perfil" on storage.objects;
create policy "conductor_sube_su_foto_perfil"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-perfil-conductor'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and exists (
      select 1
      from public.conductores c
      where c.auth_user_id = auth.uid()
        and c.id::text = (storage.foldername(name))[1]
    )
    and lower(storage.filename(name)) in ('perfil.jpg', 'perfil.jpeg', 'perfil.png', 'perfil.webp')
  );

drop policy if exists "conductor_actualiza_su_foto_perfil" on storage.objects;
create policy "conductor_actualiza_su_foto_perfil"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fotos-perfil-conductor'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and exists (
      select 1
      from public.conductores c
      where c.auth_user_id = auth.uid()
        and c.id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'fotos-perfil-conductor'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and exists (
      select 1
      from public.conductores c
      where c.auth_user_id = auth.uid()
        and c.id::text = (storage.foldername(name))[1]
    )
    and lower(storage.filename(name)) in ('perfil.jpg', 'perfil.jpeg', 'perfil.png', 'perfil.webp')
  );
