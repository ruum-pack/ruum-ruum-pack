-- RT-39 -- Admin crea empresa corporativa y titular para traslados masivos.

create extension if not exists pgtap with schema extensions;

begin;

select plan(5);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('93900000-0000-4000-8000-0000000000ad', 'rt39-admin@rt39.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('93900000-0000-4000-8000-0000000000aa', '93900000-0000-4000-8000-0000000000ad', 'Admin RT-39');

select set_config('request.jwt.claim.sub', '93900000-0000-4000-8000-0000000000ad', true);
select set_config('role', 'authenticated', true);

select public.admin_crea_empresa_corporativa(
  jsonb_build_object(
    'nombre', 'Empresa RT-39',
    'rfc', 'rt390101ab1',
    'razon_social', 'Empresa RT-39 SA de CV',
    'correo_facturacion', 'facturas@rt39.test',
    'condiciones_pago', 'Pago semanal'
  ),
  jsonb_build_object(
    'nombre', 'Titular RT-39',
    'telefono', '+525500000039',
    'correo_facturacion', 'TITULAR@RT39.TEST',
    'metodo_pago_registrado', true
  )
) as resultado
\gset

select ok((:'resultado'::jsonb->>'empresa_id') is not null, 'RT-39.1: devuelve empresa_id');
select ok((:'resultado'::jsonb->>'usuario_id') is not null, 'RT-39.2: devuelve usuario_id');

select is(
  (select rfc from public.empresas where id = (:'resultado'::jsonb->>'empresa_id')::uuid),
  'RT390101AB1',
  'RT-39.3: normaliza RFC de empresa'
);

select is(
  (select correo_facturacion from public.usuarios where id = (:'resultado'::jsonb->>'usuario_id')::uuid),
  'titular@rt39.test',
  'RT-39.4: normaliza correo del titular'
);

select ok(
  exists (
    select 1 from public.registro_auditoria
    where evento = 'creacion_cuenta'
      and datos->>'tipo' = 'empresa_corporativa'
      and datos->>'empresa_id' = :'resultado'::jsonb->>'empresa_id'
  ),
  'RT-39.5: registra auditoria del alta corporativa'
);

select * from finish();

rollback;
