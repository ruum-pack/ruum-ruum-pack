-- RT-42 — Smoke test declarativo de RLS administrativo.
-- Este archivo es deliberadamente assert-only: no inserta/borrar admins ni
-- modifica policies. Así no puede dañar staging aunque alguien lo ejecute
-- fuera del contenedor local.

select plan(5);

select ok(
  current_database() is not null,
  'RT-42.0: el test reporta explícitamente la base objetivo'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admins'
      and policyname = 'admins_ven_equipo_torre_control'
      and cmd = 'SELECT'
  ),
  'RT-42.1: admins tiene policy declarada para lectura de Torre de Control'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admins'
      and policyname = 'admin_ve_su_propio_registro'
      and cmd = 'SELECT'
  ),
  'RT-42.2: admins conserva la policy de propio registro'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admins'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and coalesce(qual, '') ilike '%true%'
  ),
  'RT-42.3: no hay policy administrativa mutadora abierta con true'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'solicitudes_conductor'
      and cmd = 'SELECT'
  ),
  'RT-42.4: solicitudes_conductor mantiene al menos una policy de lectura'
);

select * from finish();
