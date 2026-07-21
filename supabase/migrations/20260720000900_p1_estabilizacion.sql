-- P1 estabilización: preferencias persistentes, trazabilidad y concurrencia optimista.
create table if not exists public.preferencias_admin (
  admin_id uuid not null references public.admins(id) on delete cascade,
  clave text not null check (char_length(clave) between 1 and 120),
  valor jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  actualizado_en timestamptz not null default now(),
  primary key (admin_id, clave)
);
alter table public.preferencias_admin enable row level security;
create policy preferencias_admin_propias on public.preferencias_admin
  for all to authenticated
  using (admin_id = (select id from public.admins where auth_user_id = auth.uid()))
  with check (admin_id = (select id from public.admins where auth_user_id = auth.uid()));

create or replace function public.obtener_preferencia_admin(p_clave text)
returns jsonb language sql stable security definer set search_path=public as $$
  select p.valor from public.preferencias_admin p
  where p.admin_id=(select id from public.admins where auth_user_id=auth.uid()) and p.clave=p_clave
$$;

create or replace function public.guardar_preferencia_admin(p_clave text, p_valor jsonb, p_version_esperada bigint default null)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_admin uuid; v_version bigint;
begin
  select id into v_admin from public.admins where auth_user_id=auth.uid();
  if v_admin is null then raise exception using errcode='42501', message='Administrador no autorizado'; end if;
  insert into public.preferencias_admin(admin_id,clave,valor)
  values(v_admin,p_clave,p_valor)
  on conflict(admin_id,clave) do update set
    valor=excluded.valor, version=public.preferencias_admin.version+1, actualizado_en=now()
  where p_version_esperada is null or public.preferencias_admin.version=p_version_esperada
  returning version into v_version;
  if v_version is null then raise exception using errcode='40001', message='VERSION_CONFLICT'; end if;
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
  values(auth.uid(),v_admin,'mutacion','preferencias_admin','actualizar',jsonb_build_object('clave',p_clave,'version',v_version));
  return v_version;
end $$;

-- Versionado para entidades con mutaciones administrativas frecuentes.
alter table if exists public.traslados add column if not exists version bigint not null default 1;
alter table if exists public.conductores add column if not exists version bigint not null default 1;
alter table if exists public.reclamos_seguro add column if not exists version bigint not null default 1;

create or replace function public.admin_actualizar_estado_traslado_con_version(
  p_traslado_id uuid, p_estado public.estado_traslado, p_version_esperada bigint
) returns bigint language plpgsql security definer set search_path=public as $$
declare v_version bigint; v_admin uuid;
begin
  if not public.admin_tiene_permiso('viajes.gestionar') then raise exception using errcode='42501',message='Permiso insuficiente'; end if;
  select id into v_admin from public.admins where auth_user_id=auth.uid();
  update public.traslados set estado=p_estado, version=version+1, actualizado_en=now()
  where id=p_traslado_id and version=p_version_esperada returning version into v_version;
  if v_version is null then raise exception using errcode='40001',message='VERSION_CONFLICT'; end if;
  insert into public.registro_auditoria(evento,actor,actor_id,traslado_id,datos)
  values('modificacion_traslado_activo','admin',v_admin,p_traslado_id,jsonb_build_object('estado',p_estado,'version',v_version));
  return v_version;
end $$;

revoke all on function public.obtener_preferencia_admin(text) from public;
revoke all on function public.guardar_preferencia_admin(text,jsonb,bigint) from public;
revoke all on function public.admin_actualizar_estado_traslado_con_version(uuid,public.estado_traslado,bigint) from public;
grant execute on function public.obtener_preferencia_admin(text) to authenticated;
grant execute on function public.guardar_preferencia_admin(text,jsonb,bigint) to authenticated;
grant execute on function public.admin_actualizar_estado_traslado_con_version(uuid,public.estado_traslado,bigint) to authenticated;
