-- Sprint C4: dispositivos, preferencias reales, centro de notificaciones y cola FCM.

alter table public.preferencias_conductor
  add column if not exists notificar_oportunidades boolean not null default true,
  add column if not exists notificar_traslados_asignados boolean not null default true,
  add column if not exists notificar_cambios_operativos boolean not null default true,
  add column if not exists notificar_documentos boolean not null default true,
  add column if not exists notificar_ganancias boolean not null default true,
  add column if not exists notificar_promociones boolean not null default false;

create table if not exists public.dispositivos_push (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  plataforma text not null check (plataforma in ('android','ios','web')),
  token_push text not null,
  device_id text not null,
  modelo text,
  version_app text,
  version_so text,
  activo boolean not null default true,
  ultimo_acceso timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (usuario_id, device_id)
);
create unique index if not exists dispositivos_push_token_activo_uidx
  on public.dispositivos_push(token_push) where activo;
create index if not exists dispositivos_push_usuario_idx
  on public.dispositivos_push(usuario_id, activo, ultimo_acceso desc);

create table if not exists public.notificaciones_conductor (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in (
    'traslado_asignado','cambio_urgente_traslado','mensaje_torre_control',
    'incidencia_actualizada','proximo_traslado','nueva_oportunidad',
    'documento_por_vencer','documento_rechazado','pago_programado','pago_realizado',
    'evidencia_pendiente','seguridad_critica','promocion'
  )),
  titulo text not null,
  cuerpo text not null,
  destino text not null,
  entidad_tipo text,
  entidad_id uuid,
  datos jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  prioridad text not null default 'normal' check (prioridad in ('normal','alta','critica')),
  estado text not null default 'pendiente' check (estado in ('pendiente','procesando','enviada','parcial','fallida','cancelada')),
  leida_en timestamptz,
  enviada_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique(usuario_id, idempotency_key)
);
create index if not exists notificaciones_conductor_bandeja_idx
  on public.notificaciones_conductor(usuario_id, leida_en, creado_en desc);
create index if not exists notificaciones_conductor_cola_idx
  on public.notificaciones_conductor(estado, creado_en) where estado in ('pendiente','fallida');

create table if not exists public.notificaciones_push_entregas (
  id uuid primary key default gen_random_uuid(),
  notificacion_id uuid not null references public.notificaciones_conductor(id) on delete cascade,
  dispositivo_id uuid not null references public.dispositivos_push(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente','enviada','recibida','abierta','fallida','token_invalido')),
  fcm_message_id text,
  codigo_error text,
  detalle_error text,
  enviada_en timestamptz,
  recibida_en timestamptz,
  abierta_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique(notificacion_id, dispositivo_id)
);

alter table public.dispositivos_push enable row level security;
alter table public.notificaciones_conductor enable row level security;
alter table public.notificaciones_push_entregas enable row level security;

drop policy if exists "usuario_administra_sus_dispositivos_push" on public.dispositivos_push;
create policy "usuario_administra_sus_dispositivos_push" on public.dispositivos_push
for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "usuario_lee_sus_notificaciones" on public.notificaciones_conductor;
create policy "usuario_lee_sus_notificaciones" on public.notificaciones_conductor
for select to authenticated using (usuario_id = auth.uid());

drop policy if exists "usuario_actualiza_lectura_notificaciones" on public.notificaciones_conductor;
create policy "usuario_actualiza_lectura_notificaciones" on public.notificaciones_conductor
for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "usuario_lee_entregas_push" on public.notificaciones_push_entregas;
create policy "usuario_lee_entregas_push" on public.notificaciones_push_entregas
for select to authenticated using (exists (
  select 1 from public.notificaciones_conductor n
  where n.id = notificacion_id and n.usuario_id = auth.uid()
));

create or replace function public.registrar_dispositivo_push(
  p_device_id text, p_token_push text, p_plataforma text default 'android',
  p_modelo text default null, p_version_app text default null, p_version_so text default null
) returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if nullif(trim(p_device_id),'') is null or nullif(trim(p_token_push),'') is null then
    raise exception 'DEVICE_AND_TOKEN_REQUIRED' using errcode='22023';
  end if;
  update public.dispositivos_push set activo=false, actualizado_en=now()
    where token_push=p_token_push and usuario_id<>auth.uid() and activo;
  insert into public.dispositivos_push(usuario_id,plataforma,token_push,device_id,modelo,version_app,version_so,activo,ultimo_acceso)
  values(auth.uid(),p_plataforma,p_token_push,p_device_id,p_modelo,p_version_app,p_version_so,true,now())
  on conflict(usuario_id,device_id) do update set
    token_push=excluded.token_push, plataforma=excluded.plataforma, modelo=excluded.modelo,
    version_app=excluded.version_app, version_so=excluded.version_so,
    activo=true, ultimo_acceso=now(), actualizado_en=now()
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.registrar_dispositivo_push(text,text,text,text,text,text) to authenticated;

create or replace function public.desactivar_dispositivo_push(p_device_id text)
returns void language sql security definer set search_path=public as $$
  update public.dispositivos_push set activo=false, actualizado_en=now()
  where usuario_id=auth.uid() and device_id=p_device_id;
$$;
grant execute on function public.desactivar_dispositivo_push(text) to authenticated;

create or replace function public.marcar_notificacion_leida(p_notificacion_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.notificaciones_conductor set leida_en=coalesce(leida_en,now()), actualizado_en=now()
  where id=p_notificacion_id and usuario_id=auth.uid();
$$;
grant execute on function public.marcar_notificacion_leida(uuid) to authenticated;

create or replace function public.registrar_apertura_push(p_notificacion_id uuid, p_device_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.notificaciones_conductor where id=p_notificacion_id and usuario_id=auth.uid()) then
    raise exception 'NOTIFICATION_NOT_FOUND' using errcode='42501';
  end if;
  update public.notificaciones_conductor set leida_en=coalesce(leida_en,now()), actualizado_en=now() where id=p_notificacion_id;
  update public.notificaciones_push_entregas e set estado='abierta', abierta_en=now(), actualizado_en=now()
  from public.dispositivos_push d where e.notificacion_id=p_notificacion_id and e.dispositivo_id=d.id
    and d.usuario_id=auth.uid() and d.device_id=p_device_id;
end $$;
grant execute on function public.registrar_apertura_push(uuid,text) to authenticated;

-- Función interna para Torre de Control/Edge Functions (service_role).
create or replace function public.encolar_notificacion_conductor(
  p_usuario_id uuid, p_tipo text, p_titulo text, p_cuerpo text, p_destino text,
  p_idempotency_key text, p_entidad_tipo text default null, p_entidad_id uuid default null,
  p_datos jsonb default '{}'::jsonb, p_prioridad text default 'normal'
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if p_destino !~ '^/' then raise exception 'DESTINO_INVALIDO' using errcode='22023'; end if;
  insert into public.notificaciones_conductor(usuario_id,tipo,titulo,cuerpo,destino,idempotency_key,entidad_tipo,entidad_id,datos,prioridad)
  values(p_usuario_id,p_tipo,p_titulo,p_cuerpo,p_destino,p_idempotency_key,p_entidad_tipo,p_entidad_id,coalesce(p_datos,'{}'::jsonb),p_prioridad)
  on conflict(usuario_id,idempotency_key) do update set actualizado_en=now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.encolar_notificacion_conductor(uuid,text,text,text,text,text,text,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.encolar_notificacion_conductor(uuid,text,text,text,text,text,text,uuid,jsonb,text) to service_role;
