-- RT-47 -- Métricas oficiales de registro de conductores.

create extension if not exists pgtap with schema extensions;

begin;

select plan(9);

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('94700000-0000-4000-8000-000000000001','rt47-admin@ruum.test',now(),'{}','{}',now(),now()),
('94700000-0000-4000-8000-000000000002','rt47-driver@ruum.test',now(),'{}','{}',now(),now()),
('94700000-0000-4000-8000-000000000003','rt47-driver-prev@ruum.test',now(),'{}','{}',now(),now()),
('94700000-0000-4000-8000-000000000004','rt47-driver-abandono@ruum.test',now(),'{}','{}',now(),now());

insert into public.admins(id,auth_user_id,nombre,rol_operativo)
values('94700000-0000-4000-8000-000000000101','94700000-0000-4000-8000-000000000001','Admin RT47','supervisor');

insert into public.solicitudes_conductor(
  id,auth_user_id,estado,paso_actual,creado_en,actualizado_en,enviado_en,version_registro,origen_modelo,domicilio
) values
('94700000-0000-4000-8000-000000000201','94700000-0000-4000-8000-000000000002','en_revision',5,current_date::timestamptz + interval '8 hours',current_date::timestamptz + interval '10 hours',current_date::timestamptz + interval '10 hours',2,'v2_minimo','{"estado":"CDMX"}'::jsonb),
('94700000-0000-4000-8000-000000000202','94700000-0000-4000-8000-000000000004','datos_incompletos',3,current_date::timestamptz - interval '2 days',current_date::timestamptz - interval '30 hours',null,2,'v2_minimo','{"estado":"CDMX"}'::jsonb),
('94700000-0000-4000-8000-000000000203','94700000-0000-4000-8000-000000000003','en_revision',5,current_date::timestamptz - interval '8 days',current_date::timestamptz - interval '7 days',current_date::timestamptz - interval '7 days',2,'v2_minimo','{"estado":"Jalisco"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub','94700000-0000-4000-8000-000000000002',true);

select public.registrar_evento_registro_conductor_v2('94700000-0000-4000-8000-000000000301'::uuid,'registro_iniciado',1::smallint,'inicio',100::integer,'CDMX','web-organico',null::uuid,current_date::timestamptz + interval '8 hours');
select public.registrar_evento_registro_conductor_v2('94700000-0000-4000-8000-000000000301'::uuid,'solicitud_enviada',5::smallint,'envio',100::integer,'CDMX','web-organico',null::uuid,current_date::timestamptz + interval '10 hours');
select public.registrar_evento_registro_conductor_v2('94700000-0000-4000-8000-000000000301'::uuid,'otp_error',1::smallint,'otp_expirado',100::integer,'CDMX','web-organico',null::uuid,current_date::timestamptz + interval '9 hours');
select public.registrar_evento_registro_conductor_v2('94700000-0000-4000-8000-000000000301'::uuid,'otp_error',1::smallint,'otp_expirado',100::integer,'CDMX','web-organico',null::uuid,current_date::timestamptz + interval '9 hours');

select set_config('request.jwt.claim.sub','94700000-0000-4000-8000-000000000003',true);
select public.registrar_evento_registro_conductor_v2('94700000-0000-4000-8000-000000000302'::uuid,'registro_iniciado',1::smallint,'inicio',100::integer,'CDMX','web-organico',null::uuid,current_date::timestamptz - interval '7 days');
select public.registrar_evento_registro_conductor_v2('94700000-0000-4000-8000-000000000302'::uuid,'solicitud_enviada',5::smallint,'envio',100::integer,'Jalisco','referido',null::uuid,current_date::timestamptz - interval '7 days');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','94700000-0000-4000-8000-000000000001',true);

select public.obtener_metricas_registro_conductor_v2(current_date-6,current_date) as metricas \gset

select is((:'metricas'::jsonb#>>'{metricas,solicitudes_iniciadas}')::int,1,'RT-47.1: solicitudes iniciadas exactas');
select is((:'metricas'::jsonb#>>'{metricas,solicitudes_enviadas}')::int,1,'RT-47.2: solicitudes enviadas exactas');
select is((:'metricas'::jsonb#>>'{metricas,errores_otp}')::int,2,'RT-47.3: errores OTP exactos');
select is((:'metricas'::jsonb#>>'{metricas,eventos_duplicados}')::int,1,'RT-47.4: detecta duplicados por ventana operacional');
select ok(jsonb_array_length(:'metricas'::jsonb->'detalle') >= 8,'RT-47.5: devuelve detalle con formulas oficiales');
select ok(jsonb_array_length(:'metricas'::jsonb#>'{segmentos,zona}') >= 1,'RT-47.6: devuelve segmentacion por zona');
select is((:'metricas'::jsonb#>>'{comparacion,metricas,solicitudes_iniciadas}')::int,1,'RT-47.7: calcula periodo anterior comparable');
select ok(:'metricas'::jsonb ? 'calidad_datos','RT-47.8: incluye calidad de datos tardios/duplicados');
select ok(exists(select 1 from public.auditoria_admin_seguridad where recurso='metricas_registro_conductor' and accion='obtener_v2'),'RT-47.9: audita consulta de metricas');

rollback;
