begin;

do $$
declare
  v_auth_1 uuid := gen_random_uuid();
  v_auth_2 uuid := gen_random_uuid();
  v_auth_3 uuid := gen_random_uuid();
  v_admin_auth uuid := gen_random_uuid();
  v_solicitud uuid;
  v_solicitud_3 uuid;
  v_error text;
begin
  insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (v_auth_1, v_auth_1 || '@rt03.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_auth_2, v_auth_2 || '@rt03.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_admin_auth, v_admin_auth || '@rt03.test', '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.admins(auth_user_id,nombre) values(v_admin_auth,'Admin RT03');

  insert into public.solicitudes_conductor (
    auth_user_id, estado, paso_actual, datos_personales, domicilio, licencia, contacto_emergencia
  ) values (
    v_auth_1, 'borrador', 2,
    '{"nombre":"Prueba RT03","curp":"rt030101hdfabc01","telefono":"+52 55 1234 5678"}',
    '{"codigo_postal":"01000"}',
    '{"numero":" lic-rt03 ","tipo":"A"}',
    '{"nombre":"Contacto","telefono":"5511111111"}'
  ) returning id into v_solicitud;

  if (select estado from public.solicitudes_conductor where id=v_solicitud) <> 'borrador' then
    raise exception 'RT-03: el expediente no persistió como borrador.';
  end if;
  if (select curp_normalizada from public.solicitudes_conductor where id=v_solicitud) <> 'RT030101HDFABC01' then
    raise exception 'RT-04: la CURP no fue normalizada.';
  end if;
  if (select telefono_normalizado from public.solicitudes_conductor where id=v_solicitud) <> '525512345678' then
    raise exception 'RT-04: el teléfono no fue normalizado.';
  end if;
  if (select licencia_normalizada from public.solicitudes_conductor where id=v_solicitud) <> 'LIC-RT03' then
    raise exception 'RT-04: la licencia no fue normalizada.';
  end if;

  begin
    insert into public.solicitudes_conductor(auth_user_id,estado) values (v_auth_1,'correo_pendiente');
    raise exception 'RT-03: se aceptaron dos solicitudes activas para el mismo usuario.';
  exception when unique_violation then null;
  end;

  -- El trigger real de Auth crea solicitud, nunca una identidad operativa.
  insert into auth.users (
    id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    v_auth_3,v_auth_3 || '@rt03.test',now(),'{}'::jsonb,
    jsonb_build_object(
      'tipo_registro','conductor','nombre','Alta separada','telefono','+525500003003','curp','RT040101HDFABC02',
      'domicilio',jsonb_build_object('codigo_postal','01000'),
      'licencia',jsonb_build_object('numero','LIC-RT04','tipo','A','vigencia',(current_date+365)::text),
      'contacto_emergencia',jsonb_build_object('nombre','Contacto','telefono','5500003003')
    ),now(),now()
  );
  select id into v_solicitud_3 from public.solicitudes_conductor where auth_user_id=v_auth_3;
  if v_solicitud_3 is null then raise exception 'RT-03: Auth no creó la solicitud.'; end if;
  if exists (select 1 from public.conductores where auth_user_id=v_auth_3) then
    raise exception 'RT-03: Auth creó un conductor antes de aprobación.';
  end if;

  -- Desde RT-06 la metadata puede ser mínima: el expediente se completa sólo
  -- después de autenticar, antes de cargar documentos.
  perform set_config('request.jwt.claim.sub',v_auth_3::text,true);
  perform public.completar_solicitud_conductor_v2(
    '{"nombre":"Alta separada","telefono":"+525500003003","curp":"RT040101HDFABC02","autoriza_verificacion_antecedentes":true,"declara_sin_suspensiones":true,"version_terminos_aceptada":2,"terminos_aceptados_en":"2026-07-10T18:00:00Z"}',
    '{"codigo_postal":"01000"}',
    '{"numero":"LIC-RT04","tipo":"A","vigencia":"2027-07-10"}',
    '{"nombre":"Contacto","telefono":"5500003003"}'
  );

  insert into public.documentos_conductor(solicitud_id,tipo,nombre_archivo,url,estado) values
    (v_solicitud_3,'licencia_frente','frente.pdf','rt03/frente.pdf','en_revision'),
    (v_solicitud_3,'licencia_reverso','reverso.pdf','rt03/reverso.pdf','en_revision'),
    (v_solicitud_3,'identificacion_oficial','id.pdf','rt03/id.pdf','en_revision');
  if (select estado from public.solicitudes_conductor where id=v_solicitud_3) <> 'en_revision' then
    raise exception 'RT-03: los documentos completos no enviaron la solicitud a revisión.';
  end if;

  begin
    insert into public.solicitudes_conductor(auth_user_id,datos_personales,licencia)
    values (v_auth_2,'{"curp":"RT030101HDFABC01","telefono":"525599999999"}','{"numero":"OTRA"}');
    raise exception 'RT-04: se aceptó CURP duplicada.';
  exception when unique_violation then null;
  end;

  begin
    insert into public.conductores(nombre,curp,telefono,licencia_numero)
    values ('Duplicado RT04',' rt030101hdfabc01 ','+52 55 8888 7777','OTRA-LIC');
    raise exception 'RT-04: se aceptó CURP duplicada entre solicitud y conductor.';
  exception when unique_violation then null;
  end;

  begin
    update public.solicitudes_conductor set estado='correo_pendiente' where id=v_solicitud;
    raise exception 'RT-03: el estado administrativo aceptó escritura directa.';
  exception when others then
    v_error:=sqlerrm;
    if v_error not ilike '%flujo autorizado%' then raise; end if;
  end;

  -- La aprobación transfiere documentos y crea la identidad operativa.
  perform set_config('request.jwt.claim.sub',v_admin_auth::text,true);
  perform public.revisar_documento_conductor_admin(id,'aprobado',null)
    from public.documentos_conductor where solicitud_id=v_solicitud_3;
  perform public.aprobar_solicitud_conductor_admin(v_solicitud_3);
  if not exists (select 1 from public.conductores where auth_user_id=v_auth_3 and estado='activo') then
    raise exception 'RT-03: aprobar la solicitud no creó el conductor activo.';
  end if;
  if exists (select 1 from public.documentos_conductor where solicitud_id=v_solicitud_3) then
    raise exception 'RT-03: los documentos no fueron transferidos al conductor.';
  end if;
  begin
    insert into public.solicitudes_conductor(auth_user_id) values(v_auth_3);
    raise exception 'RT-04: se aceptó una solicitud para un Auth que ya tiene conductor.';
  exception when unique_violation then null;
  end;

  raise notice 'RT-03/RT-04 OK: borrador, solicitud activa única e identificadores duplicados protegidos por PostgreSQL.';
end $$;

rollback;
