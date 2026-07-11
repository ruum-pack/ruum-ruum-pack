-- RT-24 — Corrige la materialización del conductor aprobado sin saltar la
-- máquina de estados. La migración 111 ya fue aplicada y no se modifica.

create or replace function public.aprobar_solicitud_conductor_admin(
  p_solicitud_id uuid,
  p_motivo text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.solicitudes_conductor;
  v_conductor_id uuid;
  v_admin_id uuid;
  v_estado_operativo public.estado_expediente_conductor;
  v_motivo text:=coalesce(nullif(trim(p_motivo),''),'Expediente, documentos y consentimientos validados.');
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  select id into v_admin_id from public.admins where auth_user_id=auth.uid();
  if v_admin_id is null then raise exception 'No se encontró el administrador autenticado.'; end if;
  select * into s from public.solicitudes_conductor where id=p_solicitud_id for update;
  if s.id is null or s.estado<>'en_revision' then raise exception 'La solicitud no está en revisión.'; end if;
  if exists (
    select 1 from (values ('licencia_frente'),('licencia_reverso'),('identificacion_oficial')) r(tipo)
    where not exists (
      select 1 from public.documentos_conductor d
      where d.solicitud_id=s.id and d.tipo=r.tipo and d.es_actual and d.estado='aprobado'
    )
  ) then raise exception 'Faltan documentos obligatorios vigentes y aprobados.'; end if;
  if exists (
    select 1 from (values
      ('terminos_servicio'::public.tipo_documento_consentimiento),
      ('aviso_privacidad'::public.tipo_documento_consentimiento),
      ('autorizacion_antecedentes'::public.tipo_documento_consentimiento),
      ('declaracion_suspensiones'::public.tipo_documento_consentimiento)
    ) r(tipo)
    where not exists (
      select 1 from public.consentimientos_usuario c
      where c.solicitud_id=s.id and c.tipo_documento=r.tipo
    )
  ) then raise exception 'Faltan consentimientos obligatorios.'; end if;

  perform set_config('ruum.aprobando_solicitud','si',true);
  insert into public.conductores (
    auth_user_id,nombre,telefono,curp,codigo_postal,estado_residencia,ciudad_municipio,colonia,calle,numero,referencias,
    licencia_numero,licencia_tipo,licencia_vigencia,autoriza_verificacion_antecedentes,declara_sin_suspensiones,
    contacto_emergencia_nombre,contacto_emergencia_telefono,version_terminos_aceptada,terminos_aceptados_en,marca_terminos
  ) values (
    s.auth_user_id,coalesce(s.datos_personales->>'nombre',''),s.datos_personales->>'telefono',s.curp_normalizada,
    s.domicilio->>'codigo_postal',s.domicilio->>'estado',s.domicilio->>'ciudad_municipio',s.domicilio->>'colonia',s.domicilio->>'calle',s.domicilio->>'numero',s.domicilio->>'referencias',
    s.licencia_normalizada,s.licencia->>'tipo',(s.licencia->>'vigencia')::date,
    true,true,
    s.contacto_emergencia->>'nombre',s.contacto_emergencia->>'telefono',1,now(),'registro_v2_consentimientos_historicos'
  ) returning id into v_conductor_id;
  perform set_config('ruum.aprobando_solicitud','',true);

  perform set_config('ruum.cambio_documento_autorizado','si',true);
  update public.documentos_conductor set conductor_id=v_conductor_id,solicitud_id=null where solicitud_id=s.id;
  perform set_config('ruum.cambio_documento_autorizado','',true);

  -- El trigger de alta decide el estado inicial según Auth. Se avanza paso a
  -- paso para que ninguna aprobación omita las reglas de transición.
  select estado_expediente into v_estado_operativo from public.conductores where id=v_conductor_id;
  if v_estado_operativo='borrador' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id,'correo_pendiente');
    v_estado_operativo:='correo_pendiente';
  end if;
  if v_estado_operativo='correo_pendiente' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id,'documentos_pendientes');
    v_estado_operativo:='documentos_pendientes';
  elsif v_estado_operativo='datos_incompletos' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id,'documentos_pendientes');
    v_estado_operativo:='documentos_pendientes';
  end if;
  if v_estado_operativo='documentos_pendientes' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id,'listo_para_enviar');
    v_estado_operativo:='listo_para_enviar';
  end if;
  if v_estado_operativo='listo_para_enviar' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id,'en_revision');
    v_estado_operativo:='en_revision';
  end if;
  if v_estado_operativo='en_revision' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id,'aprobado');
    v_estado_operativo:='aprobado';
  end if;
  if v_estado_operativo<>'aprobado' then
    raise exception 'No fue posible llevar el expediente operativo a aprobado desde %.', v_estado_operativo;
  end if;
  update public.conductores set estado='activo',documentos_vigentes=true where id=v_conductor_id;

  perform set_config('ruum.decision_solicitud','aprobar_solicitud',true);
  perform set_config('ruum.motivo_decision_solicitud',v_motivo,true);
  perform public.cambiar_estado_solicitud_conductor(s.id,'aprobado');
  perform set_config('ruum.decision_solicitud','',true);
  perform set_config('ruum.motivo_decision_solicitud','',true);
  update public.solicitudes_conductor set conductor_id=v_conductor_id where id=s.id;

  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('verificacion_cuenta','admin',v_admin_id,jsonb_build_object(
    'solicitud_id',s.id,'conductor_id',v_conductor_id,'decision','aprobar_solicitud','motivo',v_motivo
  ));
  return v_conductor_id;
end;
$$;

revoke all on function public.aprobar_solicitud_conductor_admin(uuid,text) from public,anon;
grant execute on function public.aprobar_solicitud_conductor_admin(uuid,text) to authenticated;
