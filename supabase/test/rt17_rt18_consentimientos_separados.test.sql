begin;

do $$
declare
  v_auth uuid:=gen_random_uuid(); v_solicitud uuid; v_error text; v_id uuid;
  v_datos jsonb:='{"nombre":"Consentimientos RT17","telefono":"+525500000017","curp":"RTCO010101HDFABC07","autoriza_verificacion_antecedentes":true,"declara_sin_suspensiones":true,"acepta_terminos_privacidad":true,"acepta_terminos_servicio":true,"confirma_aviso_privacidad":true,"version_terminos_aceptada":1,"terminos_aceptados_en":"2026-07-10T18:00:00Z"}';
begin
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_auth,v_auth||'@rt17.test',now(),'{}','{"tipo_registro":"conductor","version_registro":2}',now(),now());
  select id into v_solicitud from public.solicitudes_conductor where auth_user_id=v_auth;
  perform set_config('request.jwt.claim.sub',v_auth::text,true);
  perform set_config('role','authenticated',true);
  perform public.iniciar_solicitud_conductor();

  begin
    insert into public.consentimientos_usuario(
      auth_user_id,solicitud_id,tipo_documento,version,canal,version_app,hash_documento
    ) values(v_auth,v_solicitud,'terminos_servicio',1,'web','fraude',repeat('a',64));
    raise exception 'RT-17: authenticated insertó consentimiento directamente.';
  exception when insufficient_privilege then null;
  end;

  -- El booleano genérico heredado no sustituye las cuatro evidencias.
  perform public.guardar_borrador_conductor(
    5::smallint,v_datos,
    '{"codigo_postal":"01000","estado":"Ciudad de México","ciudad_municipio":"Álvaro Obregón","colonia":"San Ángel","calle":"Prueba","numero":"17"}',
    '{"numero":"LIC-RT17","tipo":"A","vigencia":"2027-07-10"}',
    '{"nombre":"Contacto","telefono":"5500000018"}'
  );
  if (select estado from public.solicitudes_conductor where id=v_solicitud)<>'datos_incompletos' then
    raise exception 'RT-18: el booleano genérico hizo avanzar la solicitud.';
  end if;

  perform public.registrar_consentimientos_conductor(v_solicitud,'[
    {"tipo_documento":"terminos_servicio","version":1},
    {"tipo_documento":"autorizacion_antecedentes","version":1},
    {"tipo_documento":"declaracion_suspensiones","version":1}
  ]','web','2.0.0-test');
  perform public.guardar_borrador_conductor(5::smallint,null,null,null,null);
  if (select estado from public.solicitudes_conductor where id=v_solicitud)<>'datos_incompletos' then
    raise exception 'RT-18: avanzó sin aviso de privacidad.';
  end if;

  perform public.registrar_consentimientos_conductor(v_solicitud,'[
    {"tipo_documento":"aviso_privacidad","version":1}
  ]','web','2.0.0-test');
  perform public.guardar_borrador_conductor(5::smallint,null,null,null,null);
  if (select estado from public.solicitudes_conductor where id=v_solicitud)<>'documentos_pendientes' then
    raise exception 'RT-18: no avanzó con los cuatro consentimientos separados.';
  end if;
  if (select count(*) from public.consentimientos_usuario where solicitud_id=v_solicitud)<>4
    or (select count(distinct tipo_documento) from public.consentimientos_usuario where solicitud_id=v_solicitud)<>4 then
    raise exception 'RT-17: no creó una fila independiente por consentimiento.';
  end if;
  if exists(
    select 1 from public.consentimientos_usuario c
    join public.versiones_documento_consentimiento d using(tipo_documento,version)
    where c.solicitud_id=v_solicitud and (c.hash_documento<>d.hash_documento
      or c.aceptado_en is null or c.canal<>'web' or c.version_app<>'2.0.0-test')
  ) then raise exception 'RT-17: versión, hash, fecha, canal o versión de app no son demostrables.'; end if;

  -- Reintentar la misma aceptación es idempotente y nunca sobrescribe.
  perform public.registrar_consentimientos_conductor(v_solicitud,'[
    {"tipo_documento":"terminos_servicio","version":1},
    {"tipo_documento":"aviso_privacidad","version":1}
  ]','web','2.0.0-test');
  if (select count(*) from public.consentimientos_usuario where solicitud_id=v_solicitud)<>4 then
    raise exception 'RT-17: el reintento duplicó o sobrescribió el historial.';
  end if;

  perform set_config('role','postgres',true);
  select id into v_id from public.consentimientos_usuario where solicitud_id=v_solicitud limit 1;
  begin
    update public.consentimientos_usuario set version_app='alterada' where id=v_id;
    raise exception 'RT-17: permitió sobrescribir un consentimiento.';
  exception when others then
    v_error:=sqlerrm;
    if v_error not ilike '%historial de consentimientos es inmutable%' then raise; end if;
  end;
  raise notice 'RT-17/18 OK: cuatro consentimientos separados, versionados, con hash e historial append-only.';
end $$;

rollback;
