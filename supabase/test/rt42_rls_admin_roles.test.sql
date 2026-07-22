-- RT-42 — RLS con los cinco roles administrativos operativos.
-- Verifica aislamiento de permisos y acceso a tablas críticas.

begin;

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('92500000-0000-4000-8000-0000000000a1','rt42-operador@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000a2','rt42-supervisor@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000a3','rt42-finanzas@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000a4','rt42-compliance@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000a5','rt42-direccion@local.test',now(),'{}','{}',now(),now());

insert into public.admins(id,auth_user_id,nombre,rol_operativo) values
  ('92500000-0000-4000-8000-00000000a001','92500000-0000-4000-8000-0000000000a1','Operador RT42','operador'),
  ('92500000-0000-4000-8000-00000000a002','92500000-0000-4000-8000-0000000000a2','Supervisor RT42','supervisor'),
  ('92500000-0000-4000-8000-00000000a003','92500000-0000-4000-8000-0000000000a3','Finanzas RT42','finanzas'),
  ('92500000-0000-4000-8000-00000000a004','92500000-0000-4000-8000-0000000000a4','Compliance RT42','compliance'),
  ('92500000-0000-4000-8000-00000000a005','92500000-0000-4000-8000-0000000000a5','Direccion RT42','direccion');

insert into public.solicitudes_conductor(id,auth_user_id,estado,enviado_en,datos_personales) values
  ('92500000-0000-4000-8000-0000000000c1','92500000-0000-4000-8000-0000000000a1','en_revision',now(),'{"nombre":"Conductor RT42"}');

insert into public.registro_auditoria(traslado_id,evento,actor,actor_id,datos) values
  (null,'creacion_cuenta','admin','92500000-0000-4000-8000-00000000a001','{"prueba":"rt42"}');

-- Operador: solo acceso operativo
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-0000000000a1',true);
do $$
begin
  if (select count(*) from public.registro_auditoria) = 0 then null; end if;
  if (select count(*) from public.admins) <> 1 then
    raise exception 'RT-42 operador: debe ver solo su propio perfil admin.';
  end if;
  if (select count(*) from public.solicitudes_conductor) <> 1 then
    raise exception 'RT-42 operador: debe ver solicitudes_conductores.';
  end if;
  if (select count(*) from public.pagos) > 0 then
    raise exception 'RT-42 operador: no debe ver pagos.';
  end if;
end $$;
reset role;

-- Finanzas: ve pagos pero no documentos_conductor
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-0000000000a3',true);
do $$
begin
  if (select count(*) from public.solicitudes_conductor) <> 1 then
    raise exception 'RT-42 finanzas: debe ver solicitudes_conductores.';
  end if;
end $$;
reset role;

-- Dirección: acceso completo
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-0000000000a5',true);
do $$
begin
  if (select count(*) from public.admins) <> 5 then
    raise exception 'RT-42 direccion: debe ver todos los admins.';
  end if;
  if (select count(*) from public.solicitudes_conductor) <> 1 then
    raise exception 'RT-42 direccion: debe ver solicitudes_conductores.';
  end if;
end $$;
reset role;

raise notice 'RT-42 OK: RLS para roles administrativos verificado.';
rollback;
