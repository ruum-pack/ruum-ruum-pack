-- P2 madurez operativa: capacidades, aprobación dual, exportaciones y observabilidad.

create table if not exists public.admin_capacidades (
  admin_id uuid not null references public.admins(id) on delete cascade,
  capacidad text not null check (capacidad ~ '^[a-z0-9_]+:[a-z0-9_]+$'),
  concedida boolean not null default true,
  motivo text,
  otorgada_por uuid references public.admins(id),
  creada_en timestamptz not null default now(),
  primary key (admin_id, capacidad)
);
alter table public.admin_capacidades enable row level security;
revoke all on public.admin_capacidades from anon, authenticated;

create or replace function public.admin_tiene_permiso(p_permiso text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  with actual as (
    select a.id, a.rol_operativo from public.admins a where a.auth_user_id=auth.uid()
  ), base as (
    select id, replace(p_permiso,'.',':') permiso,
      replace(p_permiso,'.',':') = any(case rol_operativo
        when 'operador' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','incidencias:leer']
        when 'supervisor' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','conductores:validar','conductores:sancionar','incidencias:leer','disputas:leer','disputas:resolver','aprobaciones:aprobar','auditoria:leer']
        when 'finanzas' then array['dashboard:leer','viajes:leer','pagos:leer','pagos:ejecutar','tarifas:leer','tarifas:editar','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','exportaciones:crear']
        when 'compliance' then array['dashboard:leer','conductores:leer','conductores:validar','conductores:sancionar','usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar','incidencias:leer','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear']
        when 'direccion' then array['dashboard:leer','viajes:leer','viajes:gestionar','pagos:leer','pagos:ejecutar','tarifas:leer','tarifas:editar','incidencias:leer','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear','capacidades:administrar']
        else array[]::text[] end) permitido
    from actual
  )
  select coalesce((select ac.concedida from base b join public.admin_capacidades ac on ac.admin_id=b.id and ac.capacidad=b.permiso),
                  (select permitido from base), false)
$$;

create table if not exists public.solicitudes_aprobacion_admin (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('finanzas','sancion')),
  capacidad_requerida text not null,
  recurso text not null,
  recurso_id uuid,
  accion text not null,
  payload jsonb not null default '{}'::jsonb,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada','ejecutada','expirada')),
  solicitada_por uuid not null references public.admins(id),
  aprobada_por uuid references public.admins(id),
  motivo_decision text,
  creada_en timestamptz not null default now(),
  decidida_en timestamptz,
  expira_en timestamptz not null default now()+interval '24 hours',
  ejecutada_en timestamptz,
  version bigint not null default 1,
  check (aprobada_por is null or aprobada_por <> solicitada_por)
);
create index if not exists solicitudes_aprobacion_estado_idx on public.solicitudes_aprobacion_admin(estado,creada_en desc);
alter table public.solicitudes_aprobacion_admin enable row level security;
create policy aprobaciones_lectura on public.solicitudes_aprobacion_admin for select to authenticated
  using (public.admin_tiene_permiso('aprobaciones:aprobar') or solicitada_por=(select id from public.admins where auth_user_id=auth.uid()));

create or replace function public.admin_solicitar_aprobacion(
  p_tipo text,p_capacidad text,p_recurso text,p_recurso_id uuid,p_accion text,p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin uuid; v_id uuid;
begin
  if p_tipo not in ('finanzas','sancion') then raise exception using errcode='22023',message='TIPO_APROBACION_INVALIDO'; end if;
  if not public.admin_tiene_permiso(p_capacidad) then raise exception using errcode='42501',message='PERMISO_INSUFICIENTE'; end if;
  select id into strict v_admin from public.admins where auth_user_id=auth.uid();
  insert into public.solicitudes_aprobacion_admin(tipo,capacidad_requerida,recurso,recurso_id,accion,payload,solicitada_por)
  values(p_tipo,replace(p_capacidad,'.',':'),left(p_recurso,100),p_recurso_id,left(p_accion,100),coalesce(p_payload,'{}'::jsonb),v_admin)
  returning id into v_id;
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
  values(auth.uid(),v_admin,'mutacion','solicitudes_aprobacion_admin','solicitar',jsonb_build_object('solicitud_id',v_id,'tipo',p_tipo,'recurso',p_recurso));
  return v_id;
end $$;

create or replace function public.admin_decidir_aprobacion(p_solicitud_id uuid,p_aprobar boolean,p_motivo text,p_version_esperada bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin uuid; v_s public.solicitudes_aprobacion_admin%rowtype;
begin
  if not public.admin_tiene_permiso('aprobaciones:aprobar') then raise exception using errcode='42501',message='PERMISO_INSUFICIENTE'; end if;
  select id into strict v_admin from public.admins where auth_user_id=auth.uid();
  select * into strict v_s from public.solicitudes_aprobacion_admin where id=p_solicitud_id for update;
  if v_s.estado<>'pendiente' or v_s.version<>p_version_esperada then raise exception using errcode='40001',message='VERSION_CONFLICT'; end if;
  if v_s.solicitada_por=v_admin then raise exception using errcode='42501',message='APROBADOR_DEBE_SER_DISTINTO'; end if;
  if v_s.expira_en<=now() then
    update public.solicitudes_aprobacion_admin set estado='expirada',version=version+1 where id=p_solicitud_id;
    raise exception using errcode='22023',message='SOLICITUD_EXPIRADA';
  end if;
  update public.solicitudes_aprobacion_admin set estado=case when p_aprobar then 'aprobada' else 'rechazada' end,
    aprobada_por=v_admin,motivo_decision=nullif(trim(p_motivo),''),decidida_en=now(),version=version+1 where id=p_solicitud_id;
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
  values(auth.uid(),v_admin,'mutacion','solicitudes_aprobacion_admin',case when p_aprobar then 'aprobar' else 'rechazar' end,
    jsonb_build_object('solicitud_id',p_solicitud_id,'solicitada_por',v_s.solicitada_por));
end $$;

create table if not exists public.exportaciones_admin (
  id uuid primary key default gen_random_uuid(), admin_id uuid not null references public.admins(id),
  recurso text not null, filtros jsonb not null default '{}'::jsonb, formato text not null check(formato in ('csv','json')),
  filas integer not null default 0, hash_sha256 text, estado text not null default 'iniciada' check(estado in ('iniciada','completada','fallida')),
  creada_en timestamptz not null default now(), completada_en timestamptz, error_codigo text
);
alter table public.exportaciones_admin enable row level security;
create policy exportaciones_propias_o_auditoria on public.exportaciones_admin for select to authenticated
 using(admin_id=(select id from public.admins where auth_user_id=auth.uid()) or public.admin_tiene_permiso('auditoria:leer'));

create or replace function public.admin_registrar_exportacion(p_recurso text,p_filtros jsonb,p_formato text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin uuid;v_id uuid;
begin
 if not public.admin_tiene_permiso('exportaciones:crear') then raise exception using errcode='42501',message='PERMISO_INSUFICIENTE'; end if;
 if p_formato not in ('csv','json') then raise exception using errcode='22023',message='FORMATO_INVALIDO'; end if;
 select id into strict v_admin from public.admins where auth_user_id=auth.uid();
 insert into public.exportaciones_admin(admin_id,recurso,filtros,formato) values(v_admin,left(p_recurso,100),coalesce(p_filtros,'{}'),p_formato) returning id into v_id;
 return v_id;
end $$;

create or replace function public.admin_completar_exportacion(p_id uuid,p_filas integer,p_hash text,p_error text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin uuid;
begin
 select id into strict v_admin from public.admins where auth_user_id=auth.uid();
 update public.exportaciones_admin set filas=greatest(coalesce(p_filas,0),0),hash_sha256=left(p_hash,128),
 estado=case when p_error is null then 'completada' else 'fallida' end,completada_en=now(),error_codigo=left(p_error,100)
 where id=p_id and admin_id=v_admin and estado='iniciada';
 if not found then raise exception using errcode='42501',message='EXPORTACION_NO_DISPONIBLE'; end if;
 insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
 values(auth.uid(),v_admin,'mutacion','exportaciones_admin','completar',jsonb_build_object('exportacion_id',p_id,'filas',p_filas,'hash',p_hash,'error',p_error));
end $$;

create table if not exists public.eventos_observabilidad (
 id bigserial primary key, creado_en timestamptz not null default now(), servicio text not null,
 nivel text not null check(nivel in ('info','warn','error')), nombre text not null, trace_id text,
 duracion_ms integer, datos jsonb not null default '{}'::jsonb
);
create index if not exists eventos_observabilidad_fecha_idx on public.eventos_observabilidad(creado_en desc);
alter table public.eventos_observabilidad enable row level security;
revoke all on public.eventos_observabilidad from anon,authenticated;
create policy observabilidad_lectura_auditoria on public.eventos_observabilidad for select to authenticated using(public.admin_tiene_permiso('auditoria:leer'));

revoke all on function public.admin_solicitar_aprobacion(text,text,text,uuid,text,jsonb) from public;
revoke all on function public.admin_decidir_aprobacion(uuid,boolean,text,bigint) from public;
revoke all on function public.admin_registrar_exportacion(text,jsonb,text) from public;
revoke all on function public.admin_completar_exportacion(uuid,integer,text,text) from public;
grant execute on function public.admin_solicitar_aprobacion(text,text,text,uuid,text,jsonb) to authenticated;
grant execute on function public.admin_decidir_aprobacion(uuid,boolean,text,bigint) to authenticated;
grant execute on function public.admin_registrar_exportacion(text,jsonb,text) to authenticated;
grant execute on function public.admin_completar_exportacion(uuid,integer,text,text) to authenticated;
