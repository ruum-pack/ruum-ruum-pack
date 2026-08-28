-- =====================================================================
-- Verificación automática de identidad de usuarios/pasajeros (Didit KYC)
-- =====================================================================

-- 1. Actualizar tabla verificaciones_identidad_didit para admitir usuarios
alter table public.verificaciones_identidad_didit
  alter column solicitud_id drop not null;

alter table public.verificaciones_identidad_didit
  add column if not exists usuario_id uuid references public.usuarios(id) on delete cascade;

alter table public.verificaciones_identidad_didit
  drop constraint if exists verificaciones_identidad_didit_origen_check;

alter table public.verificaciones_identidad_didit
  add constraint verificaciones_identidad_didit_origen_check
  check (solicitud_id is not null or usuario_id is not null);

create index if not exists verificaciones_identidad_didit_usuario_idx
  on public.verificaciones_identidad_didit (usuario_id, creado_en desc);

-- 2. Política RLS para que el usuario consulte sus propias verificaciones
drop policy if exists "usuario_ve_su_verificacion_didit" on public.verificaciones_identidad_didit;
create policy "usuario_ve_su_verificacion_didit"
  on public.verificaciones_identidad_didit for select
  using (
    usuario_id in (
      select id from public.usuarios where auth_user_id = auth.uid()
    )
  );

-- 3. RPC: Aprobación automática de usuario (Didit → Approved)
create or replace function public.aprobar_usuario_por_verificacion_sistema(
  p_usuario_id uuid,
  p_verificacion_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  u public.usuarios;
  v public.verificaciones_identidad_didit;
  v_sistema_id constant uuid := '00000000-0000-4000-8000-000000000001';
  v_motivo text := 'Verificación automática Didit aprobada (OCR + prueba de vida + coincidencia facial).';
begin
  select * into v from public.verificaciones_identidad_didit where id = p_verificacion_id for update;
  if v.id is null or v.usuario_id <> p_usuario_id then
    raise exception 'Verificación Didit no encontrada para este usuario.';
  end if;
  if v.estado <> 'aprobado' then
    raise exception 'La verificación Didit no está aprobada (estado actual: %).', v.estado;
  end if;

  select * into u from public.usuarios where id = p_usuario_id for update;
  if u.id is null then
    raise exception 'Usuario no encontrado.';
  end if;

  update public.usuarios
    set estado_verificacion = 'verificado',
        actualizado_en = now()
    where id = u.id;

  update public.verificaciones_identidad_didit
    set procesado_en = now()
    where id = v.id;

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values ('verificacion_cuenta', 'sistema', v_sistema_id, jsonb_build_object(
    'usuario_id', u.id, 'decision', 'aprobar_usuario',
    'motivo', v_motivo, 'verificacion_didit_id', v.id, 'didit_session_id', v.session_id
  ));

  return u.id;
end;
$$;

revoke all on function public.aprobar_usuario_por_verificacion_sistema(uuid, uuid) from public, anon, authenticated;
grant execute on function public.aprobar_usuario_por_verificacion_sistema(uuid, uuid) to service_role;

-- 4. RPC: Rechazo automático de usuario (Didit → Declined)
create or replace function public.rechazar_usuario_por_verificacion_sistema(
  p_usuario_id uuid,
  p_verificacion_id uuid,
  p_motivo text default 'La verificación automática de identidad no pudo confirmarse. Intenta de nuevo o sube tu documento manualmente.'
) returns void language plpgsql security definer set search_path = public as $$
declare
  u public.usuarios;
  v public.verificaciones_identidad_didit;
  v_sistema_id constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  select * into v from public.verificaciones_identidad_didit where id = p_verificacion_id for update;
  if v.id is null or v.usuario_id <> p_usuario_id then
    raise exception 'Verificación Didit no encontrada para este usuario.';
  end if;

  select * into u from public.usuarios where id = p_usuario_id for update;
  if u.id is null then
    raise exception 'Usuario no encontrado.';
  end if;

  update public.usuarios
    set estado_verificacion = 'rechazado',
        actualizado_en = now()
    where id = u.id;

  update public.verificaciones_identidad_didit
    set procesado_en = now()
    where id = v.id;

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values ('verificacion_cuenta', 'sistema', v_sistema_id, jsonb_build_object(
    'usuario_id', u.id, 'decision', 'rechazar_usuario',
    'motivo', p_motivo, 'verificacion_didit_id', v.id, 'didit_session_id', v.session_id
  ));
end;
$$;

revoke all on function public.rechazar_usuario_por_verificacion_sistema(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rechazar_usuario_por_verificacion_sistema(uuid, uuid, text) to service_role;

comment on function public.aprobar_usuario_por_verificacion_sistema(uuid, uuid) is
  'Aprobación automática del usuario invocada desde webhook-didit cuando la verificación resulta Approved.';
comment on function public.rechazar_usuario_por_verificacion_sistema(uuid, uuid, text) is
  'Rechazo automático del usuario invocado desde webhook-didit cuando la verificación resulta Declined.';
