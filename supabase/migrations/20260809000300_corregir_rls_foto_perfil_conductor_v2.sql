-- Corrige el drift real detectado en storage.objects para 'fotos-perfil-conductor'.
--
-- La migración 20260809000100 (corregir_rls_foto_perfil_conductor) intentó
-- arreglar el bug, pero recreó policies BYTE-IDÉNTICAS a 20260716000101.
-- El problema real nunca estuvo en el archivo de migración: alguien había
-- parchado las policies EN VIVO directamente contra la base (fuera de
-- cualquier migración versionada), dejando una condición imposible de
-- cumplir:
--
--   coalesce(array_length(storage.foldername(name), 1), 0) = 2
--   and (storage.foldername(name))[2] in ('perfil.jpg', ...)
--
-- storage.foldername(name) NO incluye el nombre del archivo (eso lo
-- devuelve storage.filename(name)). Para el path real que sube la app,
-- '<conductor_id>/perfil.<ext>', foldername() devuelve un array de
-- longitud 1: {'<conductor_id>'}. La condición "= 2" nunca se cumplía,
-- así que TODA subida de foto de perfil era rechazada por RLS
-- ("Tu sesión no permite realizar esta acción").
--
-- Esta migración reaplica la lógica correcta (longitud 1 + storage.filename
-- para el nombre) y también repone la policy pública de lectura
-- "todos_ven_fotos_perfil_conductor" que la migración 20260809000100 dejó
-- de recrear.
--
-- Ya se aplicó este mismo cambio directamente contra la base
-- (proyecto rgvzrzjfyzdedowgokjl) el 2026-08-09 vía MCP; esta migración
-- documenta el fix en el repo para que un futuro `db push`/reset no
-- reintroduzca el estado roto.

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

drop policy if exists "todos_ven_fotos_perfil_conductor" on storage.objects;
create policy "todos_ven_fotos_perfil_conductor"
  on storage.objects for select
  using (bucket_id = 'fotos-perfil-conductor');
