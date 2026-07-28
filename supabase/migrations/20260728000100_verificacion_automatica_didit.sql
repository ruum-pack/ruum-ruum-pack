-- =====================================================================
-- Verificación automática de identidad de conductores (Didit KYC)
-- =====================================================================
-- Añade:
--   1. Una cuenta "sistema" en admins (sin auth_user_id, no se puede
--      iniciar sesión con ella) para atribuir correctamente las
--      aprobaciones automáticas en las tablas de auditoría existentes.
--   2. Tabla verificaciones_identidad_didit: registra cada sesión de
--      Didit y su resultado.
--   3. RPC aprobar_solicitud_conductor_sistema: espejo de
--      aprobar_solicitud_conductor_admin pero invocable únicamente por
--      el rol de servicio (edge function del webhook), tras validar que
--      Didit devolvió "Approved". Marca los documentos de identidad
--      como aprobados automáticamente y corre exactamente la misma
--      máquina de estados que usa un admin humano.
--   4. RPC rechazar_solicitud_por_verificacion_sistema: espejo del
--      camino de rechazo, para cuando Didit devuelve "Declined".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cuenta "sistema" para auditoría (no operable por login humano)
-- ---------------------------------------------------------------------
insert into public.admins (id, auth_user_id, nombre)
values (
  '00000000-0000-4000-8000-000000000001',
  null,
  'Sistema · Verificación automática Didit'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Tabla de verificaciones Didit
-- ---------------------------------------------------------------------
create table public.verificaciones_identidad_didit (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references public.solicitudes_conductor(id) on delete cascade,
  session_id      text not null unique,
  workflow_id     text,
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'en_revision', 'aprobado', 'rechazado', 'error')),
  decision        jsonb,
  procesado_en    timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create index verificaciones_identidad_didit_solicitud_idx
  on public.verificaciones_identidad_didit (solicitud_id, creado_en desc);

create trigger verificaciones_identidad_didit_actualizado_en
  before update on public.verificaciones_identidad_didit
  for each row execute function public.set_actualizado_en();

alter table public.verificaciones_identidad_didit enable row level security;

-- El conductor puede ver el estado de su propia verificación (para
-- mostrarle "validando identidad..." en la app), pero nunca escribirla:
-- sólo el rol de servicio (webhook) inserta/actualiza esta tabla.
create policy "conductor_ve_su_verificacion_didit"
  on public.verificaciones_identidad_didit for select
  using (
    solicitud_id in (
      select id from public.solicitudes_conductor where auth_user_id = auth.uid()
    )
  );

create policy "admin_ve_verificaciones_didit"
  on public.verificaciones_identidad_didit for select
  using (public.es_admin());

-- ---------------------------------------------------------------------
-- 3. RPC: aprobación automática de la solicitud (Didit → Approved)
-- ---------------------------------------------------------------------
create or replace function public.aprobar_solicitud_conductor_sistema(
  p_solicitud_id uuid,
  p_verificacion_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.solicitudes_conductor;
  v public.verificaciones_identidad_didit;
  v_conductor_id uuid;
  v_sistema_id constant uuid := '00000000-0000-4000-8000-000000000001';
  v_motivo text := 'Verificación automática Didit aprobada (OCR + prueba de vida + coincidencia facial).';
  v_estado_operativo public.estado_expediente_conductor;
  v_doc record;
begin
  -- La única barrera de acceso necesaria es el GRANT a service_role /
  -- REVOKE de public,anon,authenticated de abajo: Postgres rechaza la
  -- llamada antes de entrar aquí si el rol no es service_role.
  select * into v from public.verificaciones_identidad_didit where id = p_verificacion_id for update;
  if v.id is null or v.solicitud_id <> p_solicitud_id then
    raise exception 'Verificación Didit no encontrada para esta solicitud.';
  end if;
  if v.estado <> 'aprobado' then
    raise exception 'La verificación Didit no está aprobada (estado actual: %).', v.estado;
  end if;

  select * into s from public.solicitudes_conductor where id = p_solicitud_id for update;
  if s.id is null or s.estado <> 'en_revision' then
    raise exception 'La solicitud no está en revisión.';
  end if;

  -- Auto-aprobar los documentos de identidad: Didit ya validó OCR,
  -- prueba de vida y coincidencia facial contra estos documentos.
  perform set_config('ruum.cambio_documento_autorizado', 'si', true);
  for v_doc in
    select id from public.documentos_conductor
    where solicitud_id = s.id
      and tipo in ('licencia_frente', 'licencia_reverso', 'identificacion_oficial')
      and es_actual and estado = 'en_revision'
  loop
    update public.documentos_conductor
      set estado = 'aprobado', notas_admin = null, motivo_rechazo = null,
          revisado_por = v_sistema_id, revisado_en = now(), actualizado_en = now()
      where id = v_doc.id;
    insert into public.historial_estados_solicitud_conductor(
      solicitud_id, documento_id, revisado_por, decision, motivo, estado_anterior, estado_nuevo
    ) values (
      s.id, v_doc.id, v_sistema_id, 'aprobar_documento',
      'Validado automáticamente por Didit.', 'en_revision', 'en_revision'
    );
  end loop;
  perform set_config('ruum.cambio_documento_autorizado', '', true);

  if exists (
    select 1 from (values ('licencia_frente'),('licencia_reverso'),('identificacion_oficial')) r(tipo)
    where not exists (
      select 1 from public.documentos_conductor d
      where d.solicitud_id = s.id and d.tipo = r.tipo and d.es_actual and d.estado = 'aprobado'
    )
  ) then raise exception 'Faltan documentos obligatorios vigentes y aprobados.'; end if;

  if exists (
    select 1 from (values
      ('terminos_servicio'::public.tipo_documento_consentimiento),
      ('aviso_privacidad'::public.tipo_documento_consentimiento),
      ('autorizacion_antecedentes'::public.tipo_documento_consentimiento),
      ('declaracion_suspensiones'::public.tipo_documento_consentimiento)
    ) r(tipo)
    where not exists (
      select 1 from public.consentimientos_usuario c
      where c.solicitud_id = s.id and c.tipo_documento = r.tipo
    )
  ) then raise exception 'Faltan consentimientos obligatorios.'; end if;

  perform set_config('ruum.aprobando_solicitud', 'si', true);
  insert into public.conductores (
    auth_user_id, nombre, telefono, curp, codigo_postal, estado_residencia, ciudad_municipio, colonia, calle, numero, referencias,
    licencia_numero, licencia_tipo, licencia_vigencia, autoriza_verificacion_antecedentes, declara_sin_suspensiones,
    contacto_emergencia_nombre, contacto_emergencia_telefono, version_terminos_aceptada, terminos_aceptados_en, marca_terminos
  ) values (
    s.auth_user_id, coalesce(s.datos_personales->>'nombre',''), s.datos_personales->>'telefono', s.curp_normalizada,
    s.domicilio->>'codigo_postal', s.domicilio->>'estado', s.domicilio->>'ciudad_municipio', s.domicilio->>'colonia', s.domicilio->>'calle', s.domicilio->>'numero', s.domicilio->>'referencias',
    s.licencia_normalizada, s.licencia->>'tipo', (s.licencia->>'vigencia')::date,
    true, true,
    s.contacto_emergencia->>'nombre', s.contacto_emergencia->>'telefono', 1, now(), 'registro_v2_consentimientos_historicos'
  ) returning id into v_conductor_id;
  perform set_config('ruum.aprobando_solicitud', '', true);

  perform set_config('ruum.cambio_documento_autorizado', 'si', true);
  update public.documentos_conductor set conductor_id = v_conductor_id, solicitud_id = null where solicitud_id = s.id;
  perform set_config('ruum.cambio_documento_autorizado', '', true);

  select estado_expediente into v_estado_operativo from public.conductores where id = v_conductor_id;
  if v_estado_operativo = 'borrador' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'correo_pendiente');
    v_estado_operativo := 'correo_pendiente';
  end if;
  if v_estado_operativo = 'correo_pendiente' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'documentos_pendientes');
    v_estado_operativo := 'documentos_pendientes';
  elsif v_estado_operativo = 'datos_incompletos' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'documentos_pendientes');
    v_estado_operativo := 'documentos_pendientes';
  end if;
  if v_estado_operativo = 'documentos_pendientes' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'listo_para_enviar');
    v_estado_operativo := 'listo_para_enviar';
  end if;
  if v_estado_operativo = 'listo_para_enviar' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'en_revision');
    v_estado_operativo := 'en_revision';
  end if;
  if v_estado_operativo = 'en_revision' then
    perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'aprobado');
    v_estado_operativo := 'aprobado';
  end if;
  if v_estado_operativo <> 'aprobado' then
    raise exception 'No fue posible llevar el expediente operativo a aprobado desde %.', v_estado_operativo;
  end if;
  update public.conductores set estado = 'activo', documentos_vigentes = true where id = v_conductor_id;

  perform set_config('ruum.decision_solicitud', 'aprobar_solicitud', true);
  perform set_config('ruum.motivo_decision_solicitud', v_motivo, true);
  perform public.cambiar_estado_solicitud_conductor(s.id, 'aprobado');
  perform set_config('ruum.decision_solicitud', '', true);
  perform set_config('ruum.motivo_decision_solicitud', '', true);
  update public.solicitudes_conductor set conductor_id = v_conductor_id where id = s.id;

  update public.verificaciones_identidad_didit
    set procesado_en = now()
    where id = v.id;

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values ('verificacion_cuenta', 'sistema', v_sistema_id, jsonb_build_object(
    'solicitud_id', s.id, 'conductor_id', v_conductor_id, 'decision', 'aprobar_solicitud',
    'motivo', v_motivo, 'verificacion_didit_id', v.id, 'didit_session_id', v.session_id
  ));
  return v_conductor_id;
end;
$$;

revoke all on function public.aprobar_solicitud_conductor_sistema(uuid, uuid) from public, anon, authenticated;
grant execute on function public.aprobar_solicitud_conductor_sistema(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- 4. RPC: rechazo automático (Didit → Declined)
-- ---------------------------------------------------------------------
create or replace function public.rechazar_solicitud_por_verificacion_sistema(
  p_solicitud_id uuid,
  p_verificacion_id uuid,
  p_motivo text default 'La verificación automática de identidad no pudo confirmarse. Vuelve a intentar la carga de tus documentos.'
) returns void language plpgsql security definer set search_path = public as $$
declare
  s public.solicitudes_conductor;
  v public.verificaciones_identidad_didit;
  v_sistema_id constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  select * into v from public.verificaciones_identidad_didit where id = p_verificacion_id for update;
  if v.id is null or v.solicitud_id <> p_solicitud_id then
    raise exception 'Verificación Didit no encontrada para esta solicitud.';
  end if;

  select * into s from public.solicitudes_conductor where id = p_solicitud_id for update;
  if s.id is null or s.estado <> 'en_revision' then
    raise exception 'La solicitud no está en revisión.';
  end if;

  perform set_config('ruum.decision_solicitud', 'solicitar_correccion', true);
  perform set_config('ruum.motivo_decision_solicitud', p_motivo, true);
  perform public.cambiar_estado_solicitud_conductor(s.id, 'requiere_correccion');
  perform set_config('ruum.decision_solicitud', '', true);
  perform set_config('ruum.motivo_decision_solicitud', '', true);

  update public.verificaciones_identidad_didit set procesado_en = now() where id = v.id;

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values ('verificacion_cuenta', 'sistema', v_sistema_id, jsonb_build_object(
    'solicitud_id', s.id, 'decision', 'rechazar_solicitud', 'motivo', p_motivo,
    'verificacion_didit_id', v.id, 'didit_session_id', v.session_id
  ));
end;
$$;

revoke all on function public.rechazar_solicitud_por_verificacion_sistema(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rechazar_solicitud_por_verificacion_sistema(uuid, uuid, text) to service_role;

comment on table public.verificaciones_identidad_didit is
  'Sesiones de verificación de identidad (OCR + liveness + face match) delegadas a Didit. Sólo el rol de servicio (webhook) escribe en esta tabla.';
comment on function public.aprobar_solicitud_conductor_sistema(uuid, uuid) is
  'Equivalente automático de aprobar_solicitud_conductor_admin: se invoca desde el webhook de Didit cuando la verificación resulta Approved. Sólo ejecutable por service_role.';
