-- RT-12 — Bucket privado y ruta estricta:
-- auth_user_id/objetivo_id/tipo/documento.

update storage.buckets set
  public=false,
  file_size_limit=10485760,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf']::text[]
where id='documentos-conductor';

-- Sello de un solo uso: sólo el backend de validación puede crearlo. Impide
-- subir o registrar bytes que no hayan pasado primero la inspección real.
create table public.documentos_storage_validados (
  ruta text primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  objetivo_id uuid not null,
  tipo text not null check (tipo in ('licencia_frente','licencia_reverso','identificacion_oficial','documento_operativo')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  creado_en timestamptz not null default now(),
  consumido_en timestamptz
);
create index documentos_storage_validados_pendientes_idx
  on public.documentos_storage_validados(auth_user_id,creado_en)
  where consumido_en is null;
alter table public.documentos_storage_validados enable row level security;
revoke all on public.documentos_storage_validados from public,anon,authenticated;
grant select,insert,update,delete on public.documentos_storage_validados to service_role;

create or replace function public.ruta_documento_validada_para_auth(p_ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.documentos_storage_validados v
    where v.ruta=p_ruta and v.auth_user_id=auth.uid() and v.consumido_en is null
      and v.creado_en>now()-interval '10 minutes'
  );
$$;
revoke all on function public.ruta_documento_validada_para_auth(text) from public,anon;
grant execute on function public.ruta_documento_validada_para_auth(text) to authenticated;

create or replace function public.objetivo_documento_texto_pertenece_auth(p_objetivo text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_objetivo uuid;
begin
  if auth.uid() is null or p_objetivo !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_objetivo:=p_objetivo::uuid;
  return public.objetivo_documento_pertenece_auth(v_objetivo,auth.uid());
end;
$$;
revoke all on function public.objetivo_documento_texto_pertenece_auth(text) from public, anon;
grant execute on function public.objetivo_documento_texto_pertenece_auth(text) to authenticated;

drop policy if exists "conductor_sube_sus_documentos_storage" on storage.objects;
drop policy if exists "conductor_ruta_controlada_documentos_storage" on storage.objects;
create policy "conductor_ruta_controlada_documentos_storage"
  on storage.objects for insert to authenticated
  with check (
    bucket_id='documentos-conductor'
    and coalesce(array_length(storage.foldername(name),1),0)=3
    and (storage.foldername(name))[1]=auth.uid()::text
    and public.objetivo_documento_texto_pertenece_auth((storage.foldername(name))[2])
    and (storage.foldername(name))[3] in (
      'licencia_frente','licencia_reverso','identificacion_oficial','documento_operativo'
    )
    and storage.filename(name) ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,179}$'
    and public.ruta_documento_validada_para_auth(name)
  );

-- La lectura conserva el primer segmento como frontera de propiedad. El
-- bucket permanece privado y la Torre de Control mantiene su policy separada.
drop policy if exists "conductor_lee_sus_documentos_storage" on storage.objects;
create policy "conductor_lee_sus_documentos_storage"
  on storage.objects for select to authenticated
  using (
    bucket_id='documentos-conductor'
    and coalesce(array_length(storage.foldername(name),1),0)=3
    and (storage.foldername(name))[1]=auth.uid()::text
    and public.objetivo_documento_texto_pertenece_auth((storage.foldername(name))[2])
  );

-- Endurece la validación usada por ambas RPC: además de propiedad, forma y
-- existencia en Storage, consume el sello emitido por la Edge Function.
create or replace function public.validar_ruta_documento_conductor(
  p_objetivo_id uuid,
  p_tipo text,
  p_ruta text,
  p_auth_user_id uuid default auth.uid()
) returns void
language plpgsql security definer set search_path = public, storage as $$
declare v_partes text[]:=string_to_array(p_ruta,'/'); v_autorizada text;
begin
  if p_auth_user_id is null then raise exception 'Inicia sesión para registrar documentos.'; end if;
  if p_tipo not in ('licencia_frente','licencia_reverso','identificacion_oficial','documento_operativo') then
    raise exception 'Tipo documental no permitido.';
  end if;
  if coalesce(array_length(v_partes,1),0)<>4 or v_partes[1]<>p_auth_user_id::text
    or v_partes[2]<>p_objetivo_id::text or v_partes[3]<>p_tipo
    or v_partes[4] !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,179}$' then
    raise exception 'La ruta documental no cumple auth_user_id/expediente/tipo/documento.';
  end if;
  if not public.objetivo_documento_pertenece_auth(p_objetivo_id,p_auth_user_id) then
    raise exception 'No puedes registrar documentos en un expediente ajeno.';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='documentos-conductor' and o.name=p_ruta) then
    raise exception 'El archivo no existe en el bucket privado.';
  end if;
  update public.documentos_storage_validados set consumido_en=now()
  where ruta=p_ruta and auth_user_id=p_auth_user_id and objetivo_id=p_objetivo_id and tipo=p_tipo
    and consumido_en is null and creado_en>now()-interval '10 minutes'
  returning ruta into v_autorizada;
  if v_autorizada is null then
    raise exception 'El archivo no cuenta con una validación de contenido vigente.';
  end if;
end;
$$;
revoke all on function public.validar_ruta_documento_conductor(uuid,text,text,uuid) from public,anon,authenticated;

comment on function public.objetivo_documento_texto_pertenece_auth(text) is
  'Valida sin casts inseguros que el segundo segmento sea un conductor o solicitud de auth.uid().';
comment on table public.documentos_storage_validados is
  'Sellos de contenido emitidos por la Edge Function y consumidos una sola vez por las RPC documentales.';
