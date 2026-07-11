-- P0 — Los documentos de identidad sólo admiten archivos y rutas controladas,
-- y su registro en usuarios se realiza exclusivamente mediante RPC.

update storage.buckets set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf']::text[]
where id = 'documentos-identidad';

-- RLS sigue limitando cada operación a la fila propia; estos privilegios son
-- necesarios para que el perfil continúe siendo editable vía PostgREST.
grant select, update on public.usuarios to authenticated;

drop policy if exists "usuario_sube_su_documento_identidad" on storage.objects;
drop policy if exists "usuario_ve_su_documento_identidad" on storage.objects;
drop policy if exists "usuario_actualiza_su_documento_identidad" on storage.objects;

create policy "usuario_sube_su_documento_identidad"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos-identidad'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.filename(name) ~* '^identidad\.(jpe?g|png|pdf)$'
  );

create policy "usuario_ve_su_documento_identidad"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos-identidad'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.filename(name) ~* '^identidad\.(jpe?g|png|pdf)$'
  );

create policy "usuario_actualiza_su_documento_identidad"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documentos-identidad'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.filename(name) ~* '^identidad\.(jpe?g|png|pdf)$'
  )
  with check (
    bucket_id = 'documentos-identidad'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.filename(name) ~* '^identidad\.(jpe?g|png|pdf)$'
  );

create or replace function public.proteger_verificacion_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.es_admin() then
    return new;
  end if;

  if auth.uid() is null or auth.uid() is distinct from old.auth_user_id then
    return new;
  end if;

  if new.auth_user_id is distinct from old.auth_user_id
    or new.tipo_cuenta is distinct from old.tipo_cuenta
    or new.rol is distinct from old.rol
    or new.empresa_id is distinct from old.empresa_id
    or new.traslados_completados_sin_incidencia is distinct from old.traslados_completados_sin_incidencia
    or new.metodo_pago_registrado is distinct from old.metodo_pago_registrado
    or new.creado_en is distinct from old.creado_en then
    raise exception 'No puedes modificar campos administrativos de la cuenta.';
  end if;

  if coalesce(current_setting('ruum.cambio_documento_identidad_autorizado', true), '') <> 'si'
    and (
      new.doc_identidad_url is distinct from old.doc_identidad_url
      or new.doc_identidad_subido_en is distinct from old.doc_identidad_subido_en
      or new.estado_verificacion is distinct from old.estado_verificacion
    ) then
    raise exception 'Los campos de verificación sólo pueden modificarse mediante el flujo autorizado.';
  end if;

  return new;
end;
$$;

create or replace function public.registrar_documento_identidad_usuario(p_ruta text)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_auth uuid := auth.uid();
  v_usuario_id uuid;
begin
  if v_auth is null then
    raise exception 'Inicia sesión para registrar tu documento de identidad.';
  end if;

  if p_ruta !~* ('^' || v_auth::text || '/identidad\.(jpe?g|png|pdf)$') then
    raise exception 'La ruta del documento de identidad no está permitida.';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'documentos-identidad' and o.name = p_ruta
  ) then
    raise exception 'El archivo no existe en el bucket privado.';
  end if;

  perform set_config('ruum.cambio_documento_identidad_autorizado', 'si', true);
  update public.usuarios set
    doc_identidad_url = p_ruta,
    doc_identidad_subido_en = now(),
    estado_verificacion = 'en_revision'
  where auth_user_id = v_auth
  returning id into v_usuario_id;
  perform set_config('ruum.cambio_documento_identidad_autorizado', '', true);

  if v_usuario_id is null then
    raise exception 'No se encontró el perfil del usuario autenticado.';
  end if;

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values (
    'carga_documento_identidad', 'usuario', v_usuario_id,
    jsonb_build_object('path', p_ruta)
  );
end;
$$;

revoke all on function public.registrar_documento_identidad_usuario(text) from public, anon;
grant execute on function public.registrar_documento_identidad_usuario(text) to authenticated;

comment on function public.registrar_documento_identidad_usuario(text) is
  'Registra un objeto de identidad existente del propio auth.uid y mueve su expediente a en_revision.';
