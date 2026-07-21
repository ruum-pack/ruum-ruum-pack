-- P0: modelo único de permisos, auditoría de denegaciones y mutaciones atómicas.

create table if not exists public.auditoria_admin_seguridad (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  auth_user_id uuid null,
  admin_id uuid null references public.admins(id),
  rol text null,
  tipo text not null check (tipo in ('acceso_denegado','permiso_denegado','mutacion')),
  recurso text not null,
  accion text null,
  motivo text null,
  datos jsonb not null default '{}'::jsonb
);

alter table public.auditoria_admin_seguridad enable row level security;
revoke all on public.auditoria_admin_seguridad from anon, authenticated;
create index if not exists auditoria_admin_seguridad_creado_idx on public.auditoria_admin_seguridad(creado_en desc);
create index if not exists auditoria_admin_seguridad_admin_idx on public.auditoria_admin_seguridad(admin_id, creado_en desc);

-- Acepta el formato canónico TypeScript (recurso:acción) y mantiene compatibilidad
-- con migraciones anteriores que usaban recurso.acción.
create or replace function public.admin_tiene_permiso(p_permiso text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admins a
    where a.auth_user_id = (select auth.uid())
      and replace(p_permiso, '.', ':') = any (
        case a.rol_operativo
          when 'operador' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','incidencias:leer']
          when 'supervisor' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','conductores:validar','incidencias:leer','disputas:leer','disputas:resolver']
          when 'finanzas' then array['dashboard:leer','viajes:leer','pagos:leer','tarifas:leer','tarifas:editar','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar']
          when 'compliance' then array['dashboard:leer','conductores:leer','conductores:validar','usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar','incidencias:leer','reclamos_seguro:leer','reclamos_seguro:gestionar']
          when 'direccion' then array['dashboard:leer','viajes:leer','viajes:gestionar','pagos:leer','tarifas:leer','tarifas:editar','incidencias:leer','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar']
          else array[]::text[]
        end
      )
  );
$$;

create or replace function public.registrar_acceso_admin_denegado(p_ruta text, p_metodo text, p_motivo text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin public.admins%rowtype;
begin
  select * into v_admin from public.admins where auth_user_id = auth.uid();
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,rol,tipo,recurso,accion,motivo)
  values(auth.uid(),v_admin.id,v_admin.rol_operativo::text,'acceso_denegado',left(coalesce(p_ruta,''),500),left(coalesce(p_metodo,''),20),left(coalesce(p_motivo,''),200));
end $$;

create or replace function public.registrar_permiso_admin_denegado(p_permiso text, p_motivo text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin public.admins%rowtype;
begin
  select * into v_admin from public.admins where auth_user_id = auth.uid();
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,rol,tipo,recurso,accion,motivo)
  values(auth.uid(),v_admin.id,v_admin.rol_operativo::text,'permiso_denegado',left(coalesce(p_permiso,''),200),null,left(coalesce(p_motivo,''),200));
end $$;

revoke all on function public.registrar_acceso_admin_denegado(text,text,text) from public;
revoke all on function public.registrar_permiso_admin_denegado(text,text) from public;
grant execute on function public.registrar_acceso_admin_denegado(text,text,text) to authenticated;
grant execute on function public.registrar_permiso_admin_denegado(text,text) to authenticated;

-- Mutación + auditoría dentro de la misma transacción PostgreSQL.
create or replace function public.admin_actualiza_usuario_verificacion(
  p_usuario_id uuid, p_estado public.estado_verificacion, p_motivo text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin_id uuid;
begin
  if not public.admin_tiene_permiso('usuarios:validar') then raise exception 'permiso_denegado' using errcode='42501'; end if;
  select id into strict v_admin_id from public.admins where auth_user_id=auth.uid();
  update public.usuarios set estado_verificacion=p_estado where id=p_usuario_id;
  if not found then raise exception 'usuario_no_encontrado'; end if;
  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('validacion_documentos','admin',v_admin_id,jsonb_build_object('usuario_id',p_usuario_id,'estado_verificacion',p_estado,'motivo',p_motivo));
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
  values(auth.uid(),v_admin_id,'mutacion','usuarios','validar',jsonb_build_object('usuario_id',p_usuario_id));
end $$;

create or replace function public.admin_actualiza_conductor_documentos(p_conductor_id uuid,p_aprobado boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin_id uuid;
begin
  if not public.admin_tiene_permiso('conductores:validar') then raise exception 'permiso_denegado' using errcode='42501'; end if;
  select id into strict v_admin_id from public.admins where auth_user_id=auth.uid();
  update public.conductores set documentos_vigentes=p_aprobado where id=p_conductor_id;
  if not found then raise exception 'conductor_no_encontrado'; end if;
  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('validacion_documentos','admin',v_admin_id,jsonb_build_object('conductor_id',p_conductor_id,'documentos_vigentes',p_aprobado));
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
  values(auth.uid(),v_admin_id,'mutacion','conductores','validar_documentos',jsonb_build_object('conductor_id',p_conductor_id));
end $$;

revoke all on function public.admin_actualiza_usuario_verificacion(uuid,public.estado_verificacion,text) from public;
revoke all on function public.admin_actualiza_conductor_documentos(uuid,boolean) from public;
grant execute on function public.admin_actualiza_usuario_verificacion(uuid,public.estado_verificacion,text) to authenticated;
grant execute on function public.admin_actualiza_conductor_documentos(uuid,boolean) to authenticated;
