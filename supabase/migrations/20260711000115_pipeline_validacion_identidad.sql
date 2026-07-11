-- P0 — Sello de validación de un solo uso para documentos de identidad.
create table public.documentos_identidad_storage_validados (
  ruta text primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'application/pdf')),
  creado_en timestamptz not null default now(),
  consumido_en timestamptz
);
create index documentos_identidad_sellados_pendientes_idx
  on public.documentos_identidad_storage_validados(auth_user_id, creado_en)
  where consumido_en is null;
alter table public.documentos_identidad_storage_validados enable row level security;
revoke all on public.documentos_identidad_storage_validados from public, anon, authenticated;
grant select, insert, update, delete on public.documentos_identidad_storage_validados to service_role;

create or replace function public.ruta_identidad_validada_para_auth(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.documentos_identidad_storage_validados v
    where v.ruta = p_ruta
      and v.auth_user_id = auth.uid()
      and v.consumido_en is null
      and v.creado_en > now() - interval '10 minutes'
  );
$$;
revoke all on function public.ruta_identidad_validada_para_auth(text) from public, anon;
grant execute on function public.ruta_identidad_validada_para_auth(text) to authenticated;

drop policy if exists "usuario_sube_su_documento_identidad" on storage.objects;
drop policy if exists "usuario_ve_su_documento_identidad" on storage.objects;
drop policy if exists "usuario_actualiza_su_documento_identidad" on storage.objects;

create policy "usuario_sube_su_documento_identidad"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos-identidad'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.filename(name) ~* '^identidad-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|pdf)$'
    and public.ruta_identidad_validada_para_auth(name)
  );

create policy "usuario_ve_su_documento_identidad"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos-identidad'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.filename(name) ~* '^identidad-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|pdf)$'
  );

create or replace function public.registrar_documento_identidad_usuario(p_ruta text)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_auth uuid := auth.uid();
  v_usuario_id uuid;
  v_sello public.documentos_identidad_storage_validados;
begin
  if v_auth is null then
    raise exception 'Inicia sesión para registrar tu documento de identidad.';
  end if;
  if p_ruta !~* ('^' || v_auth::text || '/identidad-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|pdf)$') then
    raise exception 'La ruta del documento de identidad no está permitida.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'documentos-identidad' and o.name = p_ruta) then
    raise exception 'El archivo no existe en el bucket privado.';
  end if;

  update public.documentos_identidad_storage_validados set consumido_en = now()
  where ruta = p_ruta and auth_user_id = v_auth and consumido_en is null
    and creado_en > now() - interval '10 minutes'
    and ((mime = 'image/jpeg' and p_ruta ~* '\.jpe?g$')
      or (mime = 'image/png' and p_ruta ~* '\.png$')
      or (mime = 'application/pdf' and p_ruta ~* '\.pdf$'))
  returning * into v_sello;
  if v_sello.ruta is null then
    raise exception 'El archivo no cuenta con una validación de contenido vigente.';
  end if;

  perform set_config('ruum.cambio_documento_identidad_autorizado', 'si', true);
  update public.usuarios set
    doc_identidad_url = p_ruta,
    doc_identidad_subido_en = now(),
    estado_verificacion = 'en_revision'
  where auth_user_id = v_auth
  returning id into v_usuario_id;
  perform set_config('ruum.cambio_documento_identidad_autorizado', '', true);
  if v_usuario_id is null then raise exception 'No se encontró el perfil del usuario autenticado.'; end if;

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values ('carga_documento_identidad', 'usuario', v_usuario_id,
    jsonb_build_object('path', p_ruta, 'sha256', v_sello.sha256, 'mime', v_sello.mime));
end;
$$;

revoke all on function public.registrar_documento_identidad_usuario(text) from public, anon;
grant execute on function public.registrar_documento_identidad_usuario(text) to authenticated;

comment on table public.documentos_identidad_storage_validados is
  'Sellos temporales emitidos tras inspeccionar bytes y consumidos una sola vez por la RPC de identidad.';
