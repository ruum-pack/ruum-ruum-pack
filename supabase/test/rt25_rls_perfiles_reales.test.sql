-- RT-25 — Matriz RLS con los cinco perfiles operativos reales.
-- Falla en el primer aislamiento o permiso administrativo incorrecto.

begin;

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('92500000-0000-4000-8000-00000000000a','rt25-a@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-00000000000b','rt25-b@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000ad','rt25-admin@local.test',now(),'{}','{}',now(),now());

insert into public.admins(id,auth_user_id,nombre)
values('92500000-0000-4000-8000-000000000aad','92500000-0000-4000-8000-0000000000ad','Admin RT-25');

insert into public.solicitudes_conductor(id,auth_user_id,estado,enviado_en,datos_personales) values
  ('92500000-0000-4000-8000-00000000001a','92500000-0000-4000-8000-00000000000a','en_revision',now(),'{"nombre":"Conductor A"}'),
  ('92500000-0000-4000-8000-00000000001b','92500000-0000-4000-8000-00000000000b','en_revision',now(),'{"nombre":"Conductor B"}');

insert into public.documentos_conductor(id,solicitud_id,tipo,nombre_archivo,url,estado,version,es_actual) values
  ('92500000-0000-4000-8000-00000000002a','92500000-0000-4000-8000-00000000001a','licencia_frente','a.jpg','rt25/a.jpg','en_revision',1,true),
  ('92500000-0000-4000-8000-00000000002b','92500000-0000-4000-8000-00000000001b','licencia_frente','b.jpg','rt25/b.jpg','en_revision',1,true);

-- Anónimo: una falta de privilegio y cero filas visibles son ambos resultados seguros.
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$
declare v_solicitudes integer:=0; v_documentos integer:=0;
begin
  begin select count(*) into v_solicitudes from public.solicitudes_conductor; exception when insufficient_privilege then v_solicitudes:=0; end;
  begin select count(*) into v_documentos from public.documentos_conductor; exception when insufficient_privilege then v_documentos:=0; end;
  if v_solicitudes<>0 or v_documentos<>0 then
    raise exception 'RT-25 anónimo: pudo ver solicitudes (%) o documentos (%).',v_solicitudes,v_documentos;
  end if;
end $$;
reset role;

-- Conductor A: ve sólo lo propio y no puede mutar recursos administrativos.
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-00000000000a',true);
do $$
declare v_propias integer; v_ajenas integer; v_filas integer:=0; v_permitido boolean:=false;
begin
  select count(*) into v_propias from public.solicitudes_conductor where id='92500000-0000-4000-8000-00000000001a';
  select count(*) into v_ajenas from public.solicitudes_conductor where id='92500000-0000-4000-8000-00000000001b';
  if v_propias<>1 or v_ajenas<>0 then raise exception 'RT-25 conductor A: aislamiento de solicitudes incorrecto.'; end if;

  begin
    update public.documentos_conductor set notas_admin='manipulado por A' where id='92500000-0000-4000-8000-00000000002b';
    get diagnostics v_filas=row_count;
  exception when insufficient_privilege or check_violation then v_filas:=0;
  end;
  if v_filas<>0 then raise exception 'RT-25 conductor A: modificó un documento de B.'; end if;

  begin
    perform public.revisar_documento_conductor_admin('92500000-0000-4000-8000-00000000002a','aprobado',null);
    v_permitido:=true;
  exception when others then v_permitido:=false;
  end;
  if v_permitido then raise exception 'RT-25 conductor A: aprobó su propio documento.'; end if;

  begin
    update public.solicitudes_conductor set estado='aprobado' where id='92500000-0000-4000-8000-00000000001a';
    get diagnostics v_filas=row_count;
    v_permitido:=v_filas<>0;
  exception when others then v_permitido:=false; v_filas:=0;
  end;
  if v_permitido then raise exception 'RT-25 conductor A: modificó directamente su estado.'; end if;
end $$;
reset role;

-- Conductor B: prueba simétrica de lectura para evitar políticas atadas al fixture A.
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-00000000000b',true);
do $$
begin
  if (select count(*) from public.solicitudes_conductor where id='92500000-0000-4000-8000-00000000001b')<>1
    or (select count(*) from public.solicitudes_conductor where id='92500000-0000-4000-8000-00000000001a')<>0 then
    raise exception 'RT-25 conductor B: aislamiento de solicitudes incorrecto.';
  end if;
end $$;
reset role;

-- Administrador: ve ambos expedientes y revisa por la RPC autorizada.
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-0000000000ad',true);
do $$
begin
  if (select count(*) from public.solicitudes_conductor where id in (
    '92500000-0000-4000-8000-00000000001a','92500000-0000-4000-8000-00000000001b'
  ))<>2 then raise exception 'RT-25 admin: no ve ambos expedientes.'; end if;
  perform public.revisar_documento_conductor_admin(
    '92500000-0000-4000-8000-00000000002a','aprobado','Documento validado por RT-25.'
  );
end $$;
reset role;

-- Service role: bypass RLS para tareas de backend, sin convertirlo en admin humano.
set local role service_role;
select set_config('request.jwt.claim.sub','',true);
do $$
declare v_permitido boolean:=false;
begin
  if (select count(*) from public.solicitudes_conductor where id in (
    '92500000-0000-4000-8000-00000000001a','92500000-0000-4000-8000-00000000001b'
  ))<>2 then raise exception 'RT-25 service role: no puede operar sobre el conjunto completo.'; end if;
  begin
    perform public.revisar_documento_conductor_admin('92500000-0000-4000-8000-00000000002b','aprobado',null);
    v_permitido:=true;
  exception when others then v_permitido:=false;
  end;
  if v_permitido then raise exception 'RT-25 service role: suplantó una decisión de administrador.'; end if;
end $$;
reset role;

do $$ begin
  if not exists(
    select 1 from public.documentos_conductor
    where id='92500000-0000-4000-8000-00000000002a'
      and estado='aprobado' and revisado_por='92500000-0000-4000-8000-000000000aad'
  ) then raise exception 'RT-25: la revisión administrativa no quedó atribuida.'; end if;
  if exists(
    select 1 from public.documentos_conductor
    where id='92500000-0000-4000-8000-00000000002b' and notas_admin='manipulado por A'
  ) then raise exception 'RT-25: persistió una manipulación cruzada.'; end if;
  raise notice 'RT-25 OK: anónimo, conductores A/B, admin y service role verificados.';
end $$;

rollback;
