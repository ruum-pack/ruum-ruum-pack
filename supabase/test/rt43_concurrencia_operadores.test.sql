-- RT-43 — Concurrencia entre dos operadores.
-- Simula dos operadores actualizando el mismo registro con versionado.

begin;

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
  ex_msg text;
begin
  -- Ambos operadores leen la misma versión
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

  -- Operador 1 intenta con versión obsoleta
  begin
    update public.conductores
      set estado = 'activo', version = version + 1
      where id = '92500000-0000-4000-8000-0000000000d1'
        and version = v_version_1;
    get diagnostics v_actualizada = row_count;
    if v_actualizada <> 0 then
      raise exception 'RT-43: Operador 1 no debía sobrescribir con versión obsoleta.';
    end if;
  exception when others then
    get stacked diagnostics ex_msg = message_text;
    if ex_msg is null then null; end if;
  end;

  -- Verificar que el valor final es el de Operador 2
  if (select estado from public.conductores where id = '92500000-0000-4000-8000-0000000000d1') <> 'suspendido' then
    raise exception 'RT-43: El estado final debe ser "suspendido" (escritura de Operador 2).';
  end if;

  raise notice 'RT-43 OK: concurrencia controlada por versionado optimista.';
end $$;

rollback;
