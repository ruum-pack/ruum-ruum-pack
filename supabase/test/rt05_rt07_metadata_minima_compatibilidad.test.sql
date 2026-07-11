-- RT-05 / RT-06 / RT-07 — El SignUp v2 sólo guarda un discriminador mínimo en
-- `user_metadata` (nunca PII); la PII vive en `solicitudes_conductor` tras
-- autenticar. Los registros legacy (metadata histórica) se siguen
-- clasificando y operando sin alterar su metadata original.

create extension if not exists pgtap with schema extensions;

begin;

select plan(13);

-- SignUp conceptual v2: únicamente discriminador y versión.
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000004-0000-4000-8000-000000000001', 'rt05@rt05.test', now(), '{}'::jsonb,
  '{"tipo_registro":"conductor","version_registro":2}'::jsonb, now(), now()
);

select ok(
  (select id from public.solicitudes_conductor where auth_user_id = '00000004-0000-4000-8000-000000000001') is not null,
  'RT-05: la metadata mínima crea una solicitud base'
);
select ok(
  not exists(select 1 from public.conductores where auth_user_id = '00000004-0000-4000-8000-000000000001'),
  'RT-05: la metadata mínima no crea un conductor antes de la aprobación'
);
select is(
  (select estado::text from public.solicitudes_conductor where auth_user_id = '00000004-0000-4000-8000-000000000001'),
  'borrador',
  'RT-05: el perfil base inicia en borrador'
);
select is(
  (select version_registro from public.solicitudes_conductor where auth_user_id = '00000004-0000-4000-8000-000000000001'),
  2,
  'RT-05: el perfil base registra version_registro=2'
);
select is(
  (select datos_personales from public.solicitudes_conductor where auth_user_id = '00000004-0000-4000-8000-000000000001'),
  '{}'::jsonb,
  'RT-05: el perfil base no contiene datos de expediente'
);

-- Fixtures legacy: metadata histórica se conserva y la operación no cambia.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000004-0000-4000-8000-000000000002', 'rt07-activo@rt07.test', '{}'::jsonb, '{"curp":"LEGACY-ACTIVO","licencia":{"numero":"OLD-1"}}'::jsonb, now(), now()),
  ('00000004-0000-4000-8000-000000000003', 'rt07-pendiente@rt07.test', '{}'::jsonb, '{"curp":"LEGACY-PENDIENTE"}'::jsonb, now(), now()),
  ('00000004-0000-4000-8000-000000000004', 'rt07-solicitud@rt07.test', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.conductores (auth_user_id, nombre, estado, curp, telefono, licencia_numero) values
  ('00000004-0000-4000-8000-000000000002', 'Legacy activo', 'activo', 'LEGACY-ACTIVO', '+525511110001', 'OLD-1'),
  ('00000004-0000-4000-8000-000000000003', 'Legacy pendiente', 'pendiente_verificacion', 'LEGACY-PENDIENTE', '+525511110002', 'OLD-2');
insert into public.solicitudes_conductor (auth_user_id, estado, version_registro, origen_modelo)
  values ('00000004-0000-4000-8000-000000000004', 'borrador', 1, 'legacy_metadata');

select is(
  public.clasificar_registro_conductor('00000004-0000-4000-8000-000000000002'),
  'conductor_aprobado',
  'RT-07: clasifica un conductor legacy aprobado'
);
select is(
  public.clasificar_registro_conductor('00000004-0000-4000-8000-000000000003'),
  'conductor_legacy_pendiente',
  'RT-07: clasifica un conductor legacy pendiente'
);
select is(
  public.clasificar_registro_conductor('00000004-0000-4000-8000-000000000004'),
  'solicitud_legacy',
  'RT-07: clasifica una solicitud legacy'
);
select is(
  public.clasificar_registro_conductor('00000004-0000-4000-8000-000000000001'),
  'solicitud_v2_incompleta',
  'RT-07: clasifica una solicitud v2 incompleta'
);
select is(
  (select raw_user_meta_data->>'curp' from auth.users where id = '00000004-0000-4000-8000-000000000002'),
  'LEGACY-ACTIVO',
  'RT-07: la metadata histórica no fue borrada ni alterada'
);
select is(
  (select count(*) from jsonb_object_keys((select raw_user_meta_data from auth.users where id = '00000004-0000-4000-8000-000000000001')))::int,
  2,
  'RT-06: user_metadata v2 sólo tiene 2 llaves'
);
select ok(
  not (
    (select raw_user_meta_data from auth.users where id = '00000004-0000-4000-8000-000000000001')
    ?| array['curp', 'domicilio', 'licencia', 'contacto_emergencia', 'legales', 'verificacion']
  ),
  'RT-06: user_metadata v2 no contiene información sensible'
);

-- Ya autenticado, la PII viaja a la tabla y nunca vuelve a user_metadata.
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000004-0000-4000-8000-000000000001', true);
  perform set_config('role', 'authenticated', true);
  perform public.registrar_consentimientos_conductor(
    (select id from public.solicitudes_conductor where auth_user_id = '00000004-0000-4000-8000-000000000001'),
    '[
      {"tipo_documento":"terminos_servicio","version":1},
      {"tipo_documento":"aviso_privacidad","version":1},
      {"tipo_documento":"autorizacion_antecedentes","version":1},
      {"tipo_documento":"declaracion_suspensiones","version":1}
    ]', 'web', 'test-rt05'
  );
  perform public.completar_solicitud_conductor_v2(
    '{"nombre":"Conductor V2","telefono":"+525500000005","curp":"RT050101HDFABC05","autoriza_verificacion_antecedentes":true,"declara_sin_suspensiones":true,"version_terminos_aceptada":2,"terminos_aceptados_en":"2026-07-10T18:00:00Z","marca_terminos":"ruum ruum"}',
    '{"codigo_postal":"01000","estado":"Ciudad de México","ciudad_municipio":"Álvaro Obregón","colonia":"San Ángel","calle":"Prueba","numero":"5"}',
    '{"numero":"LIC-RT05","tipo":"A","vigencia":"2027-07-10"}',
    '{"nombre":"Contacto","telefono":"5500000006"}'
  );
end $$;

select is(
  (select estado::text from public.solicitudes_conductor where auth_user_id = '00000004-0000-4000-8000-000000000001'),
  'documentos_pendientes',
  'RT-06: el expediente autenticado avanza tras completar los datos'
);

select * from finish();

rollback;
