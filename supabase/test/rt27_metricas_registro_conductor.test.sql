-- RT-27: telemetría mínima, privacidad, inmutabilidad y resumen administrativo.

create extension if not exists pgtap with schema extensions;

begin;

select plan(6);

insert into auth.users(id,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,aud,role) values
('92700000-0000-4000-8000-000000000001','rt27-conductor@ruum.test','x',now(),'{}','{}','authenticated','authenticated'),
('92700000-0000-4000-8000-0000000000ad','rt27-admin@ruum.test','x',now(),'{}','{}','authenticated','authenticated');

insert into public.admins(id,auth_user_id,nombre) values
('92700000-0000-4000-8000-000000000aad','92700000-0000-4000-8000-0000000000ad','Admin RT27');

insert into public.solicitudes_conductor(
  id,auth_user_id,estado,paso_actual,creado_en,actualizado_en,version_registro,origen_modelo
) values(
  '92700000-0000-4000-8000-000000000010',
  '92700000-0000-4000-8000-000000000001',
  'datos_incompletos',3,now()-interval '72 hours',now()-interval '48 hours',2,'v2_minimo'
);

insert into public.documentos_conductor(
  id,solicitud_id,tipo,nombre_archivo,url,estado,version,es_actual,revisado_por,revisado_en,motivo_rechazo
) values(
  '92700000-0000-4000-8000-000000000020',
  '92700000-0000-4000-8000-000000000010',
  'licencia_frente','licencia.jpg',
  '92700000-0000-4000-8000-000000000001/92700000-0000-4000-8000-000000000010/licencia_frente/licencia.jpg',
  'rechazado',1,true,'92700000-0000-4000-8000-000000000aad',now()-interval '2 hours','Documento ilegible.'
);

insert into public.historial_estados_solicitud_conductor(
  solicitud_id,documento_id,revisado_por,decision,motivo,estado_anterior,estado_nuevo,revisado_en
) values(
  '92700000-0000-4000-8000-000000000010',
  '92700000-0000-4000-8000-000000000020',
  '92700000-0000-4000-8000-000000000aad',
  'rechazar_documento','Documento ilegible.','datos_incompletos','datos_incompletos',now()-interval '2 hours'
);

-- 1. Anónimo: puede registrar un código acotado, pero no leer la tabla.
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select public.registrar_evento_registro_conductor(
  '92700000-0000-4000-8000-000000000100','otp_error',1::smallint,'otp_expirado',1200
);

select throws_ok(
  $sql$ select * from public.eventos_registro_conductor limit 1 $sql$,
  'RT-27.1: anónimo no puede leer telemetría'
);
reset role;

-- 2. Conductor: el servidor vincula auth.uid y solicitud; no acepta texto libre/PII.
set local role authenticated;
select set_config('request.jwt.claim.sub','92700000-0000-4000-8000-000000000001',true);
select public.registrar_evento_registro_conductor(
  '92700000-0000-4000-8000-000000000100','rpc_error',3::smallint,'guardar_borrador',800
);

select throws_ok(
  $sql$ select public.registrar_evento_registro_conductor('92700000-0000-4000-8000-000000000100','rpc_error',3::smallint,'correo@personal.test',800) $sql$,
  'RT-27.2: rechaza código de telemetría no sanitizado'
);
reset role;

-- 3. Inmutabilidad y vinculación de eventos
select is(
  (select count(*)::int from public.eventos_registro_conductor where sesion_id='92700000-0000-4000-8000-000000000100'),
  2,
  'RT-27.3: se registraron exactamente 2 eventos en la sesión'
);

select throws_ok(
  $sql$ update public.eventos_registro_conductor set codigo='alterado' where sesion_id='92700000-0000-4000-8000-000000000100' $sql$,
  'RT-27.4: la telemetría es append-only e inmutable'
);

-- 4. Un conductor no puede consultar el agregado administrativo.
set local role authenticated;
select set_config('request.jwt.claim.sub','92700000-0000-4000-8000-000000000001',true);

select throws_ok(
  $sql$ select public.obtener_metricas_registro_conductor(current_date-7,current_date) $sql$,
  'RT-27.5: conductor no puede consultar métricas administrativas'
);
reset role;

-- 5. Administrador: recibe todos los indicadores requeridos.
set local role authenticated;
select set_config('request.jwt.claim.sub','92700000-0000-4000-8000-0000000000ad',true);

select ok(
  (public.obtener_metricas_registro_conductor(current_date-7,current_date)->>'errores_otp')::integer = 1,
  'RT-27.6: administrador recibe resumen métrico completo'
);
reset role;

select * from finish();

rollback;
