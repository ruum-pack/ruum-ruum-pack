-- RT-51 -- FASE 2 equipo empresa: horizontal (1+3+15+4+20 sin límite) y vertical (permisos/RPC/RLS).
create extension if not exists pgtap with schema extensions;
begin;
select plan(16);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('95100000-0000-4000-8000-0000000000ad', 'rt51-admin@local.test', now(), '{}', '{}', now(), now()),
  ('95100000-0000-4000-8000-0000000000b1', 'rt51-owner@local.test', now(), '{}', '{}', now(), now()),
  ('95100000-0000-4000-8000-0000000000b2', 'rt51-viewer@local.test', now(), '{}', '{}', now(), now()),
  ('95100000-0000-4000-8000-0000000000b3', 'rt51-outsider@local.test', now(), '{}', '{}', now(), now()),
  ('95100000-0000-4000-8000-0000000000b4', 'rt51-dispatch@local.test', now(), '{}', '{}', now(), now()),
  ('95100000-0000-4000-8000-0000000000b5', 'rt51-invitado@local.test', now(), '{}', '{}', now(), now()),
  ('95100000-0000-4000-8000-0000000000b6', 'rt51-segundo@local.test', now(), '{}', '{}', now(), now()),
  ('95100000-0000-4000-8000-0000000000c0', 'rt51-owner2@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('95100000-0000-4000-8000-0000000000aa', '95100000-0000-4000-8000-0000000000ad', 'Admin RT-51');

insert into public.empresas (id, nombre)
values
  ('95100000-0000-4000-8000-0000000000e1', 'Empresa RT-51'),
  ('95100000-0000-4000-8000-0000000000e2', 'Empresa Grande RT-51');

-- E1: owner (titular legacy -> valida backfill manual equivalente 2.7) + viewer + dispatcher
insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado, empresa_id)
values
  ('95100000-0000-4000-8000-000000000101', '95100000-0000-4000-8000-0000000000b1', 'empresa', 'titular_empresa', 'verificado', true, '95100000-0000-4000-8000-0000000000e1'),
  ('95100000-0000-4000-8000-000000000102', '95100000-0000-4000-8000-0000000000b2', 'empresa', 'personal', 'verificado', false, '95100000-0000-4000-8000-0000000000e1'),
  ('95100000-0000-4000-8000-0000000000b3', '95100000-0000-4000-8000-0000000000b3', 'personal', 'personal', 'verificado', false, null),
  ('95100000-0000-4000-8000-000000000104', '95100000-0000-4000-8000-0000000000b4', 'empresa', 'personal', 'verificado', false, '95100000-0000-4000-8000-0000000000e1'),
  ('95100000-0000-4000-8000-000000000105', '95100000-0000-4000-8000-0000000000b5', 'personal', 'personal', 'verificado', false, null),
  ('95100000-0000-4000-8000-000000000106', '95100000-0000-4000-8000-0000000000c0', 'empresa', 'titular_empresa', 'verificado', true, '95100000-0000-4000-8000-0000000000e2');

insert into public.empresa_miembros (empresa_id, usuario_id, rol_clave, estado)
values
  ('95100000-0000-4000-8000-0000000000e1', '95100000-0000-4000-8000-000000000101', 'owner', 'activo'),
  ('95100000-0000-4000-8000-0000000000e1', '95100000-0000-4000-8000-000000000102', 'viewer', 'activo'),
  ('95100000-0000-4000-8000-0000000000e1', '95100000-0000-4000-8000-000000000104', 'dispatcher', 'activo'),
  ('95100000-0000-4000-8000-0000000000e2', '95100000-0000-4000-8000-000000000106', 'owner', 'activo');

-- 2.7: el titular equivale a owner (backfill del modelo anterior)
select is(
  (select rol_clave from public.empresa_miembros
   where empresa_id = '95100000-0000-4000-8000-0000000000e1'
     and usuario_id = '95100000-0000-4000-8000-000000000101')::text,
  'owner', 'RT-51.1: titular legacy es owner'
);

-- 2.6: ya no hay límite de 2 (segundo titular con misma empresa inserta OK)
insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado, empresa_id)
values ('95100000-0000-4000-8000-000000000107', '95100000-0000-4000-8000-0000000000b6', 'empresa', 'titular_empresa', 'verificado', false, '95100000-0000-4000-8000-0000000000e1');
select ok(true, 'RT-51.2: segundo titular inserta sin trigger límite');

-- 2.14 HORIZONTAL: E2 con 1 owner + 3 admin + 15 ops + 4 finance + 20 viewer = 43
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('95100000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  'rt51-g' || g || '@local.test', now(), '{}', '{}', now(), now()
from generate_series(1, 42) g;

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado, empresa_id)
select ('95100000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  ('95100000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  'empresa', 'personal', 'verificado', false,
  '95100000-0000-4000-8000-0000000000e2'
from generate_series(1, 42) g;

insert into public.empresa_miembros (empresa_id, usuario_id, rol_clave, estado)
select '95100000-0000-4000-8000-0000000000e2',
  ('95100000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  case when g <= 3 then 'admin'
       when g <= 18 then 'operations_manager'
       when g <= 22 then 'finance'
       else 'viewer' end,
  'activo'
from generate_series(1, 42) g;

select is(
  (select count(*) from public.empresa_miembros where empresa_id = '95100000-0000-4000-8000-0000000000e2')::int,
  43, 'RT-51.3: E2 tiene 43 miembros (1+3+15+4+20)'
);

select is(
  (select string_agg(rol_clave || ':' || n, ',' order by rol_clave) from (
    select rol_clave, count(*)::text as n from public.empresa_miembros
    where empresa_id = '95100000-0000-4000-8000-0000000000e2' group by 1
  ) s)::text,
  'admin:3,finance:4,operations_manager:15,owner:1,viewer:20',
  'RT-51.4: distribución exacta por rol'
);

-- 2.15 VERTICAL: matriz de permisos como owner de E1
set local role authenticated;
select set_config('request.jwt.claim.sub', '95100000-0000-4000-8000-0000000000b1', true);
select ok(public.empresa_tiene_permiso('95100000-0000-4000-8000-0000000000e1', 'team:manage'), 'RT-51.5: owner tiene team:manage');
select ok(public.empresa_tiene_permiso('95100000-0000-4000-8000-0000000000e1', 'billing:manage'), 'RT-51.6: owner tiene billing:manage');
reset role;

-- como viewer de E1
set local role authenticated;
select set_config('request.jwt.claim.sub', '95100000-0000-4000-8000-0000000000b2', true);
select ok(not public.empresa_tiene_permiso('95100000-0000-4000-8000-0000000000e1', 'team:manage'), 'RT-51.7: viewer no tiene team:manage');
select ok(public.empresa_tiene_permiso('95100000-0000-4000-8000-0000000000e1', 'billing:view'), 'RT-51.8: viewer sí tiene billing:view');
select throws_ok(
  $$ select public.empresa_invitar_miembro('95100000-0000-4000-8000-0000000000e1', '95100000-0000-4000-8000-000000000105', 'viewer') $$,
  null, null, 'RT-51.9: viewer no puede invitar'
);
reset role;

-- como dispatcher de E1
set local role authenticated;
select set_config('request.jwt.claim.sub', '95100000-0000-4000-8000-0000000000b4', true);
select ok(public.empresa_tiene_permiso('95100000-0000-4000-8000-0000000000e1', 'driver:assign'), 'RT-51.10: dispatcher asigna conductores');
select ok(not public.empresa_tiene_permiso('95100000-0000-4000-8000-0000000000e1', 'billing:view'), 'RT-51.11: dispatcher no ve facturación');
reset role;

-- como owner: invita (ok), duplica (falla), degrada último owner (falla)
set local role authenticated;
select set_config('request.jwt.claim.sub', '95100000-0000-4000-8000-0000000000b1', true);
select ok(
  (select public.empresa_invitar_miembro('95100000-0000-4000-8000-0000000000e1', '95100000-0000-4000-8000-000000000105', 'finance')) is not null,
  'RT-51.12: owner invita a finance'
);
select throws_ok(
  $$ select public.empresa_invitar_miembro('95100000-0000-4000-8000-0000000000e1', '95100000-0000-4000-8000-000000000105', 'viewer') $$,
  null, null, 'RT-51.13: duplicado rechazado'
);
select throws_ok(
  $$ select public.empresa_cambiar_rol_miembro(
    (select id from public.empresa_miembros where empresa_id = '95100000-0000-4000-8000-0000000000e1' and rol_clave = 'owner'),
    'viewer') $$,
  null, null, 'RT-51.14: último owner no degradable'
);
reset role;

-- RLS: viewer ve su empresa y compañeros; outsider no ve nada
set local role authenticated;
select set_config('request.jwt.claim.sub', '95100000-0000-4000-8000-0000000000b2', true);
select is(
  (select count(*) from public.empresas where id = '95100000-0000-4000-8000-0000000000e1')::int,
  1, 'RT-51.15: viewer ve su empresa'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '95100000-0000-4000-8000-0000000000b3', true);
select is(
  (select count(*) from public.empresas where id = '95100000-0000-4000-8000-0000000000e1')::int,
  0, 'RT-51.16: outsider no ve la empresa'
);
reset role;

select * from finish();
rollback;
