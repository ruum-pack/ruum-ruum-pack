-- P1 — El trigger persiste términos aunque signUp no devuelva sesión.
create extension if not exists pgtap with schema extensions;

begin;
select plan(4);

insert into auth.users(
  id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000008-0000-4000-8000-000000000001',
  'pendiente-confirmacion@p1.test',
  null,
  '{}'::jsonb,
  '{
    "tipo_registro":"usuario",
    "tipo_cuenta":"personal",
    "nombre":"Usuario Pendiente",
    "version_terminos_aceptada":1,
    "terminos_aceptados_en":"2026-07-11T12:00:00Z"
  }'::jsonb,
  now(), now()
);

select ok(
  exists(select 1 from public.usuarios where auth_user_id='00000008-0000-4000-8000-000000000001'),
  'P1: el trigger crea el perfil aunque el correo siga sin confirmar'
);
select is(
  (select version_terminos_aceptada from public.usuarios where auth_user_id='00000008-0000-4000-8000-000000000001'),
  1,
  'P1: persiste la versión de términos desde metadata'
);
select is(
  (select terminos_aceptados_en from public.usuarios where auth_user_id='00000008-0000-4000-8000-000000000001'),
  '2026-07-11T12:00:00Z'::timestamptz,
  'P1: persiste la fecha de aceptación sin una sesión cliente'
);
select is(
  (select count(*)::int from public.registro_auditoria
   where evento='aceptacion_terminos'
     and actor_id=(select id from public.usuarios where auth_user_id='00000008-0000-4000-8000-000000000001')),
  1,
  'P1: el trigger es la única fuente de auditoría de aceptación'
);

select * from finish();
rollback;
