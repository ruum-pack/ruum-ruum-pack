-- RT-48 -- La competencia asigna una sola vez usando prioridad de puntualidad
-- antes que equidad, congela el pago y deja trazabilidad.

create extension if not exists pgtap with schema extensions;

begin;

select plan(8);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('94800000-0000-4000-8000-000000000001', 'rt48-usuario@local.test', now(), '{}', '{}', now(), now()),
  ('94800000-0000-4000-8000-000000000002', 'rt48-conductor-a@local.test', now(), '{}', '{}', now(), now()),
  ('94800000-0000-4000-8000-000000000003', 'rt48-conductor-b@local.test', now(), '{}', '{}', now(), now());

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values ('94800000-0000-4000-8000-000000000101', '94800000-0000-4000-8000-000000000001', 'personal', 'personal', 'verificado', true);

insert into public.vehiculos (
  id, usuario_id, tipo, marca, modelo, anio, placas,
  tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando
)
values (
  '94800000-0000-4000-8000-000000000201', '94800000-0000-4000-8000-000000000101',
  'sedan', 'RT48', 'Modelo', 2026, 'RT48ABC', true, true, true, true
);

insert into public.traslados (
  id, estado, usuario_id, vehiculo_id,
  contacto_entrega_nombre, contacto_entrega_telefono,
  contacto_recepcion_nombre, contacto_recepcion_telefono,
  origen_lat, origen_lng, origen_direccion, origen_ciudad,
  destino_lat, destino_lng, destino_direccion, destino_ciudad,
  precio_cotizado, tipo_pago, clave_idempotencia
)
values (
  '94800000-0000-4000-8000-000000000301', 'pendiente_de_conductor',
  '94800000-0000-4000-8000-000000000101', '94800000-0000-4000-8000-000000000201',
  'Entrega RT48', '+525500000001', 'Recepcion RT48', '+525500000002',
  19.4326, -99.1332, 'Origen RT48', 'CDMX',
  19.5000, -99.2000, 'Destino RT48', 'CDMX',
  1500, 'al_cierre', gen_random_uuid()
);

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;

insert into public.conductores (
  id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes,
  nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio, certificacion_pago
)
values
  ('94800000-0000-4000-8000-000000000401', '94800000-0000-4000-8000-000000000002',
   'Conductor B RT48', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar'),
  ('94800000-0000-4000-8000-000000000402', '94800000-0000-4000-8000-000000000003',
   'Conductor A RT48', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar');

alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

select is(
  (select count(*) from public.competencias_asignacion where traslado_id = '94800000-0000-4000-8000-000000000301')::int,
  1,
  'RT-48.1: entrar a pendiente abre exactamente una competencia'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '94800000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$ select public.conductor_solicita_asignacion('94800000-0000-4000-8000-000000000301', 19.43, -99.13) $$,
  'RT-48.2: primer conductor registra solicitud'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '94800000-0000-4000-8000-000000000003', true);
select lives_ok(
  $$ select public.conductor_solicita_asignacion('94800000-0000-4000-8000-000000000301', 19.44, -99.14) $$,
  'RT-48.3: segundo conductor registra solicitud durante la misma ventana'
);

reset role;

select is(
  (select count(*) from public.solicitudes_asignacion where traslado_id = '94800000-0000-4000-8000-000000000301')::int,
  2,
  'RT-48.4: ambas solicitudes compiten antes del cierre'
);

-- Fijamos snapshots controlados para aislar y probar el orden del resolvedor:
-- la categoría A debe ganar aunque tenga más asignaciones recientes.
update public.solicitudes_asignacion
set categoria_puntualidad = case
      when conductor_id = '94800000-0000-4000-8000-000000000402' then 'a'
      else 'b'
    end,
    asignaciones_7d = case
      when conductor_id = '94800000-0000-4000-8000-000000000402' then 9
      else 0
    end;

update public.competencias_asignacion
set abierta_en = now() - interval '2 seconds',
    cierra_en = now() - interval '1 second'
where traslado_id = '94800000-0000-4000-8000-000000000301';

select is(
  (public.procesar_competencias_asignacion()->>'asignadas')::int,
  1,
  'RT-48.5: el procesador adjudica una sola competencia vencida'
);

select is(
  (select conductor_id from public.traslados where id = '94800000-0000-4000-8000-000000000301'),
  '94800000-0000-4000-8000-000000000402'::uuid,
  'RT-48.6: puntualidad A prevalece sobre menor carga B'
);

select ok(
  (select ganancia_conductor_congelada is not null and ganancia_conductor_congelada > 0
   from public.traslados where id = '94800000-0000-4000-8000-000000000301'),
  'RT-48.7: la asignación congela la ganancia del ganador'
);

select is(
  (select count(*) from public.registro_auditoria
   where traslado_id = '94800000-0000-4000-8000-000000000301'
     and evento = 'asignacion_conductor')::int,
  1,
  'RT-48.8: la adjudicación genera una sola evidencia de auditoría'
);

select * from finish();

rollback;
