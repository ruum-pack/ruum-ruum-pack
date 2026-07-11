-- RT-08 / RT-09 / RT-10 / RT-11 — `iniciar_solicitud_conductor` es idempotente,
-- `guardar_borrador_conductor` persiste por sección, y `enviar_solicitud_conductor`
-- valida documentos/vigencia de licencia atómicamente en el servidor (sin
-- depender de que el cliente haga polling) y bloquea cambios tras el envío.

create extension if not exists pgtap with schema extensions;

begin;

select plan(15);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000005-0000-4000-8000-000000000001', 'rt08@rt08.test', now(), '{}'::jsonb, '{"tipo_registro":"conductor","version_registro":2}'::jsonb, now(), now());

-- La idempotencia de iniciar_solicitud_conductor sólo es observable
-- comparando dos invocaciones reales; se capturan vía GUCs de sesión para
-- poder aserverlas como sentencias TAP de nivel superior.
do $$
declare r1 record; r2 record;
begin
  perform set_config('request.jwt.claim.sub', '00000005-0000-4000-8000-000000000001', true);
  perform set_config('role', 'authenticated', true);

  select * into r1 from public.iniciar_solicitud_conductor();
  select * into r2 from public.iniciar_solicitud_conductor();

  perform set_config('rt08.solicitud_id', r1.solicitud_id::text, true);
  perform set_config('rt08.r2_solicitud_id', r2.solicitud_id::text, true);
  perform set_config('rt08.r2_estado', r2.estado::text, true);
end $$;

select ok(current_setting('rt08.solicitud_id', true) is not null, 'RT-08: iniciar crea una solicitud');
select is(
  current_setting('rt08.solicitud_id'), current_setting('rt08.r2_solicitud_id'),
  'RT-08: iniciar es idempotente (misma solicitud en la segunda llamada)'
);
select is(
  (select count(*) from public.solicitudes_conductor where auth_user_id = '00000005-0000-4000-8000-000000000001')::int, 1,
  'RT-08: iniciar no crea solicitudes duplicadas'
);
select is(current_setting('rt08.r2_estado'), 'datos_incompletos', 'RT-08: el estado inicial es datos_incompletos');

do $$ begin
  perform public.registrar_consentimientos_conductor(
    current_setting('rt08.solicitud_id')::uuid,
    '[
      {"tipo_documento":"terminos_servicio","version":1},
      {"tipo_documento":"aviso_privacidad","version":1},
      {"tipo_documento":"autorizacion_antecedentes","version":1},
      {"tipo_documento":"declaracion_suspensiones","version":1}
    ]', 'web', 'test-rt08'
  );
  -- Guardado por sección: primero datos personales incompletos.
  perform public.guardar_borrador_conductor(
    1::smallint,
    '{"nombre":"Conductor RPC","telefono":"+525500000008","curp":"ABCD010101HDFEFG09","autoriza_verificacion_antecedentes":true,"declara_sin_suspensiones":true,"acepta_terminos_privacidad":true,"version_terminos_aceptada":2,"terminos_aceptados_en":"2026-07-10T18:00:00Z"}',
    null, null, null
  );
end $$;

select is(
  (select paso_actual::int from public.solicitudes_conductor where id = current_setting('rt08.solicitud_id')::uuid), 1,
  'RT-09: guarda paso_actual'
);

-- Completar las secciones conserva la primera y deja el expediente listo para documentos.
do $$
declare r2 record;
begin
  perform public.guardar_borrador_conductor(
    5::smallint, null,
    '{"codigo_postal":"01000","estado":"Ciudad de México","ciudad_municipio":"Álvaro Obregón","colonia":"San Ángel","calle":"Prueba","numero":"8"}',
    '{"numero":"LIC-RT08","tipo":"A","vigencia":"2027-07-10"}',
    '{"nombre":"Contacto","telefono":"5500000009"}'
  );
  select * into r2 from public.iniciar_solicitud_conductor();
  perform set_config('rt08.r2_paso_actual', r2.paso_actual::text, true);
  perform set_config('rt08.r2_estado', r2.estado::text, true);
end $$;

select is(current_setting('rt08.r2_paso_actual'), '5', 'RT-09: el borrador sobrevive al reingreso (paso_actual)');
select is(current_setting('rt08.r2_estado'), 'documentos_pendientes', 'RT-09: el borrador sobrevive al reingreso (estado)');
select is(
  (select datos_personales->>'curp' from public.solicitudes_conductor where id = current_setting('rt08.solicitud_id')::uuid),
  'ABCD010101HDFEFG09',
  'RT-09: la primera sección persiste tras completar las demás'
);

select throws_like(
  $sql$ select * from public.enviar_solicitud_conductor() $sql$,
  '%documentos obligatorios%',
  'RT-10: rechaza enviar sin documentos obligatorios'
);

-- Fixture interno: desde RT-13 el rol authenticated ya no puede insertar
-- documentos directamente; la carga real usa registrar_documento_conductor.
do $$ begin
  perform set_config('role', 'postgres', true);
  insert into public.documentos_conductor (solicitud_id, tipo, nombre_archivo, url, estado) values
    (current_setting('rt08.solicitud_id')::uuid, 'licencia_frente', 'frente.pdf', 'rt08/frente.pdf', 'en_revision'),
    (current_setting('rt08.solicitud_id')::uuid, 'licencia_reverso', 'reverso.pdf', 'rt08/reverso.pdf', 'en_revision'),
    (current_setting('rt08.solicitud_id')::uuid, 'identificacion_oficial', 'id.pdf', 'rt08/id.pdf', 'en_revision');
  perform set_config('role', 'authenticated', true);
end $$;

select is(
  (select estado::text from public.solicitudes_conductor where id = current_setting('rt08.solicitud_id')::uuid),
  'documentos_pendientes',
  'RT-10: cargar documentos no envía la solicitud automáticamente'
);

-- Vigencia se comprueba de nuevo en servidor al enviar.
do $$ begin
  perform public.guardar_borrador_conductor(5::smallint, null, null, '{"numero":"LIC-RT08","tipo":"A","vigencia":"2020-01-01"}', null);
end $$;

select throws_like(
  $sql$ select * from public.enviar_solicitud_conductor() $sql$,
  '%licencia está vencida%',
  'RT-10: rechaza una licencia vencida al enviar'
);

do $$
declare r2 record;
begin
  perform public.guardar_borrador_conductor(5::smallint, null, null, '{"numero":"LIC-RT08","tipo":"A","vigencia":"2027-07-10"}', null);
  select * into r2 from public.enviar_solicitud_conductor();
  perform set_config('rt08.r2_estado', r2.estado::text, true);
end $$;

select is(current_setting('rt08.r2_estado'), 'en_revision', 'RT-10: el envío atómico finaliza en revisión');
select ok(
  (select enviado_en from public.solicitudes_conductor where id = current_setting('rt08.solicitud_id')::uuid) is not null,
  'RT-10: el envío registra enviado_en'
);

select throws_like(
  $sql$ select public.guardar_borrador_conductor(5::smallint,'{"nombre":"Alterado"}'::jsonb,null,null,null) $sql$,
  '%ya no admite cambios%',
  'RT-10: bloquea modificar el borrador después del envío'
);

-- La auditoría del envío se revisa con privilegios elevados (RLS de
-- registro_auditoria no expone el historial a authenticated).
do $$ begin
  perform set_config('role', 'postgres', true);
end $$;

select ok(
  exists(
    select 1 from public.registro_auditoria
    where actor_id = current_setting('rt08.solicitud_id')::uuid
      and evento = 'validacion_documentos'
      and datos->>'accion' = 'envio_solicitud_conductor'
  ),
  'RT-10/11: el envío queda registrado en la auditoría'
);

select * from finish();

rollback;
