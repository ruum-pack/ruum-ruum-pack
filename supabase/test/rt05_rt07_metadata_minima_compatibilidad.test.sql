begin;

do $$
declare
  v_auth_v2 uuid:=gen_random_uuid();
  v_auth_legacy_activo uuid:=gen_random_uuid();
  v_auth_legacy_pendiente uuid:=gen_random_uuid();
  v_auth_solicitud_legacy uuid:=gen_random_uuid();
  v_solicitud uuid;
  v_metadata jsonb;
begin
  -- SignUp conceptual v2: únicamente discriminador y versión.
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(
    v_auth_v2,v_auth_v2||'@rt05.test',now(),'{}',
    '{"tipo_registro":"conductor","version_registro":2}',now(),now()
  );
  select id into v_solicitud from public.solicitudes_conductor where auth_user_id=v_auth_v2;
  if v_solicitud is null then raise exception 'RT-05: metadata mínima no creó solicitud base.'; end if;
  if exists(select 1 from public.conductores where auth_user_id=v_auth_v2) then
    raise exception 'RT-05: metadata mínima creó conductor antes de aprobación.';
  end if;
  if (select estado from public.solicitudes_conductor where id=v_solicitud)<>'borrador'
    or (select version_registro from public.solicitudes_conductor where id=v_solicitud)<>2
    or (select datos_personales from public.solicitudes_conductor where id=v_solicitud)<>'{}'::jsonb then
    raise exception 'RT-05: el perfil base contiene datos de expediente.';
  end if;

  -- Fixtures legacy: metadata histórica se conserva y la operación no cambia.
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
    (v_auth_legacy_activo,v_auth_legacy_activo||'@rt07.test','{}','{"curp":"LEGACY-ACTIVO","licencia":{"numero":"OLD-1"}}',now(),now()),
    (v_auth_legacy_pendiente,v_auth_legacy_pendiente||'@rt07.test','{}','{"curp":"LEGACY-PENDIENTE"}',now(),now()),
    (v_auth_solicitud_legacy,v_auth_solicitud_legacy||'@rt07.test','{}','{}',now(),now());
  insert into public.conductores(auth_user_id,nombre,estado,curp,telefono,licencia_numero) values
    (v_auth_legacy_activo,'Legacy activo','activo','LEGACY-ACTIVO','+525511110001','OLD-1'),
    (v_auth_legacy_pendiente,'Legacy pendiente','pendiente_verificacion','LEGACY-PENDIENTE','+525511110002','OLD-2');
  insert into public.solicitudes_conductor(auth_user_id,estado,version_registro,origen_modelo)
    values(v_auth_solicitud_legacy,'borrador',1,'legacy_metadata');

  if public.clasificar_registro_conductor(v_auth_legacy_activo)<>'conductor_aprobado'
    or public.clasificar_registro_conductor(v_auth_legacy_pendiente)<>'conductor_legacy_pendiente'
    or public.clasificar_registro_conductor(v_auth_solicitud_legacy)<>'solicitud_legacy'
    or public.clasificar_registro_conductor(v_auth_v2)<>'solicitud_v2_incompleta' then
    raise exception 'RT-07: clasificación de compatibilidad incorrecta.';
  end if;
  if (select raw_user_meta_data->>'curp' from auth.users where id=v_auth_legacy_activo)<>'LEGACY-ACTIVO' then
    raise exception 'RT-07: metadata histórica fue borrada o alterada.';
  end if;
  select raw_user_meta_data into v_metadata from auth.users where id=v_auth_v2;
  if (select count(*) from jsonb_object_keys(v_metadata))<>2
    or v_metadata ?| array['curp','domicilio','licencia','contacto_emergencia','legales','verificacion'] then
    raise exception 'RT-06: user_metadata contiene información sensible: %',v_metadata;
  end if;

  -- Ya autenticado, la PII viaja a la tabla y nunca vuelve a user_metadata.
  perform set_config('request.jwt.claim.sub',v_auth_v2::text,true);
  perform set_config('role','authenticated',true);
  perform public.registrar_consentimientos_conductor(v_solicitud,'[
    {"tipo_documento":"terminos_servicio","version":1},
    {"tipo_documento":"aviso_privacidad","version":1},
    {"tipo_documento":"autorizacion_antecedentes","version":1},
    {"tipo_documento":"declaracion_suspensiones","version":1}
  ]','web','test-rt05');
  perform public.completar_solicitud_conductor_v2(
    '{"nombre":"Conductor V2","telefono":"+525500000005","curp":"RT050101HDFABC05","autoriza_verificacion_antecedentes":true,"declara_sin_suspensiones":true,"version_terminos_aceptada":2,"terminos_aceptados_en":"2026-07-10T18:00:00Z","marca_terminos":"ruum ruum"}',
    '{"codigo_postal":"01000","estado":"Ciudad de México","ciudad_municipio":"Álvaro Obregón","colonia":"San Ángel","calle":"Prueba","numero":"5"}',
    '{"numero":"LIC-RT05","tipo":"A","vigencia":"2027-07-10"}',
    '{"nombre":"Contacto","telefono":"5500000006"}'
  );
  if (select estado from public.solicitudes_conductor where id=v_solicitud)<>'documentos_pendientes' then
    raise exception 'RT-06: el expediente autenticado no avanzó.';
  end if;
  raise notice 'RT-05/06/07 OK: metadata mínima, PII fuera de Auth y compatibilidad legacy preservada.';
end $$;

rollback;
