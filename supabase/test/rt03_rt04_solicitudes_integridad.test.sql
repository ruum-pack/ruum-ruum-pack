-- RT-03 / RT-04 — El expediente (`solicitudes_conductor`) es un borrador
-- separado de la identidad operativa (`conductores`); CURP/teléfono/licencia
-- se normalizan y quedan protegidos contra duplicados por índices únicos.

create extension if not exists pgtap with schema extensions;

begin;

select plan(14);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000003-0000-4000-8000-000000000001', 'rt03-1@rt03.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000003-0000-4000-8000-000000000002', 'rt03-2@rt03.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000003-0000-4000-8000-00000000000a', 'rt03-admin@rt03.test', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.admins (auth_user_id, nombre) values ('00000003-0000-4000-8000-00000000000a', 'Admin RT03');

insert into public.solicitudes_conductor (
  auth_user_id, estado, paso_actual, datos_personales, domicilio, licencia, contacto_emergencia
) values (
  '00000003-0000-4000-8000-000000000001', 'borrador', 2,
  '{"nombre":"Prueba RT03","curp":"rt030101hdfabc01","telefono":"+52 55 1234 5678"}',
  '{"codigo_postal":"01000","estado":"Ciudad de México","ciudad_municipio":"Álvaro Obregón","colonia":"San Ángel","calle":"Prueba","numero":"3"}',
  '{"numero":" lic-rt03 ","tipo":"A"}',
  '{"nombre":"Contacto","telefono":"5511111111"}'
);

select is(
  (select estado::text from public.solicitudes_conductor where auth_user_id = '00000003-0000-4000-8000-000000000001'),
  'borrador',
  'RT-03: el expediente persiste como borrador'
);
select is(
  (select curp_normalizada from public.solicitudes_conductor where auth_user_id = '00000003-0000-4000-8000-000000000001'),
  'RT030101HDFABC01',
  'RT-04: la CURP fue normalizada'
);
select is(
  (select telefono_normalizado from public.solicitudes_conductor where auth_user_id = '00000003-0000-4000-8000-000000000001'),
  '525512345678',
  'RT-04: el teléfono fue normalizado'
);
select is(
  (select licencia_normalizada from public.solicitudes_conductor where auth_user_id = '00000003-0000-4000-8000-000000000001'),
  'LIC-RT03',
  'RT-04: la licencia fue normalizada'
);

select throws_ok(
  $sql$ insert into public.solicitudes_conductor(auth_user_id,estado) values ('00000003-0000-4000-8000-000000000001','correo_pendiente') $sql$,
  '23505', null,
  'RT-03: rechaza una segunda solicitud activa para el mismo usuario'
);

-- El trigger real de Auth crea solicitud, nunca una identidad operativa.
insert into auth.users (
  id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000003-0000-4000-8000-000000000003', 'rt03-3@rt03.test', now(), '{}'::jsonb,
  jsonb_build_object(
    'tipo_registro', 'conductor', 'nombre', 'Alta separada', 'telefono', '+525500003003', 'curp', 'RT040101HDFABC02',
    'domicilio', jsonb_build_object('codigo_postal', '01000'),
    'licencia', jsonb_build_object('numero', 'LIC-RT04', 'tipo', 'A', 'vigencia', (current_date + 365)::text),
    'contacto_emergencia', jsonb_build_object('nombre', 'Contacto', 'telefono', '5500003003')
  ), now(), now()
);

select ok(
  (select id from public.solicitudes_conductor where auth_user_id = '00000003-0000-4000-8000-000000000003') is not null,
  'RT-03: Auth creó la solicitud base'
);
select ok(
  not exists(select 1 from public.conductores where auth_user_id = '00000003-0000-4000-8000-000000000003'),
  'RT-03: Auth no creó un conductor antes de la aprobación'
);

-- Desde RT-06 la metadata puede ser mínima: el expediente se completa sólo
-- después de autenticar, antes de cargar documentos.
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000003-0000-4000-8000-000000000003', true);
  perform public.registrar_consentimientos_conductor(
    (select id from public.solicitudes_conductor where auth_user_id = '00000003-0000-4000-8000-000000000003'),
    '[
      {"tipo_documento":"terminos_servicio","version":1},
      {"tipo_documento":"aviso_privacidad","version":1},
      {"tipo_documento":"autorizacion_antecedentes","version":1},
      {"tipo_documento":"declaracion_suspensiones","version":1}
    ]', 'web', 'test-rt03'
  );
  perform public.completar_solicitud_conductor_v2(
    '{"nombre":"Alta separada","telefono":"+525500003003","curp":"RT040101HDFABC02","autoriza_verificacion_antecedentes":true,"declara_sin_suspensiones":true,"acepta_terminos_privacidad":true,"version_terminos_aceptada":2,"terminos_aceptados_en":"2026-07-10T18:00:00Z"}',
    '{"codigo_postal":"01000","estado":"Ciudad de México","ciudad_municipio":"Álvaro Obregón","colonia":"San Ángel","calle":"Prueba","numero":"3"}',
    '{"numero":"LIC-RT04","tipo":"A","vigencia":"2027-07-10"}',
    '{"nombre":"Contacto","telefono":"5500003003"}'
  );
end $$;

insert into public.documentos_conductor (solicitud_id, tipo, nombre_archivo, url, estado)
select id, tipo, archivo, url, 'en_revision'
from public.solicitudes_conductor,
  (values
    ('licencia_frente', 'frente.pdf', 'rt03/frente.pdf'),
    ('licencia_reverso', 'reverso.pdf', 'rt03/reverso.pdf'),
    ('identificacion_oficial', 'id.pdf', 'rt03/id.pdf')
  ) as docs(tipo, archivo, url)
where auth_user_id = '00000003-0000-4000-8000-000000000003';

do $$ begin
  perform public.enviar_solicitud_conductor();
end $$;

select is(
  (select estado::text from public.solicitudes_conductor where auth_user_id = '00000003-0000-4000-8000-000000000003'),
  'en_revision',
  'RT-03: los documentos completos envían la solicitud a revisión'
);

select throws_ok(
  $sql$ insert into public.solicitudes_conductor(auth_user_id,datos_personales,licencia)
    values ('00000003-0000-4000-8000-000000000002','{"curp":"RT030101HDFABC01","telefono":"525599999999"}','{"numero":"OTRA"}') $sql$,
  '23505', null,
  'RT-04: rechaza CURP duplicada entre solicitudes'
);

select throws_ok(
  $sql$ insert into public.conductores(nombre,curp,telefono,licencia_numero)
    values ('Duplicado RT04',' rt030101hdfabc01 ','+52 55 8888 7777','OTRA-LIC') $sql$,
  '23505', null,
  'RT-04: rechaza CURP duplicada entre conductor y solicitud'
);

select throws_like(
  $sql$ update public.solicitudes_conductor set estado='correo_pendiente'
    where auth_user_id = '00000003-0000-4000-8000-000000000001' $sql$,
  '%flujo autorizado%',
  'RT-03: bloquea la escritura directa del estado administrativo'
);

-- La aprobación transfiere documentos y crea la identidad operativa.
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000003-0000-4000-8000-00000000000a', true);
  perform public.revisar_documento_conductor_admin(id, 'aprobado', null)
    from public.documentos_conductor
    where solicitud_id = (select id from public.solicitudes_conductor where auth_user_id = '00000003-0000-4000-8000-000000000003');
  perform public.aprobar_solicitud_conductor_admin(
    (select id from public.solicitudes_conductor where auth_user_id = '00000003-0000-4000-8000-000000000003')
  );
end $$;

select ok(
  exists(select 1 from public.conductores where auth_user_id = '00000003-0000-4000-8000-000000000003' and estado = 'activo'),
  'RT-03: aprobar la solicitud crea el conductor activo'
);
select ok(
  not exists(
    select 1 from public.documentos_conductor
    where solicitud_id = (select id from public.solicitudes_conductor where auth_user_id = '00000003-0000-4000-8000-000000000003')
  ),
  'RT-03: los documentos fueron transferidos al conductor'
);

select throws_ok(
  $sql$ insert into public.solicitudes_conductor(auth_user_id) values ('00000003-0000-4000-8000-000000000003') $sql$,
  '23505', null,
  'RT-04: rechaza una nueva solicitud para un Auth que ya tiene conductor'
);

select * from finish();

rollback;
