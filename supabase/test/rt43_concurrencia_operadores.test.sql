-- RT-43 — Concurrencia entre dos operadores.
-- Simula dos operadores actualizando el mismo registro con versionado.

create extension if not exists pgtap with schema extensions;

begin;

select plan(3);

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('92500000-0000-4000-8000-0000000000b1','rt43-op1@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000b2','rt43-op2@local.test',now(),'{}','{}',now(),now());

insert into public.conductores(id,auth_user_id,estado) values
  ('92500000-0000-4000-8000-0000000000d1','92500000-0000-4000-8000-0000000000b1','activo');

-- Operador 1 lee, Operador 2 lee y escribe primero, luego Operador 1 intenta escribir
do $$
declare
  v_version_1 integer;
  v_version_2 integer;
  v_actualizada integer;
begin
  select version into v_version_1 from public.conductores
    where id = '92500000-0000-4000-8000-0000000000d1';
  v_version_2 := v_version_1;

  -- Operador 2 actualiza primero
  update public.conductores
    set estado = 'suspendido', version = version + 1
    where id = '92500000-0000-4000-8000-0000000000d1'
      and version = v_version_2;
  get diagnostics v_actualizada = row_count;
  if v_actualizada <> 1 then
    raise exception 'RT-43: Operador 2 debió poder actualizar (versión %).', v_version_2;
  end if;
end $$;

-- 1. Verificar que la actualización del Operador 2 surtió efecto
select is(
  (select estado from public.conductores where id = '92500000-0000-4000-8000-0000000000d1'),
  'suspendido',
  'RT-43.1: Operador 2 actualizó el estado a suspendido'
);

-- 2. Operador 1 intenta actualizar con versión obsoleta (versión 1) y afecta 0 filas
do $$
declare
  v_actualizada integer;
begin
  update public.conductores
    set estado = 'activo', version = version + 1
    where id = '92500000-0000-4000-8000-0000000000d1'
      and version = 1;
  get diagnostics v_actualizada = row_count;
  if v_actualizada <> 0 then
    raise exception 'RT-43: Operador 1 no debía sobrescribir con versión obsoleta.';
  end if;
end $$;

select is(
  (select version::int from public.conductores where id = '92500000-0000-4000-8000-0000000000d1'),
  2,
  'RT-43.2: la versión se mantuvo en 2 y no fue sobrescrita por Operador 1'
);

-- 3. El estado final sigue siendo suspendido
select is(
  (select estado from public.conductores where id = '92500000-0000-4000-8000-0000000000d1'),
  'suspendido',
  'RT-43.3: el estado final se mantiene protegido contra escrituras concurrentes'
);

select * from finish();

rollback;
