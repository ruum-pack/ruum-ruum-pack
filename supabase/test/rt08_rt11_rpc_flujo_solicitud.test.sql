begin;

do $$
declare v_auth uuid:=gen_random_uuid(); r1 record; r2 record; v_error text;
begin
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_auth,v_auth||'@rt08.test',now(),'{}','{"tipo_registro":"conductor","version_registro":2}',now(),now());
  perform set_config('request.jwt.claim.sub',v_auth::text,true);
  perform set_config('role','authenticated',true);

  select * into r1 from public.iniciar_solicitud_conductor();
  select * into r2 from public.iniciar_solicitud_conductor();
  if r1.solicitud_id is null or r1.solicitud_id<>r2.solicitud_id then
    raise exception 'RT-08: iniciar no es idempotente.';
  end if;
  if (select count(*) from public.solicitudes_conductor where auth_user_id=v_auth)<>1 then
    raise exception 'RT-08: iniciar creó solicitudes duplicadas.';
  end if;
  if r2.estado<>'datos_incompletos' then raise exception 'RT-08: estado inicial inesperado: %',r2.estado; end if;
  perform set_config('rt08.solicitud_id',r1.solicitud_id::text,true);
  perform public.registrar_consentimientos_conductor(r1.solicitud_id,'[
    {"tipo_documento":"terminos_servicio","version":1},
    {"tipo_documento":"aviso_privacidad","version":1},
    {"tipo_documento":"autorizacion_antecedentes","version":1},
    {"tipo_documento":"declaracion_suspensiones","version":1}
  ]','web','test-rt08');

  -- Guardado por sección: primero datos personales incompletos.
  perform public.guardar_borrador_conductor(
    1::smallint,
    '{"nombre":"Conductor RPC","telefono":"+525500000008","curp":"ABCD010101HDFEFG09","autoriza_verificacion_antecedentes":true,"declara_sin_suspensiones":true,"acepta_terminos_privacidad":true,"version_terminos_aceptada":2,"terminos_aceptados_en":"2026-07-10T18:00:00Z"}',
    null,null,null
  );
  if (select paso_actual from public.solicitudes_conductor where id=r1.solicitud_id)<>1 then
    raise exception 'RT-09: no guardó paso_actual.';
  end if;

  -- Completar las secciones conserva la primera y deja el expediente listo para documentos.
  perform public.guardar_borrador_conductor(
    5::smallint,null,
    '{"codigo_postal":"01000","estado":"Ciudad de México","ciudad_municipio":"Álvaro Obregón","colonia":"San Ángel","calle":"Prueba","numero":"8"}',
    '{"numero":"LIC-RT08","tipo":"A","vigencia":"2027-07-10"}',
    '{"nombre":"Contacto","telefono":"5500000009"}'
  );
  select * into r2 from public.iniciar_solicitud_conductor();
  if r2.paso_actual<>5 or r2.estado<>'documentos_pendientes'
    or (select datos_personales->>'curp' from public.solicitudes_conductor where id=r1.solicitud_id)<>'ABCD010101HDFEFG09' then
    raise exception 'RT-09: el borrador no sobrevivió al reingreso.';
  end if;

  begin
    perform public.enviar_solicitud_conductor();
    raise exception 'RT-10: permitió enviar sin documentos.';
  exception when others then
    v_error:=sqlerrm;
    if v_error not ilike '%documentos obligatorios%' then raise; end if;
  end;

  -- Fixture interno: desde RT-13 el rol authenticated ya no puede insertar
  -- documentos directamente; la carga real usa registrar_documento_conductor.
  perform set_config('role','postgres',true);
  insert into public.documentos_conductor(solicitud_id,tipo,nombre_archivo,url,estado) values
    (r1.solicitud_id,'licencia_frente','frente.pdf','rt08/frente.pdf','en_revision'),
    (r1.solicitud_id,'licencia_reverso','reverso.pdf','rt08/reverso.pdf','en_revision'),
    (r1.solicitud_id,'identificacion_oficial','id.pdf','rt08/id.pdf','en_revision');
  perform set_config('role','authenticated',true);
  if (select estado from public.solicitudes_conductor where id=r1.solicitud_id)<>'documentos_pendientes' then
    raise exception 'RT-10: cargar documentos envió la solicitud automáticamente.';
  end if;

  -- Vigencia se comprueba de nuevo en servidor al enviar.
  perform public.guardar_borrador_conductor(5::smallint,null,null,'{"numero":"LIC-RT08","tipo":"A","vigencia":"2020-01-01"}',null);
  begin
    perform public.enviar_solicitud_conductor();
    raise exception 'RT-10: permitió licencia vencida.';
  exception when others then
    v_error:=sqlerrm;
    if v_error not ilike '%licencia está vencida%' then raise; end if;
  end;
  perform public.guardar_borrador_conductor(5::smallint,null,null,'{"numero":"LIC-RT08","tipo":"A","vigencia":"2027-07-10"}',null);

  select * into r2 from public.enviar_solicitud_conductor();
  if r2.estado<>'en_revision' or (select enviado_en from public.solicitudes_conductor where id=r1.solicitud_id) is null then
    raise exception 'RT-10: el envío atómico no finalizó en revisión.';
  end if;
  begin
    perform public.guardar_borrador_conductor(5::smallint,'{"nombre":"Alterado"}',null,null,null);
    raise exception 'RT-10: permitió modificar después del envío.';
  exception when others then
    v_error:=sqlerrm;
    if v_error not ilike '%ya no admite cambios%' then raise; end if;
  end;
end $$;

reset role;
do $$
declare v_id uuid:=current_setting('rt08.solicitud_id')::uuid;
begin
  if not exists(
    select 1 from public.registro_auditoria
    where actor_id=v_id and evento='validacion_documentos' and datos->>'accion'='envio_solicitud_conductor'
  ) then raise exception 'RT-10: no registró auditoría de envío.'; end if;
  raise notice 'RT-08/09/10/11 OK: inicio idempotente, borrador persistente, envío validado y sin polling.';
end $$;

rollback;
