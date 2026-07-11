-- RT-17 / RT-18 — Los cuatro consentimientos legales del conductor se
-- registran como filas independientes, versionadas y con hash demostrable
-- (nunca vía el booleano genérico heredado), el historial es append-only, y
-- authenticated no puede insertarlas directamente (sólo vía RPC).

create extension if not exists pgtap with schema extensions;

begin;

select plan(9);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000007-0000-4000-8000-000000000001', 'rt17@rt17.test', now(), '{}'::jsonb, '{"tipo_registro":"conductor","version_registro":2}'::jsonb, now(), now());

select (select id from public.solicitudes_conductor where auth_user_id = '00000007-0000-4000-8000-000000000001') as solicitud
\gset

-- psql no interpola variables `:'var'` dentro de bloques `do $$ ... $$`, así
-- que se puentea el id de la solicitud vía un GUC de sesión para usarlo ahí.
select set_config('rt17.solicitud', :'solicitud', true);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000007-0000-4000-8000-000000000001', true);
  perform set_config('role', 'authenticated', true);
  perform public.iniciar_solicitud_conductor();
end $$;

select throws_ok(
  format(
    $sql$ insert into public.consentimientos_usuario(auth_user_id,solicitud_id,tipo_documento,version,canal,version_app,hash_documento)
      values(%L,%L,'terminos_servicio',1,'web','fraude',repeat('a',64)) $sql$,
    '00000007-0000-4000-8000-000000000001', :'solicitud'
  ),
  '42501', null,
  'RT-17: authenticated no puede insertar un consentimiento directamente'
);

-- El booleano genérico heredado no sustituye las cuatro evidencias.
do $$ begin
  perform public.guardar_borrador_conductor(
    5::smallint,
    '{"nombre":"Consentimientos RT17","telefono":"+525500000017","curp":"RTCO010101HDFABC07","autoriza_verificacion_antecedentes":true,"declara_sin_suspensiones":true,"acepta_terminos_privacidad":true,"acepta_terminos_servicio":true,"confirma_aviso_privacidad":true,"version_terminos_aceptada":1,"terminos_aceptados_en":"2026-07-10T18:00:00Z"}',
    '{"codigo_postal":"01000","estado":"Ciudad de México","ciudad_municipio":"Álvaro Obregón","colonia":"San Ángel","calle":"Prueba","numero":"17"}',
    '{"numero":"LIC-RT17","tipo":"A","vigencia":"2027-07-10"}',
    '{"nombre":"Contacto","telefono":"5500000018"}'
  );
end $$;

select is(
  (select estado::text from public.solicitudes_conductor where id = :'solicitud'::uuid),
  'datos_incompletos',
  'RT-18: el booleano genérico no hace avanzar la solicitud'
);

do $$ begin
  perform public.registrar_consentimientos_conductor(
    current_setting('rt17.solicitud')::uuid,
    '[
      {"tipo_documento":"terminos_servicio","version":1},
      {"tipo_documento":"autorizacion_antecedentes","version":1},
      {"tipo_documento":"declaracion_suspensiones","version":1}
    ]', 'web', '2.0.0-test'
  );
  perform public.guardar_borrador_conductor(5::smallint, null, null, null, null);
end $$;

select is(
  (select estado::text from public.solicitudes_conductor where id = :'solicitud'::uuid),
  'datos_incompletos',
  'RT-18: no avanza sin el aviso de privacidad'
);

do $$ begin
  perform public.registrar_consentimientos_conductor(
    current_setting('rt17.solicitud')::uuid,
    '[{"tipo_documento":"aviso_privacidad","version":1}]', 'web', '2.0.0-test'
  );
  perform public.guardar_borrador_conductor(5::smallint, null, null, null, null);
end $$;

select is(
  (select estado::text from public.solicitudes_conductor where id = :'solicitud'::uuid),
  'documentos_pendientes',
  'RT-18: avanza con los cuatro consentimientos separados'
);
select is(
  (select count(*) from public.consentimientos_usuario where solicitud_id = :'solicitud'::uuid)::int, 4,
  'RT-17: crea una fila independiente por consentimiento'
);
select is(
  (select count(distinct tipo_documento) from public.consentimientos_usuario where solicitud_id = :'solicitud'::uuid)::int, 4,
  'RT-17: las cuatro filas son de tipos distintos'
);
select ok(
  not exists(
    select 1 from public.consentimientos_usuario c
    join public.versiones_documento_consentimiento d using (tipo_documento, version)
    where c.solicitud_id = :'solicitud'::uuid and (
      c.hash_documento <> d.hash_documento or c.aceptado_en is null
      or c.canal <> 'web' or c.version_app <> '2.0.0-test'
    )
  ),
  'RT-17: versión, hash, fecha, canal y versión de app son demostrables'
);

-- Reintentar la misma aceptación es idempotente y nunca sobrescribe.
do $$ begin
  perform public.registrar_consentimientos_conductor(
    current_setting('rt17.solicitud')::uuid,
    '[
      {"tipo_documento":"terminos_servicio","version":1},
      {"tipo_documento":"aviso_privacidad","version":1}
    ]', 'web', '2.0.0-test'
  );
end $$;

select is(
  (select count(*) from public.consentimientos_usuario where solicitud_id = :'solicitud'::uuid)::int, 4,
  'RT-17: el reintento no duplica ni sobrescribe el historial'
);

do $$ begin
  perform set_config('role', 'postgres', true);
end $$;

select throws_like(
  format(
    $sql$ update public.consentimientos_usuario set version_app='alterada' where id = %L $sql$,
    (select id from public.consentimientos_usuario where solicitud_id = :'solicitud'::uuid limit 1)
  ),
  '%historial de consentimientos es inmutable%',
  'RT-17: bloquea sobrescribir un consentimiento'
);

select * from finish();

rollback;
