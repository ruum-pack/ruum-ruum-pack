-- Auditoría H-4 — Bucket de evidencia sin aislamiento por dueño.
--
-- 0036 dejó el bucket `evidencia` con policies FOR (insert/update/select) que
-- solo comprueban `bucket_id = 'evidencia'`, sin filtrar por carpeta ni dueño.
-- Cualquier usuario autenticado puede leer o SOBREESCRIBIR los bytes de la
-- evidencia de traslados ajenos si conoce (o adivina) el path. El comentario
-- de 0036 dice que "la visibilidad sigue controlada por RLS en evidencia_fotos"
-- — pero eso protege la TABLA de metadatos, no los OBJETOS en Storage.
--
-- Los buckets `fotos-perfil` (0040) y `documentos-conductor` (0043) ya aíslan
-- por carpeta con (storage.foldername(name))[1] = auth.uid()::text. Esta
-- migración replica ese patrón en `evidencia`: el primer segmento del path debe
-- ser el auth.uid() del conductor que sube. El Admin conserva lectura total.
--
-- Convención de path resultante (a adoptar cuando se conecte el upload real de
-- bytes, hoy services/evidencia.ts::registrarAnguloCapturado usa una URL
-- placeholder): `<auth_user_id>/<traslado_id>/<tipo>/<angulo>.<ext>`.
--
-- Este bucket deja de ser público: las imágenes del Pasaporte Digital se sirven
-- con URLs firmadas (createSignedUrl) o vía la lectura autenticada de abajo, no
-- con URL pública directa. Si se requiere mantener URLs públicas legibles por
-- cualquiera, revertir el `public = false` — pero entonces el aislamiento solo
-- aplica a escritura, no a lectura.
update storage.buckets set public = false where id = 'evidencia';

drop policy if exists "conductores_suben_evidencia_storage" on storage.objects;
drop policy if exists "conductores_actualizan_evidencia_storage" on storage.objects;
drop policy if exists "usuarios_leen_evidencia_storage" on storage.objects;

-- El conductor solo sube a SU propia carpeta.
create policy "conductor_sube_su_evidencia_storage"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- El conductor solo actualiza objetos de SU propia carpeta.
create policy "conductor_actualiza_su_evidencia_storage"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura del conductor: su propia carpeta.
create policy "conductor_lee_su_evidencia_storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura del usuario dueño del traslado: el segundo segmento del path es el
-- traslado_id; se autoriza si ese traslado le pertenece. (PRD §4.4 — "Usuario
-- y Torre de Control pueden ver la evidencia en tiempo real".)
create policy "usuario_lee_evidencia_de_sus_traslados_storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidencia'
    and exists (
      select 1
      from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
        and t.id::text = (storage.foldername(name))[2]
    )
  );

-- Admin (Torre de Control): lectura total del bucket.
create policy "admin_lee_evidencia_storage"
  on storage.objects for select
  using (
    bucket_id = 'evidencia'
    and public.es_admin()
  );
