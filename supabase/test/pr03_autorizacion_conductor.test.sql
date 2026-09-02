-- PR-03 P0/P1 — La autorizacion de conductor se prueba contra la base,
-- incluyendo llamadas directas como authenticated y no solo el flujo de UI.

create extension if not exists pgtap with schema extensions;

begin;

select plan(19);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '93630000-0000-4000-8000-000000000001',
  'pr03-conductor@local.test',
  now(), '{}', '{}', now(), now()
);

insert into public.conductores (id, auth_user_id, nombre, telefono, estado)
values (
  '93630000-0000-4000-8000-000000000101',
  '93630000-0000-4000-8000-000000000001',
  'Conductor PR-03',
  '+525500000001',
  'activo'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '93630000-0000-4000-8000-000000000001', true);

select is(
  has_table_privilege('authenticated', 'public.conductores', 'UPDATE'),
  false,
  'PR-03.1: authenticated no tiene UPDATE de tabla sobre conductores'
);

-- C: nunca se acepta mutacion directa, aunque la sentencia se ejecute sin UI.
select throws_ok(
  $$ update public.conductores set empresa_id = '93630000-0000-4000-8000-000000000201'::uuid where id = '93630000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'PR-03.2: empresa_id no puede modificarse directamente'
);

select throws_ok(
  $$ update public.conductores set estado = estado where id = '93630000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'PR-03.3: estado operativo no puede modificarse directamente'
);

select throws_ok(
  $$ update public.conductores set nivel_por_experiencia = nivel_por_experiencia where id = '93630000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'PR-03.4: nivel no puede modificarse directamente'
);

select throws_ok(
  $$ update public.conductores set certificacion_pago = certificacion_pago where id = '93630000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'PR-03.5: certificacion de pago no puede modificarse directamente'
);

select throws_ok(
  $$ update public.conductores set calificacion_promedio = calificacion_promedio where id = '93630000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'PR-03.6: reputacion no puede modificarse directamente'
);

select throws_ok(
  $$ update public.conductores set traslados_completados = traslados_completados where id = '93630000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'PR-03.7: metricas operativas no pueden modificarse directamente'
);

select throws_ok(
  $$ update public.conductores set documentos_vigentes = documentos_vigentes where id = '93630000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'PR-03.8: flags de validacion no pueden modificarse directamente'
);

select throws_ok(
  $$ update public.conductores set nombre = 'Identidad manipulada' where id = '93630000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'PR-03.9: identidad requiere revision y no puede modificarse directamente'
);

select throws_ok(
  $$ update public.conductores set curp = 'BBBB800101HDFXXX02' where id = '93630000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'PR-03.10: CURP requiere revision y no puede modificarse directamente'
);

select throws_ok(
  $$ update public.conductores set licencia_numero = 'LIC-ALTERADA' where id = '93630000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'PR-03.11: licencia requiere revision y no puede modificarse directamente'
);

select throws_ok(
  $$ select public.solicitar_cambio_expediente_conductor('{"empresa_id":"93630000-0000-4000-8000-000000000201"}'::jsonb) $$,
  '42501', null,
  'PR-03.12: la RPC tambien rechaza empresa_id enviado manualmente'
);

select throws_ok(
  $$ select public.solicitar_cambio_expediente_conductor('{"estado":"suspendido_7d"}'::jsonb) $$,
  '42501', null,
  'PR-03.13: la RPC tambien rechaza estado operativo'
);

-- A: los campos de contacto se actualizan solo por la RPC autorizada.
select is(
  (public.solicitar_cambio_expediente_conductor(
    '{"telefono":"+525500000099","calle":"Calle PR-03"}'::jsonb
  )->>'estado'),
  'actualizado',
  'PR-03.14: la RPC permite cambios normales de contacto/domicilio'
);

select is(
  (select telefono from public.conductores where id = '93630000-0000-4000-8000-000000000101'),
  '+525500000099',
  'PR-03.15: telefono normal queda actualizado'
);

select is(
  (select calle from public.conductores where id = '93630000-0000-4000-8000-000000000101'),
  'Calle PR-03',
  'PR-03.16: domicilio normal queda actualizado'
);

-- B: la identidad no se sobrescribe; se genera revision.
select is(
  (public.solicitar_cambio_expediente_conductor(
    '{"curp":"BBBB800101HDFXXX02"}'::jsonb
  )->>'estado'),
  'pendiente',
  'PR-03.17: CURP se distingue como cambio sensible pendiente'
);

select is(
  (select curp from public.conductores where id = '93630000-0000-4000-8000-000000000101'),
  null::text,
  'PR-03.18: CURP aprobada no cambia antes de revision'
);

reset role;

select ok(
  exists (
    select 1
      from public.registro_auditoria
     where evento = 'actualizacion_perfil_conductor'
       and actor_id = '93630000-0000-4000-8000-000000000101'
       and datos->>'tipo' = 'normal'
       and datos->'campos' ? 'telefono'
  ),
  'PR-03.19: el cambio normal queda auditado sin guardar valores PII'
);

select * from finish();
rollback;
