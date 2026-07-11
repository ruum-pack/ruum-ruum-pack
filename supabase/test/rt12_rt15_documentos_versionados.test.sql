begin;

do $$
declare
  v_auth uuid:=gen_random_uuid(); v_otro_auth uuid:=gen_random_uuid(); v_admin_auth uuid:=gen_random_uuid();
  v_solicitud uuid; v_otra_solicitud uuid; v_admin uuid; v_doc1 uuid; v_doc2 uuid; v_error text;
  v_ruta1 text; v_ruta2 text;
begin
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
    (v_auth,v_auth||'@rt12.test',now(),'{}','{"tipo_registro":"conductor","version_registro":2}',now(),now()),
    (v_otro_auth,v_otro_auth||'@rt12.test',now(),'{}','{"tipo_registro":"conductor","version_registro":2}',now(),now()),
    (v_admin_auth,v_admin_auth||'@rt12.test',now(),'{}','{}',now(),now());
  select id into v_solicitud from public.solicitudes_conductor where auth_user_id=v_auth;
  select id into v_otra_solicitud from public.solicitudes_conductor where auth_user_id=v_otro_auth;
  insert into public.admins(auth_user_id,nombre) values(v_admin_auth,'Admin RT14') returning id into v_admin;

  v_ruta1:=v_auth||'/'||v_solicitud||'/licencia_frente/primera.jpg';
  v_ruta2:=v_auth||'/'||v_solicitud||'/licencia_frente/segunda.jpg';
  insert into public.documentos_storage_validados(ruta,auth_user_id,objetivo_id,tipo,sha256) values
    (v_ruta1,v_auth,v_solicitud,'licencia_frente',repeat('a',64)),
    (v_ruta2,v_auth,v_solicitud,'licencia_frente',repeat('b',64)),
    (v_auth||'/'||v_otra_solicitud||'/licencia_frente/ajeno.jpg',v_auth,v_otra_solicitud,'licencia_frente',repeat('c',64));
  perform set_config('request.jwt.claim.sub',v_auth::text,true);
  perform set_config('role','authenticated',true);

  insert into storage.objects(bucket_id,name,owner_id)
  values('documentos-conductor',v_ruta1,v_auth::text);

  begin
    insert into storage.objects(bucket_id,name,owner_id)
    values('documentos-conductor',v_auth||'/'||v_otra_solicitud||'/licencia_frente/ajeno.jpg',v_auth::text);
    raise exception 'RT-12: permitió subir bajo una solicitud ajena.';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects(bucket_id,name,owner_id)
    values('documentos-conductor',v_auth||'/'||v_solicitud||'/licencia_reverso/sin-validar.jpg',v_auth::text);
    raise exception 'RT-12/16: permitió upload directo sin validación de contenido.';
  exception when insufficient_privilege then null;
  end;

  select public.registrar_documento_conductor(v_solicitud,'licencia_frente','primera.jpg',v_ruta1) into v_doc1;
  if not exists(select 1 from public.documentos_conductor where id=v_doc1 and solicitud_id=v_solicitud
    and estado='en_revision' and notas_admin is null and version=1 and es_actual
    and revisado_por is null and revisado_en is null and motivo_rechazo is null) then
    raise exception 'RT-13/14: el servidor no fijó los campos iniciales.';
  end if;

  begin
    insert into public.documentos_conductor(solicitud_id,tipo,nombre_archivo,url,estado)
    values(v_solicitud,'licencia_reverso','directo.jpg','directo.jpg','aprobado');
    raise exception 'RT-13: authenticated pudo insertar una fila directamente.';
  exception when insufficient_privilege then null;
  end;

  insert into storage.objects(bucket_id,name,owner_id)
  values('documentos-conductor',v_ruta2,v_auth::text);
  begin
    perform public.registrar_documento_conductor(v_solicitud,'licencia_frente','segunda.jpg',v_ruta2);
    raise exception 'RT-14: permitió dos versiones vigentes del mismo tipo.';
  exception when others then
    v_error:=sqlerrm;
    if v_error not ilike '%versión vigente%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',v_admin_auth::text,true);
  perform public.revisar_documento_conductor_admin(v_doc1,'rechazado','La imagen no permite leer los datos.');
  if not exists(select 1 from public.documentos_conductor where id=v_doc1 and estado='rechazado'
    and revisado_por=v_admin and revisado_en is not null and motivo_rechazo is not null) then
    raise exception 'RT-14: la revisión administrativa no quedó trazable.';
  end if;

  perform set_config('request.jwt.claim.sub',v_auth::text,true);
  select public.reemplazar_documento_conductor(v_doc1,'segunda.jpg',v_ruta2) into v_doc2;
  if not exists(select 1 from public.documentos_conductor where id=v_doc1 and estado='reemplazado'
    and not es_actual and reemplazado_en is not null) then
    raise exception 'RT-15: la versión anterior no quedó reemplazada.';
  end if;
  if not exists(select 1 from public.documentos_conductor where id=v_doc2 and estado='en_revision'
    and es_actual and version=2 and documento_anterior_id=v_doc1 and revisado_por is null and motivo_rechazo is null) then
    raise exception 'RT-15: la nueva versión no quedó enlazada y en revisión.';
  end if;
  if (select count(*) from public.documentos_conductor where solicitud_id=v_solicitud and tipo='licencia_frente' and es_actual)<>1 then
    raise exception 'RT-14: existe más de una versión actual.';
  end if;

  -- Aunque un objeto ajeno hubiese sido creado por un backend privilegiado,
  -- el RPC vuelve a comprobar propiedad y ruta antes de registrar la fila.
  perform set_config('role','postgres',true);
  insert into storage.objects(bucket_id,name,owner_id)
  values('documentos-conductor',v_auth||'/'||v_otra_solicitud||'/licencia_reverso/forzado.jpg',v_auth::text);
  perform set_config('role','authenticated',true);
  begin
    perform public.registrar_documento_conductor(
      v_otra_solicitud,'licencia_reverso','forzado.jpg',
      v_auth||'/'||v_otra_solicitud||'/licencia_reverso/forzado.jpg'
    );
    raise exception 'RT-12/13: el RPC aceptó un expediente ajeno.';
  exception when others then
    v_error:=sqlerrm;
    if v_error not ilike '%expediente ajeno%' and v_error not ilike '%no puedes registrar%' then raise; end if;
  end;

  raise notice 'RT-12/13/14/15 OK: ruta aislada, alta por RPC, versión única e historial de reemplazo.';
end $$;

rollback;
