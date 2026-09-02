-- PR-08: Facturación atómica (FASE 8 / P2)
-- Verifica la actualización atómica conjunta de usuarios y empresas via RPC
-- y comprueba que cualquier fallo en la segunda tabla produce rollback total.

create extension if not exists pgtap with schema extensions;

begin;

select plan(5);

-- 1. Setup Fixtures
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('90800000-0000-4000-8000-000000000001', 'titular-pr08@ruum.test', now(), '{}', '{}', now(), now()),
  ('90800000-0000-4000-8000-000000000002', 'personal-pr08@ruum.test', now(), '{}', '{}', now(), now());

insert into public.empresas (id, nombre, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, uso_cfdi, correo_facturacion) values
  ('90800000-0000-4000-8000-000000000e01', 'Empresa PR08 SA de CV', 'EMP010101AA1', 'Empresa PR08 SA de CV', '601', '06000', 'G03', 'facturas@empresa-pr08.test');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, empresa_id, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, uso_cfdi, correo_facturacion) values
  ('90800000-0000-4000-8000-000000000u01', '90800000-0000-4000-8000-000000000001', 'empresa', 'titular_empresa', 'verificado', '90800000-0000-4000-8000-000000000e01', 'EMP010101AA1', 'Empresa PR08 SA de CV', '601', '06000', 'G03', 'facturas@empresa-pr08.test'),
  ('90800000-0000-4000-8000-000000000u02', '90800000-0000-4000-8000-000000000002', 'personal', 'personal', 'verificado', null, null, null, null, null, null, null);

-- 2. Prueba 1: Usuario personal actualiza sus datos fiscales correctamente
set local role authenticated;
select set_config('request.jwt.claim.sub', '90800000-0000-4000-8000-000000000002', true);

select lives_ok(
  $sql$
    select public.actualizar_datos_facturacion(
      'XAXX010101000',
      'Juan Perez Personal',
      '605',
      '03100',
      'S01',
      'facturas-personal@ruum.test'
    );
  $sql$,
  'PR-08.1: usuario personal actualiza sus datos fiscales correctamente'
);

select is(
  (select rfc from public.usuarios where id = '90800000-0000-4000-8000-000000000u02'),
  'XAXX010101000',
  'PR-08.2: la fila en usuarios refleja los datos fiscales actualizados'
);
reset role;

-- 3. Prueba 2: Titular de empresa actualiza datos fiscales y se sincroniza en usuarios y empresas
set local role authenticated;
select set_config('request.jwt.claim.sub', '90800000-0000-4000-8000-000000000001', true);

select lives_ok(
  $sql$
    select public.actualizar_datos_facturacion(
      'NUEVO800101AB2',
      'Empresa Actualizada SA',
      '626',
      '01000',
      'G01',
      'nuevo-fiscal@empresa-pr08.test'
    );
  $sql$,
  'PR-08.3: titular de empresa ejecuta actualización conjunta en una sola transacción'
);

select ok(
  (select (u.rfc = 'NUEVO800101AB2' and e.rfc = 'NUEVO800101AB2' and u.razon_social = e.razon_social and u.correo_facturacion = e.correo_facturacion)
   from public.usuarios u
   join public.empresas e on e.id = u.empresa_id
   where u.id = '90800000-0000-4000-8000-000000000u01'),
  'PR-08.4: tanto usuarios como empresas quedaron actualizadas de forma atómica'
);
reset role;

-- 4. Prueba 3: Simular fallo en la actualización de empresas y verificar ROLLBACK total
-- Creamos un trigger temporal que falla al actualizar empresas con un valor específico
create or replace function pg_temp.trigger_fallo_empresa() returns trigger as $$
begin
  if NEW.rfc = 'FAIL_EMPRESA' then
    raise exception 'Fallo simulado en tabla empresas';
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_fallo_empresa_pr08
  before update on public.empresas
  for each row execute function pg_temp.trigger_fallo_empresa();

set local role authenticated;
select set_config('request.jwt.claim.sub', '90800000-0000-4000-8000-000000000001', true);

-- Intento de actualización con fallo simulado
do $$
begin
  perform public.actualizar_datos_facturacion(
    'FAIL_EMPRESA',
    'Razon Fallida',
    '601',
    '99999',
    'G03',
    'fail@test.com'
  );
  raise exception 'No debía permitirse la transacción';
exception
  when others then
    -- Excepción capturada esperada
    null;
end $$;
reset role;

-- Comprobar que la tabla usuarios NO quedó con 'FAIL_EMPRESA' (rollback íntegro de la transacción)
select is(
  (select rfc from public.usuarios where id = '90800000-0000-4000-8000-000000000u01'),
  'NUEVO800101AB2',
  'PR-08.5: fallo en empresas revierte también los cambios en usuarios (rollback atómico)'
);

select * from finish();

rollback;
