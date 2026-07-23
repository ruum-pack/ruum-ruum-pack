-- RT-45 -- Empresas: RFC formal, duplicados, versionado y aprobacion.

create extension if not exists pgtap with schema extensions;

begin;

select plan(10);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('94500000-0000-4000-8000-0000000000ad', 'rt45-admin@rt45.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('94500000-0000-4000-8000-0000000000b1', 'rt45-titular@rt45.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.admins (id, auth_user_id, nombre, rol_operativo)
values ('94500000-0000-4000-8000-0000000000aa', '94500000-0000-4000-8000-0000000000ad', 'Admin RT-45', 'direccion');

select set_config('request.jwt.claim.sub', '94500000-0000-4000-8000-0000000000ad', true);
select set_config('role', 'authenticated', true);

select ok(public.rfc_mexicano_valido('RUM260101AB1'), 'RT-45.1: acepta RFC moral formal');
select ok(not public.rfc_mexicano_valido('RFC-DEMO'), 'RT-45.2: rechaza RFC demo/no formal');

select public.admin_crea_empresa_corporativa(
  jsonb_build_object(
    'nombre', 'Empresa RT-45',
    'rfc', 'rum260101ab1',
    'razon_social', 'Empresa RT-45 SA de CV',
    'correo_facturacion', 'facturas@rt45.test',
    'condiciones_pago', 'Credito 15 dias',
    'limite_credito_mxn', 100000,
    'dias_credito', 15,
    'requiere_orden_compra', true
  ),
  jsonb_build_object(
    'nombre', 'Titular RT-45',
    'telefono', '+525500000045',
    'correo_facturacion', 'titular@rt45.test',
    'metodo_pago_registrado', true
  )
) as resultado
\gset

select public.admin_crea_empresa_corporativa(
  jsonb_build_object(
    'nombre', 'Empresa Ajena RT-45',
    'rfc', 'AJR260101AB1',
    'razon_social', 'Empresa Ajena RT-45 SA de CV',
    'correo_facturacion', 'facturas-ajena@rt45.test'
  ),
  jsonb_build_object(
    'nombre', 'Titular Ajeno RT-45',
    'telefono', '+525500000046',
    'correo_facturacion', 'titular-ajeno@rt45.test'
  )
) as resultado_ajeno
\gset

update public.usuarios
set auth_user_id = '94500000-0000-4000-8000-0000000000b1'
where empresa_id = (:'resultado'::jsonb->>'empresa_id')::uuid
  and rol = 'titular_empresa';

select is(
  (select rfc from public.empresas where id = (:'resultado'::jsonb->>'empresa_id')::uuid),
  'RUM260101AB1',
  'RT-45.3: normaliza RFC al crear'
);

select throws_ok(
  $$
    select public.admin_crea_empresa_corporativa(
      jsonb_build_object('nombre', 'Duplicada RT-45', 'rfc', 'RUM260101AB1'),
      jsonb_build_object('nombre', 'Otro Titular', 'correo_facturacion', 'otro@rt45.test')
    )
  $$,
  null,
  'Ya existe una empresa con ese RFC',
  'RT-45.4: evita RFC duplicado'
);

select public.admin_actualiza_empresa_corporativa(
  (:'resultado'::jsonb->>'empresa_id')::uuid,
  jsonb_build_object(
    'rfc', 'RUM260101AC2',
    'razon_social', 'Empresa RT-45 Actualizada SA de CV',
    'limite_credito_mxn', 250000,
    'credito_disponible_mxn', 200000,
    'dias_credito', 30,
    'requiere_orden_compra', false
  ),
  'Ajuste fiscal y comercial RT-45'
) as cambios
\gset

select is(
  (select count(*)::int from public.empresas_cambios_sensibles where empresa_id = (:'resultado'::jsonb->>'empresa_id')::uuid and estado = 'pendiente'),
  2,
  'RT-45.5: crea cambios sensibles pendientes'
);

select public.admin_resuelve_cambio_empresa((:'cambios'::jsonb->>'cambio_fiscal_id')::uuid, true, 'Aprobado RT-45');
select public.admin_resuelve_cambio_empresa((:'cambios'::jsonb->>'cambio_condiciones_id')::uuid, true, 'Aprobado RT-45');

select is(
  (select rfc from public.empresas where id = (:'resultado'::jsonb->>'empresa_id')::uuid),
  'RUM260101AC2',
  'RT-45.6: aplica cambio fiscal aprobado'
);

select is(
  (select limite_credito_mxn::int from public.empresas where id = (:'resultado'::jsonb->>'empresa_id')::uuid),
  250000,
  'RT-45.7: aplica condiciones comerciales aprobadas'
);

select ok(
  exists (
    select 1 from public.auditoria_admin_seguridad
    where recurso = 'empresas'
      and accion = 'aprobar_cambio'
      and datos->>'empresa_id' = :'resultado'::jsonb->>'empresa_id'
  ),
  'RT-45.8: audita aprobaciones sensibles'
);

select set_config('request.jwt.claim.sub', '94500000-0000-4000-8000-0000000000b1', true);

select is(
  (select count(*)::int from public.empresas),
  1,
  'RT-45.9: titular solo ve una empresa bajo RLS'
);

select is(
  (select id from public.empresas),
  (:'resultado'::jsonb->>'empresa_id')::uuid,
  'RT-45.10: titular no ve la empresa ajena'
);

select * from finish();

rollback;
