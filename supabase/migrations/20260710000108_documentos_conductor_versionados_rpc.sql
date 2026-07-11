-- RT-13 / RT-14 / RT-15 — Registro documental exclusivamente por RPC,
-- versionado inmutable y reemplazo transaccional.

alter table public.documentos_conductor
  add column version integer not null default 1 check (version > 0),
  add column documento_anterior_id uuid references public.documentos_conductor(id) on delete restrict,
  add column es_actual boolean not null default true,
  add column reemplazado_en timestamptz,
  add column revisado_por uuid references public.admins(id) on delete set null,
  add column revisado_en timestamptz,
  add column motivo_rechazo text;

-- Convierte el historial preexistente en una cadena ordenada y conserva una
-- sola versión vigente por expediente/tipo.
with ordenados as (
  select id,
    row_number() over (
      partition by conductor_id, solicitud_id, tipo
      order by creado_en, id
    )::integer as numero,
    lag(id) over (
      partition by conductor_id, solicitud_id, tipo
      order by creado_en, id
    ) as anterior,
    count(*) over (partition by conductor_id, solicitud_id, tipo) as total
  from public.documentos_conductor
)
update public.documentos_conductor d set
  version = o.numero,
  documento_anterior_id = o.anterior,
  es_actual = o.numero = o.total,
  reemplazado_en = case when o.numero < o.total then coalesce(d.actualizado_en, now()) else null end
from ordenados o where o.id = d.id;

select set_config('ruum.cambio_documento_autorizado', 'si', true);
update public.documentos_conductor
set estado = 'reemplazado', actualizado_en = now()
where not es_actual and estado <> 'reemplazado';
select set_config('ruum.cambio_documento_autorizado', '', true);

-- Una base heredada anómala podría tener como último registro uno ya marcado
-- reemplazado. Lo recuperamos como versión vigente revisable sin editar la
-- migración histórica que originó esos datos.
alter table public.documentos_conductor disable trigger validar_transicion_documento_conductor;
update public.documentos_conductor set estado='en_revision', actualizado_en=now()
where es_actual and estado='reemplazado';
alter table public.documentos_conductor enable trigger validar_transicion_documento_conductor;

alter table public.documentos_conductor
  add constraint documento_conductor_reemplazo_coherente check (
    (es_actual and reemplazado_en is null and estado <> 'reemplazado')
    or (not es_actual and reemplazado_en is not null and estado = 'reemplazado')
  ),
  add constraint documento_conductor_revision_coherente check (
    (revisado_por is null and revisado_en is null)
    or (revisado_por is not null and revisado_en is not null)
  ),
  add constraint documento_conductor_motivo_rechazo_coherente check (
    estado in ('rechazado','reemplazado') or motivo_rechazo is null
  );

create unique index documentos_conductor_actual_tipo_unico
  on public.documentos_conductor (conductor_id, tipo)
  where conductor_id is not null and es_actual;
create unique index documentos_solicitud_actual_tipo_unico
  on public.documentos_conductor (solicitud_id, tipo)
  where solicitud_id is not null and es_actual;
create index documentos_conductor_anterior_idx
  on public.documentos_conductor (documento_anterior_id)
  where documento_anterior_id is not null;

drop policy if exists "solicitante_o_conductor_registra_documentos" on public.documentos_conductor;
drop policy if exists "conductor_inserta_documento_en_revision" on public.documentos_conductor;
revoke insert on public.documentos_conductor from authenticated;

create or replace function public.objetivo_documento_pertenece_auth(
  p_objetivo_id uuid,
  p_auth_user_id uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = public as $$
  select p_auth_user_id is not null and (
    exists(select 1 from public.conductores c where c.id=p_objetivo_id and c.auth_user_id=p_auth_user_id)
    or exists(select 1 from public.solicitudes_conductor s where s.id=p_objetivo_id and s.auth_user_id=p_auth_user_id)
  );
$$;
revoke all on function public.objetivo_documento_pertenece_auth(uuid, uuid) from public, anon;
grant execute on function public.objetivo_documento_pertenece_auth(uuid, uuid) to authenticated;

create or replace function public.validar_ruta_documento_conductor(
  p_objetivo_id uuid,
  p_tipo text,
  p_ruta text,
  p_auth_user_id uuid default auth.uid()
) returns void
language plpgsql stable security definer set search_path = public, storage as $$
declare v_partes text[]:=string_to_array(p_ruta, '/');
begin
  if p_auth_user_id is null then raise exception 'Inicia sesión para registrar documentos.'; end if;
  if p_tipo not in ('licencia_frente','licencia_reverso','identificacion_oficial','documento_operativo') then
    raise exception 'Tipo documental no permitido.';
  end if;
  if coalesce(array_length(v_partes,1),0)<>4
    or v_partes[1]<>p_auth_user_id::text
    or v_partes[2]<>p_objetivo_id::text
    or v_partes[3]<>p_tipo
    or v_partes[4] !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,179}$' then
    raise exception 'La ruta documental no cumple auth_user_id/expediente/tipo/documento.';
  end if;
  if not public.objetivo_documento_pertenece_auth(p_objetivo_id,p_auth_user_id) then
    raise exception 'No puedes registrar documentos en un expediente ajeno.';
  end if;
  if not exists(
    select 1 from storage.objects o
    where o.bucket_id='documentos-conductor' and o.name=p_ruta
  ) then raise exception 'El archivo no existe en el bucket privado.'; end if;
end;
$$;
revoke all on function public.validar_ruta_documento_conductor(uuid, text, text, uuid) from public, anon, authenticated;

create or replace function public.registrar_documento_conductor(
  p_objetivo_id uuid,
  p_tipo text,
  p_nombre_archivo text,
  p_ruta text
) returns uuid
language plpgsql security definer set search_path = public, storage as $$
declare
  v_auth uuid:=auth.uid(); v_id uuid; v_conductor_id uuid; v_solicitud_id uuid;
begin
  if v_auth is null then raise exception 'Inicia sesión para registrar documentos.'; end if;
  perform pg_advisory_xact_lock(hashtext('documento:'||p_objetivo_id::text||':'||p_tipo));
  perform public.validar_ruta_documento_conductor(p_objetivo_id,p_tipo,p_ruta,v_auth);
  if p_nombre_archivo is null or p_nombre_archivo !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,179}$' then
    raise exception 'El nombre del archivo no está sanitizado.';
  end if;
  select id into v_conductor_id from public.conductores where id=p_objetivo_id and auth_user_id=v_auth;
  if v_conductor_id is null then
    select id into v_solicitud_id from public.solicitudes_conductor where id=p_objetivo_id and auth_user_id=v_auth;
  end if;
  if v_conductor_id is null and v_solicitud_id is null then raise exception 'Expediente no encontrado.'; end if;
  if exists(select 1 from public.documentos_conductor d where d.tipo=p_tipo and d.es_actual
    and (d.conductor_id=v_conductor_id or d.solicitud_id=v_solicitud_id)) then
    raise exception 'Ya existe una versión vigente; usa reemplazar_documento_conductor.';
  end if;
  insert into public.documentos_conductor(
    conductor_id,solicitud_id,tipo,nombre_archivo,url,estado,notas_admin,
    version,documento_anterior_id,es_actual,reemplazado_en,revisado_por,revisado_en,motivo_rechazo
  ) values(
    v_conductor_id,v_solicitud_id,p_tipo,p_nombre_archivo,p_ruta,'en_revision',null,
    1,null,true,null,null,null,null
  ) returning id into v_id;
  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('carga_documentos','conductor',p_objetivo_id,
    jsonb_build_object('accion','registro_documento','documento_id',v_id,'tipo',p_tipo,'version',1));
  return v_id;
end;
$$;
revoke all on function public.registrar_documento_conductor(uuid, text, text, text) from public, anon;
grant execute on function public.registrar_documento_conductor(uuid, text, text, text) to authenticated;

create or replace function public.reemplazar_documento_conductor(
  p_documento_anterior_id uuid,
  p_nombre_archivo text,
  p_ruta text
) returns uuid
language plpgsql security definer set search_path = public, storage as $$
declare
  v_auth uuid:=auth.uid(); anterior public.documentos_conductor; v_objetivo uuid; v_id uuid;
begin
  if v_auth is null then raise exception 'Inicia sesión para reemplazar documentos.'; end if;
  select d.* into anterior from public.documentos_conductor d
  where d.id=p_documento_anterior_id for update;
  if anterior.id is null then raise exception 'Documento anterior no encontrado.'; end if;
  v_objetivo:=coalesce(anterior.conductor_id,anterior.solicitud_id);
  if not public.objetivo_documento_pertenece_auth(v_objetivo,v_auth) then
    raise exception 'No puedes reemplazar un documento ajeno.';
  end if;
  if not anterior.es_actual or anterior.estado not in ('rechazado','vencido') then
    raise exception 'Sólo puede reemplazarse la versión vigente rechazada o vencida.';
  end if;
  perform pg_advisory_xact_lock(hashtext('documento:'||v_objetivo::text||':'||anterior.tipo));
  perform public.validar_ruta_documento_conductor(v_objetivo,anterior.tipo,p_ruta,v_auth);
  if p_nombre_archivo is null or p_nombre_archivo !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,179}$' then
    raise exception 'El nombre del archivo no está sanitizado.';
  end if;
  perform set_config('ruum.cambio_documento_autorizado','si',true);
  update public.documentos_conductor set
    estado='reemplazado',es_actual=false,reemplazado_en=now(),actualizado_en=now()
  where id=anterior.id;
  insert into public.documentos_conductor(
    conductor_id,solicitud_id,tipo,nombre_archivo,url,estado,notas_admin,
    version,documento_anterior_id,es_actual,reemplazado_en,revisado_por,revisado_en,motivo_rechazo
  ) values(
    anterior.conductor_id,anterior.solicitud_id,anterior.tipo,p_nombre_archivo,p_ruta,'en_revision',null,
    anterior.version+1,anterior.id,true,null,null,null,null
  ) returning id into v_id;
  perform set_config('ruum.cambio_documento_autorizado','',true);
  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('carga_documentos','conductor',v_objetivo,
    jsonb_build_object('accion','reemplazo_documento','documento_id',v_id,
      'documento_anterior_id',anterior.id,'tipo',anterior.tipo,'version',anterior.version+1));
  return v_id;
end;
$$;
revoke all on function public.reemplazar_documento_conductor(uuid, text, text) from public, anon;
grant execute on function public.reemplazar_documento_conductor(uuid, text, text) to authenticated;

-- Incluso un admin debe usar el RPC de revisión; ningún cliente puede alterar
-- directamente estado, notas o la cadena de versiones.
create or replace function public.proteger_campos_documento_conductor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ruum.cambio_documento_autorizado',true),'')='si' then return new; end if;
  if new.estado is distinct from old.estado or new.notas_admin is distinct from old.notas_admin
    or new.conductor_id is distinct from old.conductor_id or new.solicitud_id is distinct from old.solicitud_id
    or new.tipo is distinct from old.tipo or new.nombre_archivo is distinct from old.nombre_archivo
    or new.url is distinct from old.url or new.creado_en is distinct from old.creado_en
    or new.version is distinct from old.version or new.documento_anterior_id is distinct from old.documento_anterior_id
    or new.es_actual is distinct from old.es_actual or new.reemplazado_en is distinct from old.reemplazado_en
    or new.revisado_por is distinct from old.revisado_por or new.revisado_en is distinct from old.revisado_en
    or new.motivo_rechazo is distinct from old.motivo_rechazo then
    raise exception 'Los documentos sólo pueden modificarse mediante el flujo autorizado.';
  end if;
  return new;
end;
$$;

create or replace function public.revisar_documento_conductor_admin(
  p_documento_id uuid,
  p_estado text,
  p_notas text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_conductor_id uuid; v_solicitud_id uuid; v_estado public.estado_expediente_conductor; v_admin_id uuid;
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  select id into v_admin_id from public.admins where auth_user_id=auth.uid();
  if p_estado not in ('aprobado','rechazado','vencido') then raise exception 'Estado de revisión no permitido.'; end if;
  if p_estado<>'aprobado' and length(trim(coalesce(p_notas,'')))<5 then
    raise exception 'Escribe un motivo de al menos 5 caracteres.';
  end if;
  perform set_config('ruum.cambio_documento_autorizado','si',true);
  update public.documentos_conductor set
    estado=p_estado,
    notas_admin=case when p_estado='aprobado' then null else trim(p_notas) end,
    motivo_rechazo=case when p_estado='rechazado' then trim(p_notas) else null end,
    revisado_por=v_admin_id,revisado_en=now(),actualizado_en=now()
  where id=p_documento_id and es_actual
    and estado=case when p_estado='vencido' then 'aprobado' else 'en_revision' end
  returning conductor_id,solicitud_id into v_conductor_id,v_solicitud_id;
  perform set_config('ruum.cambio_documento_autorizado','',true);
  if v_conductor_id is null and v_solicitud_id is null then
    raise exception 'Documento no encontrado, no vigente o transición no permitida.';
  end if;
  if p_estado='rechazado' and v_solicitud_id is not null then
    select estado into v_estado from public.solicitudes_conductor where id=v_solicitud_id;
    if v_estado='en_revision' then perform public.cambiar_estado_solicitud_conductor(v_solicitud_id,'requiere_correccion'); end if;
  elsif p_estado='rechazado' and v_conductor_id is not null then
    select estado_expediente into v_estado from public.conductores where id=v_conductor_id;
    if v_estado='en_revision' then perform public.cambiar_estado_expediente_conductor(v_conductor_id,'requiere_correccion'); end if;
  end if;
end;
$$;

-- El reemplazo ya se realiza dentro de reemplazar_documento_conductor. Este
-- trigger sólo mantiene la preparación de expediente y el autoenvío legacy.
create or replace function public.preparar_expediente_por_documento()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_estado public.estado_expediente_conductor;
begin
  if new.solicitud_id is not null then
    select estado into v_estado from public.solicitudes_conductor where id=new.solicitud_id;
    if v_estado='requiere_correccion' then
      perform public.cambiar_estado_solicitud_conductor(new.solicitud_id,'documentos_pendientes');
    end if;
  elsif new.conductor_id is not null then
    select estado_expediente into v_estado from public.conductores where id=new.conductor_id;
    if v_estado='requiere_correccion' then
      perform public.cambiar_estado_expediente_conductor(new.conductor_id,'documentos_pendientes');
      v_estado:='documentos_pendientes';
    end if;
    if v_estado='documentos_pendientes'
      and public.expediente_conductor_tiene_datos(new.conductor_id)
      and not exists(
        select 1 from (values('licencia_frente'),('licencia_reverso'),('identificacion_oficial')) r(tipo)
        where not exists(select 1 from public.documentos_conductor d
          where d.conductor_id=new.conductor_id and d.tipo=r.tipo and d.es_actual and d.estado='en_revision')
      ) then
      perform public.cambiar_estado_expediente_conductor(new.conductor_id,'listo_para_enviar');
      perform public.cambiar_estado_expediente_conductor(new.conductor_id,'en_revision');
    end if;
  end if;
  return new;
end;
$$;

comment on column public.documentos_conductor.es_actual is 'Única versión vigente por expediente y tipo; garantizada mediante índices parciales únicos.';
comment on function public.registrar_documento_conductor(uuid,text,text,text) is 'Crea la primera versión documental con campos administrativos fijados por servidor.';
comment on function public.reemplazar_documento_conductor(uuid,text,text) is 'Reemplaza transaccionalmente una versión vigente rechazada y conserva el historial.';
