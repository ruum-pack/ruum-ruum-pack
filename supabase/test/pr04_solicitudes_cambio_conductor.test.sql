-- PR-04: Revisión real del perfil del conductor
-- Tests: no sensible → update directo, sensible → solicitud pendiente, aprobación/rechazo, auditoría, vigencia explícita

begin;
select plan(25);

-- Setup: crear conductor de prueba
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-4000-8000-00000000a002',
  'pr04-conductor@local.test',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

insert into public.conductores (id, auth_user_id, nombre, telefono, curp, licencia_numero, licencia_tipo, licencia_vigencia, codigo_postal, estado_residencia, ciudad_municipio, colonia, calle, numero, referencias, contacto_emergencia_nombre, contacto_emergencia_telefono, empresa_id, autoriza_verificacion_antecedentes, declara_sin_suspensiones, estado, estado_expediente)
values (
  '00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000a002',
  'Conductor Prueba PR04',
  '+525512345678',
  'AAAA800101HDFXXX01',
  'LIC12345',
  'B',
  '2030-12-31',
  '01000',
  'CDMX',
  'Cuauhtémoc',
  'Centro',
  'Av Reforma',
  '222',
  'Entre calles',
  'Contacto Emergencia',
  '+525512345679',
  null,
  true,
  true,
  'activo',
  'aprobado'
);

-- Helper para simular auth.uid()
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);

-- 1. Cambio normal (contacto/domicilio) → debe actualizar directo sin crear solicitud
select lives_ok(
  $$ select public.solicitar_cambio_expediente_conductor('{"telefono":"+525512345679","calle":"Nueva calle PR04"}'::jsonb) $$,
  'cambio normal de contacto/domicilio debe permitir actualización directa'
);

select is(
  (select telefono from public.conductores where id = '00000000-0000-4000-8000-00000000a001'),
  '+525512345679',
  'telefono debe haber cambiado directamente sin revisión'
);

select is(
  (select calle from public.conductores where id = '00000000-0000-4000-8000-00000000a001'),
  'Nueva calle PR04',
  'domicilio debe haber cambiado directamente sin revisión'
);

select is(
  (select count(*)::int from public.solicitudes_cambio_conductor where conductor_id = '00000000-0000-4000-8000-00000000a001' and estado = 'pendiente'),
  0,
  'no debe haber solicitud pendiente para cambio no sensible'
);

-- Verificar auditoría de actualización directa
select ok(
  exists (select 1 from public.registro_auditoria where evento = 'actualizacion_perfil_conductor' and actor_id = '00000000-0000-4000-8000-00000000a001'),
  'debe haber registro de auditoría para actualización directa no sensible'
);

-- 2. Cambio sensible (curp) → no modifica valor aprobado, crea solicitud pendiente
select lives_ok(
  $$ select public.solicitar_cambio_expediente_conductor('{"curp":"BBBB800101HDFXXX02"}'::jsonb) $$,
  'cambio sensible curp debe crear solicitud pendiente'
);

select is(
  (select curp from public.conductores where id = '00000000-0000-4000-8000-00000000a001'),
  'AAAA800101HDFXXX01',
  'curp aprobado no debe haber cambiado tras solicitud sensible'
);

select is(
  (select count(*)::int from public.solicitudes_cambio_conductor where conductor_id = '00000000-0000-4000-8000-00000000a001' and estado = 'pendiente' and payload_propuesto->>'curp' = 'BBBB800101HDFXXX02'),
  1,
  'debe existir solicitud pendiente con curp propuesto'
);

-- Auditoría de solicitud creada
select ok(
  exists (select 1 from public.registro_auditoria where evento = 'solicitud_cambio_conductor_creada' and (datos->>'solicitud_id') is not null),
  'debe haber auditoría de solicitud creada'
);

-- 3. licencia_vigencia como sensible explícito (PR-04 requisito)
-- Primero cancelar pendiente anterior para poder crear nueva
update public.solicitudes_cambio_conductor set estado = 'cancelado' where conductor_id = '00000000-0000-4000-8000-00000000a001' and estado = 'pendiente';

select lives_ok(
  $$ select public.solicitar_cambio_expediente_conductor('{"licencia_vigencia":"2031-01-15"}'::jsonb) $$,
  'licencia_vigencia debe ser tratada como sensible y crear solicitud'
);

select is(
  (select licencia_vigencia::text from public.conductores where id = '00000000-0000-4000-8000-00000000a001'),
  '2030-12-31',
  'licencia_vigencia no debe cambiar hasta aprobación'
);

select is(
  (select (payload_propuesto->>'licencia_vigencia') from public.solicitudes_cambio_conductor where conductor_id = '00000000-0000-4000-8000-00000000a001' and estado = 'pendiente' order by creado_en desc limit 1),
  '2031-01-15',
  'payload propuesto debe contener nueva vigencia'
);

-- Cancelar para siguiente prueba
update public.solicitudes_cambio_conductor set estado = 'cancelado' where conductor_id = '00000000-0000-4000-8000-00000000a001' and estado = 'pendiente';

-- 4. No permitir segunda solicitud pendiente
select lives_ok(
  $$ select public.solicitar_cambio_expediente_conductor('{"curp":"CCCC800101HDFXXX03"}'::jsonb) $$,
  'primera solicitud pendiente debe crearse'
);

select throws_ok(
  $$ select public.solicitar_cambio_expediente_conductor('{"curp":"DDDD800101HDFXXX04"}'::jsonb) $$,
  'P0001',
  'Ya tienes una solicitud de cambio pendiente de revision.',
  'segunda solicitud pendiente debe ser rechazada'
);

-- Preparar admin para aprobar/rechazar
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-4000-8000-00000000a011',
  'admin-pr04@test.ruum',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

insert into public.admins (id, auth_user_id, nombre, rol_operativo)
values ('00000000-0000-4000-8000-00000000a010', '00000000-0000-4000-8000-00000000a011', 'Admin Prueba', 'direccion')
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a011', true);

-- Obtener solicitud pendiente
select set_config('pr04.solicitud_id', (select id::text from public.solicitudes_cambio_conductor where conductor_id = '00000000-0000-4000-8000-00000000a001' and estado = 'pendiente' limit 1), true);

-- 5. Admin aprueba → valor cambia
select lives_ok(
  $$ select public.aprobar_solicitud_cambio_conductor(current_setting('pr04.solicitud_id')::uuid) $$,
  'admin debe poder aprobar solicitud pendiente'
);

select is(
  (select curp from public.conductores where id = '00000000-0000-4000-8000-00000000a001'),
  'CCCC800101HDFXXX03',
  'tras aprobación, curp debe haber cambiado al valor propuesto'
);

select is(
  (select estado::text from public.solicitudes_cambio_conductor where id = current_setting('pr04.solicitud_id')::uuid),
  'aprobado',
  'solicitud debe quedar en estado aprobado'
);

select ok(
  exists (select 1 from public.registro_auditoria where evento = 'solicitud_cambio_conductor_aprobada' and actor = 'admin'),
  'debe haber auditoría de aprobación'
);

-- 6. Cambio sensible y admin rechaza → valor anterior permanece
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select lives_ok(
  $$ select public.solicitar_cambio_expediente_conductor('{"licencia_numero":"LIC99999"}'::jsonb) $$,
  'nueva solicitud con licencia_numero'
);
select set_config('pr04.solicitud_id2', (select id::text from public.solicitudes_cambio_conductor where conductor_id = '00000000-0000-4000-8000-00000000a001' and estado = 'pendiente' order by creado_en desc limit 1), true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a011', true);

select lives_ok(
  $$ select public.rechazar_solicitud_cambio_conductor(current_setting('pr04.solicitud_id2')::uuid, 'Documento ilegible, por favor envía foto más nítida') $$,
  'admin debe poder rechazar con motivo >=5 chars'
);

select is(
  (select licencia_numero from public.conductores where id = '00000000-0000-4000-8000-00000000a001'),
  'LIC12345',
  'tras rechazo, licencia_numero debe permanecer con valor anterior aprobado'
);

select is(
  (select estado::text from public.solicitudes_cambio_conductor where id = current_setting('pr04.solicitud_id2')::uuid),
  'rechazado',
  'solicitud debe quedar rechazada'
);

select ok(
  exists (select 1 from public.registro_auditoria where evento = 'solicitud_cambio_conductor_rechazada'),
  'debe haber auditoría de rechazo'
);

-- 7. Rechazo sin motivo suficiente → error
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select lives_ok(
  $$ select public.solicitar_cambio_expediente_conductor('{"curp":"EEEE800101HDFXXX05"}'::jsonb) $$,
  'solicitud para test motivo corto'
);
select set_config('pr04.solicitud_id3', (select id::text from public.solicitudes_cambio_conductor where conductor_id = '00000000-0000-4000-8000-00000000a001' and estado = 'pendiente' order by creado_en desc limit 1), true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a011', true);
select throws_ok(
  $$ select public.rechazar_solicitud_cambio_conductor(current_setting('pr04.solicitud_id3')::uuid, 'bad') $$,
  'P0001',
  'Escribe un motivo de al menos 5 caracteres.',
  'rechazo sin motivo suficiente debe fallar'
);

select * from finish();
rollback;
