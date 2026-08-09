-- Permite reemplazar cualquier versión vigente de un documento (es_actual = true)
-- sin restringir a sólo estados rechazada o vencida.

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
  if not anterior.es_actual then
    raise exception 'Sólo puede reemplazarse la versión vigente.';
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
