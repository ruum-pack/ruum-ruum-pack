-- P0 — Sellos completos, historial versionado y registro transaccional.
alter table public.documentos_identidad_storage_validados
  add column id uuid not null default gen_random_uuid(),
  add column usuario_id uuid references public.usuarios(id) on delete cascade,
  add column tamano_bytes bigint,
  add column expira_en timestamptz not null default (now() + interval '10 minutes');

update public.documentos_identidad_storage_validados s
set usuario_id = u.id
from public.usuarios u
where u.auth_user_id = s.auth_user_id and s.usuario_id is null;

-- Sólo afecta sellos transitorios creados antes de esta migración.
delete from public.documentos_identidad_storage_validados
where usuario_id is null
  or tamano_bytes is null
  or tamano_bytes <= 0;
alter table public.documentos_identidad_storage_validados alter column usuario_id set not null;
alter table public.documentos_identidad_storage_validados alter column tamano_bytes set not null;
alter table public.documentos_identidad_storage_validados
  add constraint documentos_identidad_sello_id_unico unique (id),
  add constraint documentos_identidad_sello_tamano_valido check (tamano_bytes between 1 and 10485760),
  add constraint documentos_identidad_expiracion_valida check (expira_en > creado_en);

create table public.documentos_identidad_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  sello_id uuid not null unique references public.documentos_identidad_storage_validados(id) on delete restrict,
  ruta text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'application/pdf')),
  tamano_bytes bigint not null check (tamano_bytes between 1 and 10485760),
  version integer not null check (version > 0),
  estado text not null default 'en_revision' check (estado in ('en_revision', 'reemplazado')),
  es_actual boolean not null default true,
  documento_anterior_id uuid references public.documentos_identidad_usuario(id) on delete restrict,
  creado_en timestamptz not null default now(),
  reemplazado_en timestamptz,
  eliminado_storage_en timestamptz,
  error_eliminacion text,
  constraint documento_identidad_actual_coherente check (
    (es_actual and estado = 'en_revision' and reemplazado_en is null)
    or (not es_actual and estado = 'reemplazado' and reemplazado_en is not null)
  )
);
create unique index documento_identidad_actual_usuario_unico
  on public.documentos_identidad_usuario(usuario_id) where es_actual;
create index documento_identidad_limpieza_pendiente_idx
  on public.documentos_identidad_usuario(usuario_id, reemplazado_en)
  where not es_actual and eliminado_storage_en is null;
alter table public.documentos_identidad_usuario enable row level security;
revoke all on public.documentos_identidad_usuario from public, anon, authenticated;
grant select, update on public.documentos_identidad_usuario to service_role;

create policy "usuario_ve_historial_identidad"
  on public.documentos_identidad_usuario for select to authenticated
  using (usuario_id in (select u.id from public.usuarios u where u.auth_user_id = auth.uid()));
grant select on public.documentos_identidad_usuario to authenticated;

create or replace function public.ruta_identidad_validada_para_auth(p_ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documentos_identidad_storage_validados v
    join public.usuarios u on u.id = v.usuario_id
    where v.ruta = p_ruta and v.auth_user_id = auth.uid() and u.auth_user_id = auth.uid()
      and v.consumido_en is null and v.expira_en > now()
  );
$$;

drop policy if exists "usuario_sube_su_documento_identidad" on storage.objects;
drop policy if exists "usuario_ve_su_documento_identidad" on storage.objects;
create policy "usuario_sube_su_documento_identidad"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos-identidad'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|pdf)$'
    and public.ruta_identidad_validada_para_auth(name)
  );
create policy "usuario_ve_su_documento_identidad"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos-identidad'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|pdf)$'
  );

create or replace function public.registrar_documento_identidad(
  p_sello_id uuid,
  p_ruta text,
  p_sha256 text
) returns table (
  ruta text,
  estado text,
  subido_en timestamptz,
  ruta_anterior text,
  documento_id uuid,
  version integer
)
language plpgsql security definer set search_path = public, storage as $$
declare
  v_auth uuid := auth.uid();
  v_usuario public.usuarios;
  v_sello public.documentos_identidad_storage_validados;
  v_anterior public.documentos_identidad_usuario;
  v_nuevo_id uuid;
  v_version integer;
  v_subido_en timestamptz := now();
begin
  if v_auth is null then raise exception 'Inicia sesión para registrar tu documento de identidad.'; end if;
  select * into v_usuario from public.usuarios u where u.auth_user_id = v_auth for update;
  if v_usuario.id is null then raise exception 'No se encontró el perfil del usuario autenticado.'; end if;

  select * into v_sello from public.documentos_identidad_storage_validados s
  where s.id = p_sello_id for update;
  if v_sello.id is null then raise exception 'El sello de validación no existe.'; end if;
  if v_sello.auth_user_id <> v_auth or v_sello.usuario_id <> v_usuario.id then
    raise exception 'El sello no pertenece al usuario autenticado.';
  end if;
  if v_sello.consumido_en is not null then raise exception 'El sello de validación ya fue consumido.'; end if;
  if v_sello.expira_en <= now() then raise exception 'El sello de validación está vencido.'; end if;
  if v_sello.ruta <> p_ruta or v_sello.sha256 <> lower(p_sha256) then
    raise exception 'La ruta o el hash no coinciden con el sello validado.';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id = 'documentos-identidad' and o.name = p_ruta) then
    raise exception 'El archivo validado no existe en Storage.';
  end if;

  select * into v_anterior from public.documentos_identidad_usuario d
  where d.usuario_id = v_usuario.id and d.es_actual for update;
  v_version := coalesce(v_anterior.version, 0) + 1;
  if v_anterior.id is not null then
    update public.documentos_identidad_usuario set
      es_actual = false, estado = 'reemplazado', reemplazado_en = v_subido_en
    where id = v_anterior.id;
  end if;

  insert into public.documentos_identidad_usuario(
    usuario_id, sello_id, ruta, sha256, mime, tamano_bytes, version, documento_anterior_id, creado_en
  ) values (
    v_usuario.id, v_sello.id, v_sello.ruta, v_sello.sha256, v_sello.mime,
    v_sello.tamano_bytes, v_version, v_anterior.id, v_subido_en
  ) returning id into v_nuevo_id;

  update public.documentos_identidad_storage_validados set consumido_en = v_subido_en where id = v_sello.id;
  perform set_config('ruum.cambio_documento_identidad_autorizado', 'si', true);
  update public.usuarios set doc_identidad_url = p_ruta,
    doc_identidad_subido_en = v_subido_en, estado_verificacion = 'en_revision'
  where id = v_usuario.id;
  perform set_config('ruum.cambio_documento_identidad_autorizado', '', true);

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values ('carga_documento_identidad', 'usuario', v_usuario.id, jsonb_build_object(
    'documento_id', v_nuevo_id, 'fecha', v_subido_en, 'sha256', v_sello.sha256,
    'mime_detectado', v_sello.mime, 'tamano_bytes', v_sello.tamano_bytes,
    'version', v_version, 'estado', 'en_revision', 'origen', 'edge_function',
    'documento_anterior_id', v_anterior.id, 'ruta_anterior', v_anterior.ruta
  ));

  return query select p_ruta, 'en_revision'::text, v_subido_en, v_anterior.ruta, v_nuevo_id, v_version;
end;
$$;
revoke all on function public.registrar_documento_identidad(uuid, text, text) from public, anon;
grant execute on function public.registrar_documento_identidad(uuid, text, text) to authenticated;

-- La API pública anterior deja de ser invocable para impedir rutas sin id/hash de sello.
revoke all on function public.registrar_documento_identidad_usuario(text) from authenticated;
