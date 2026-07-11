-- RT-23 / RT-24 — Las decisiones de Torre de Control se ejecutan por RPC,
-- registran actor/motivo/transición y el historial no puede reescribirse.

create extension if not exists pgtap with schema extensions;

begin;

select plan(6);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('71111111-1111-4111-8111-111111111111', 'rt24-admin@local.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('74444444-4444-4444-8444-444444444441', 'rt24-rechazo@local.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('74444444-4444-4444-8444-444444444442', 'rt24-aprobacion@local.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('74444444-4444-4444-8444-444444444443', 'rt24-documento@local.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('72222222-2222-4222-8222-222222222222', '71111111-1111-4111-8111-111111111111', 'Admin RT-24');

do $$ begin
  perform set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
end $$;

-- Rechazo final.
insert into public.solicitudes_conductor (id, auth_user_id, estado, enviado_en)
values ('73333333-3333-4333-8333-333333333331', '74444444-4444-4444-8444-444444444441', 'en_revision', now());

do $$ begin
  perform public.rechazar_solicitud_conductor_admin(
    '73333333-3333-4333-8333-333333333331', 'La identidad no coincide con el expediente.'
  );
end $$;

select ok(
  exists(
    select 1 from public.historial_estados_solicitud_conductor
    where solicitud_id = '73333333-3333-4333-8333-333333333331'
      and decision = 'rechazar_solicitud'
      and revisado_por = '72222222-2222-4222-8222-222222222222'
      and estado_anterior = 'en_revision' and estado_nuevo = 'rechazado'
      and motivo = 'La identidad no coincide con el expediente.'
  ),
  'RT-24: el rechazo final queda atribuido y trazado'
);

-- Aprobación final con documentos actuales y los cuatro consentimientos.
insert into public.solicitudes_conductor (
  id, auth_user_id, estado, paso_actual, datos_personales, domicilio, licencia, contacto_emergencia, enviado_en, version_registro, origen_modelo
) values (
  '73333333-3333-4333-8333-333333333332', '74444444-4444-4444-8444-444444444442', 'en_revision', 5,
  '{"nombre":"Conductor RT24","telefono":"5512345678","curp":"AAAA000101HDFBBB01"}',
  '{"codigo_postal":"01000","estado":"Ciudad de México","ciudad_municipio":"Álvaro Obregón","colonia":"San Ángel","calle":"Prueba","numero":"24"}',
  '{"numero":"LICRT24001","tipo":"A","vigencia":"2030-12-31"}',
  '{"nombre":"Contacto RT24","telefono":"5587654321"}', now(), 2, 'v2_minimo'
);
insert into public.documentos_conductor (id, solicitud_id, tipo, nombre_archivo, url, estado, version, es_actual) values
  ('75000000-0000-4000-8000-000000000001', '73333333-3333-4333-8333-333333333332', 'licencia_frente', 'frente.jpg', 'rt24/frente.jpg', 'aprobado', 1, true),
  ('75000000-0000-4000-8000-000000000002', '73333333-3333-4333-8333-333333333332', 'licencia_reverso', 'reverso.jpg', 'rt24/reverso.jpg', 'aprobado', 1, true),
  ('75000000-0000-4000-8000-000000000003', '73333333-3333-4333-8333-333333333332', 'identificacion_oficial', 'id.jpg', 'rt24/id.jpg', 'aprobado', 1, true);
insert into public.consentimientos_usuario (auth_user_id, solicitud_id, tipo_documento, version, canal, version_app, hash_documento)
select '74444444-4444-4444-8444-444444444442', '73333333-3333-4333-8333-333333333332',
  tipo_documento, version, 'web', 'test-rt24', hash_documento
from public.versiones_documento_consentimiento where vigente_hasta is null;

do $$ begin
  perform public.aprobar_solicitud_conductor_admin(
    '73333333-3333-4333-8333-333333333332', 'Expediente completo validado por Torre de Control.'
  );
end $$;

select ok(
  exists(
    select 1 from public.solicitudes_conductor s
    join public.conductores c on c.id = s.conductor_id
    where s.id = '73333333-3333-4333-8333-333333333332'
      and s.estado = 'aprobado' and c.estado_expediente = 'aprobado' and c.estado = 'activo'
  ),
  'RT-24: la aprobación materializa un conductor activo'
);
select ok(
  exists(
    select 1 from public.historial_estados_solicitud_conductor
    where solicitud_id = '73333333-3333-4333-8333-333333333332'
      and decision = 'aprobar_solicitud'
      and revisado_por = '72222222-2222-4222-8222-222222222222'
      and estado_anterior = 'en_revision' and estado_nuevo = 'aprobado'
  ),
  'RT-24: la aprobación queda atribuida y trazada'
);

-- Rechazo documental y solicitud de corrección son eventos distinguibles.
insert into public.solicitudes_conductor (id, auth_user_id, estado, enviado_en)
values ('73333333-3333-4333-8333-333333333333', '74444444-4444-4444-8444-444444444443', 'en_revision', now());
insert into public.documentos_conductor (id, solicitud_id, tipo, nombre_archivo, url, estado, version, es_actual)
values ('75000000-0000-4000-8000-000000000004', '73333333-3333-4333-8333-333333333333', 'licencia_frente', 'borrosa.jpg', 'rt24/borrosa.jpg', 'en_revision', 1, true);

do $$ begin
  perform public.revisar_documento_conductor_admin(
    '75000000-0000-4000-8000-000000000004', 'rechazado', 'La imagen no permite leer el número de licencia.'
  );
end $$;

select is(
  (select estado::text from public.solicitudes_conductor where id = '73333333-3333-4333-8333-333333333333'),
  'requiere_correccion',
  'RT-24: el rechazo documental solicita corrección'
);
select is(
  (select count(*) from public.historial_estados_solicitud_conductor
    where solicitud_id = '73333333-3333-4333-8333-333333333333'
      and decision in ('rechazar_documento', 'solicitar_correccion'))::int,
  2,
  'RT-24: hay eventos diferenciados para documento y expediente'
);

select throws_like(
  format(
    $sql$ update public.historial_estados_solicitud_conductor set motivo='Manipulado' where id = %L $sql$,
    (select id from public.historial_estados_solicitud_conductor where solicitud_id = '73333333-3333-4333-8333-333333333333' limit 1)
  ),
  '%historial de decisiones es inmutable%',
  'RT-24: el historial no permite modificaciones'
);

select * from finish();

rollback;
