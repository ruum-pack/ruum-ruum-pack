-- RT-02 — Inventario de transiciones del expediente/documento de conductor y
-- bloqueo de escrituras administrativas directas (deben pasar por el flujo
-- autorizado: cambiar_estado_expediente_conductor / triggers de documento).

create extension if not exists pgtap with schema extensions;

begin;

select plan(7);

select is(
  (select count(*) from public.expediente_conductor_transiciones)::int, 15,
  'RT-02: hay 15 transiciones de expediente inventariadas'
);
select is(
  (select count(*) from public.documento_conductor_transiciones)::int, 7,
  'RT-02: hay 7 transiciones de documento inventariadas'
);

insert into public.conductores (
  id, nombre, telefono, curp, codigo_postal, estado_residencia, ciudad_municipio,
  colonia, calle, numero, licencia_numero, licencia_tipo, licencia_vigencia,
  autoriza_verificacion_antecedentes, declara_sin_suspensiones,
  contacto_emergencia_nombre, contacto_emergencia_telefono,
  version_terminos_aceptada, terminos_aceptados_en
) values (
  '00000002-0000-4000-8000-000000000001',
  'RT-02 prueba', '+525500000099', 'TEST000000HDFABC09', '01000', 'Ciudad de México',
  'Álvaro Obregón', 'San Ángel', 'Prueba', '1', 'LIC-RT02', 'Tipo A', current_date + 365,
  true, true, 'Contacto Prueba', '5500000098', 1, now()
);

select is(
  (select estado_expediente::text from public.conductores where id = '00000002-0000-4000-8000-000000000001'),
  'borrador',
  'RT-02: un conductor sin Auth inicia como borrador'
);

do $$ begin
  perform public.cambiar_estado_expediente_conductor('00000002-0000-4000-8000-000000000001', 'correo_pendiente');
end $$;

select throws_like(
  $sql$ update public.conductores set estado_expediente = 'datos_incompletos' where id = '00000002-0000-4000-8000-000000000001' $sql$,
  '%flujo autorizado%',
  'RT-02: bloquea la escritura directa del estado de expediente'
);

do $$ begin
  perform public.cambiar_estado_expediente_conductor('00000002-0000-4000-8000-000000000001', 'documentos_pendientes');
end $$;

select throws_like(
  $sql$ select public.cambiar_estado_expediente_conductor('00000002-0000-4000-8000-000000000001', 'aprobado') $sql$,
  '%Transición de expediente no permitida%',
  'RT-02: documentos_pendientes -> aprobado no es una transición válida'
);

insert into public.documentos_conductor (
  id, conductor_id, tipo, nombre_archivo, url, estado
) values (
  '00000002-0000-4000-8000-000000000002', '00000002-0000-4000-8000-000000000001',
  'licencia_frente', 'prueba.pdf', 'rt02/prueba.pdf', 'en_revision'
);

select throws_like(
  $sql$ update public.documentos_conductor set estado = 'aprobado' where id = '00000002-0000-4000-8000-000000000002' $sql$,
  '%flujo autorizado%',
  'RT-02: bloquea la escritura directa del estado de documento'
);

insert into public.documentos_conductor (conductor_id, tipo, nombre_archivo, url, estado) values
  ('00000002-0000-4000-8000-000000000001', 'licencia_reverso', 'reverso.pdf', 'rt02/reverso.pdf', 'en_revision'),
  ('00000002-0000-4000-8000-000000000001', 'identificacion_oficial', 'identificacion.pdf', 'rt02/identificacion.pdf', 'en_revision');

select is(
  (select estado_expediente::text from public.conductores where id = '00000002-0000-4000-8000-000000000001'),
  'en_revision',
  'RT-02: el expediente completo avanza a en_revision'
);

select * from finish();

rollback;
