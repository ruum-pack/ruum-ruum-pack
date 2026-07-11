-- RT-23 / RT-24 — Bandeja de solicitudes y trazabilidad de decisiones.

create table public.historial_estados_solicitud_conductor (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_conductor(id) on delete restrict,
  documento_id uuid references public.documentos_conductor(id) on delete restrict,
  revisado_por uuid references public.admins(id) on delete restrict,
  revisado_en timestamptz not null default now(),
  decision text not null check (decision in (
    'registro_inicial',
    'cambio_estado',
    'aprobar_documento',
    'rechazar_documento',
    'vencer_documento',
    'solicitar_correccion',
    'aprobar_solicitud',
    'rechazar_solicitud'
  )),
  motivo text,
  estado_anterior public.estado_expediente_conductor not null,
  estado_nuevo public.estado_expediente_conductor not null,
  creado_en timestamptz not null default now(),
  constraint historial_decision_admin_coherente check (
    decision in ('registro_inicial','cambio_estado') or revisado_por is not null
  ),
  constraint historial_motivo_rechazo_coherente check (
    decision not in ('rechazar_documento','vencer_documento','solicitar_correccion','rechazar_solicitud')
    or length(btrim(coalesce(motivo,''))) >= 5
  )
);

create index historial_solicitud_fecha_idx
  on public.historial_estados_solicitud_conductor(solicitud_id, revisado_en desc);
create index historial_revisor_fecha_idx
  on public.historial_estados_solicitud_conductor(revisado_por, revisado_en desc)
  where revisado_por is not null;
create index historial_documento_idx
  on public.historial_estados_solicitud_conductor(documento_id)
  where documento_id is not null;

insert into public.historial_estados_solicitud_conductor(
  solicitud_id, decision, motivo, estado_anterior, estado_nuevo, revisado_en
)
select id, 'registro_inicial', 'Estado existente al habilitar el historial.', estado, estado, actualizado_en
from public.solicitudes_conductor;

create or replace function public.registrar_transicion_solicitud_conductor()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admin_id uuid;
  v_decision text;
  v_motivo text;
begin
  if new.estado is not distinct from old.estado then return new; end if;

  select id into v_admin_id from public.admins where auth_user_id=auth.uid();
  v_decision:=nullif(current_setting('ruum.decision_solicitud',true),'');
  v_motivo:=nullif(current_setting('ruum.motivo_decision_solicitud',true),'');

  if v_decision is null then
    v_decision:=case
      when v_admin_id is not null and new.estado='aprobado' then 'aprobar_solicitud'
      when v_admin_id is not null and new.estado='rechazado' then 'rechazar_solicitud'
      when v_admin_id is not null and new.estado='requiere_correccion' then 'solicitar_correccion'
      else 'cambio_estado'
    end;
  end if;

  insert into public.historial_estados_solicitud_conductor(
    solicitud_id,revisado_por,decision,motivo,estado_anterior,estado_nuevo
  ) values(
    new.id,v_admin_id,v_decision,v_motivo,old.estado,new.estado
  );
  return new;
end;
$$;

create trigger registrar_transicion_solicitud_conductor
  after update of estado on public.solicitudes_conductor
  for each row execute function public.registrar_transicion_solicitud_conductor();

create or replace function public.bloquear_mutacion_historial_solicitud()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'El historial de decisiones es inmutable.';
end;
$$;

create trigger bloquear_mutacion_historial_solicitud
  before update or delete on public.historial_estados_solicitud_conductor
  for each row execute function public.bloquear_mutacion_historial_solicitud();

alter table public.historial_estados_solicitud_conductor enable row level security;
create policy "admin_lee_historial_solicitudes"
  on public.historial_estados_solicitud_conductor for select
  using (public.es_admin());

revoke all on public.historial_estados_solicitud_conductor from public, anon, authenticated;
grant select on public.historial_estados_solicitud_conductor to authenticated;

-- Toda revisión documental deja una decisión de servidor. Si el rechazo
-- cambia también el estado del expediente, el trigger anterior registra esa
-- transición como un evento separado de solicitud de corrección.
create or replace function public.revisar_documento_conductor_admin(
  p_documento_id uuid,
  p_estado text,
  p_notas text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_conductor_id uuid;
  v_solicitud_id uuid;
  v_estado_anterior public.estado_expediente_conductor;
  v_estado_nuevo public.estado_expediente_conductor;
  v_admin_id uuid;
  v_decision text;
  v_motivo text;
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  select id into v_admin_id from public.admins where auth_user_id=auth.uid();
  if v_admin_id is null then raise exception 'No se encontró el administrador autenticado.'; end if;
  if p_estado not in ('aprobado','rechazado','vencido') then raise exception 'Estado de revisión no permitido.'; end if;
  if p_estado<>'aprobado' and length(trim(coalesce(p_notas,'')))<5 then
    raise exception 'Escribe un motivo de al menos 5 caracteres.';
  end if;

  perform set_config('ruum.cambio_documento_autorizado','si',true);
  update public.documentos_conductor set
    estado=p_estado,
    notas_admin=case when p_estado='aprobado' then null else trim(p_notas) end,
    motivo_rechazo=case when p_estado='rechazado' then trim(p_notas) else null end,
    revisado_por=v_admin_id,revisado_en=now(),actualizado_en=now()
  where id=p_documento_id and es_actual
    and estado=case when p_estado='vencido' then 'aprobado' else 'en_revision' end
  returning conductor_id,solicitud_id into v_conductor_id,v_solicitud_id;
  perform set_config('ruum.cambio_documento_autorizado','',true);

  if v_conductor_id is null and v_solicitud_id is null then
    raise exception 'Documento no encontrado, no vigente o transición no permitida.';
  end if;
  if v_solicitud_id is null then
    select id into v_solicitud_id from public.solicitudes_conductor
    where conductor_id=v_conductor_id order by actualizado_en desc limit 1;
  end if;
  if v_solicitud_id is not null then
    select estado into v_estado_anterior from public.solicitudes_conductor where id=v_solicitud_id;
  end if;

  if p_estado='rechazado' and v_solicitud_id is not null and v_estado_anterior='en_revision' then
    perform set_config('ruum.decision_solicitud','solicitar_correccion',true);
    perform set_config('ruum.motivo_decision_solicitud',trim(p_notas),true);
    perform public.cambiar_estado_solicitud_conductor(v_solicitud_id,'requiere_correccion');
    perform set_config('ruum.decision_solicitud','',true);
    perform set_config('ruum.motivo_decision_solicitud','',true);
  elsif p_estado='rechazado' and v_conductor_id is not null and v_solicitud_id is null then
    select estado_expediente into v_estado_anterior from public.conductores where id=v_conductor_id;
    if v_estado_anterior='en_revision' then
      perform public.cambiar_estado_expediente_conductor(v_conductor_id,'requiere_correccion');
    end if;
  end if;

  if v_solicitud_id is not null then
    select estado into v_estado_nuevo from public.solicitudes_conductor where id=v_solicitud_id;
    v_decision:=case p_estado
      when 'aprobado' then 'aprobar_documento'
      when 'rechazado' then 'rechazar_documento'
      else 'vencer_documento'
    end;
    v_motivo:=case when p_estado='aprobado' then 'Documento validado.' else trim(p_notas) end;
    insert into public.historial_estados_solicitud_conductor(
      solicitud_id,documento_id,revisado_por,decision,motivo,estado_anterior,estado_nuevo
    ) values(
      v_solicitud_id,p_documento_id,v_admin_id,v_decision,v_motivo,v_estado_anterior,v_estado_nuevo
    );
  end if;

  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('validacion_documentos','admin',v_admin_id,jsonb_build_object(
    'solicitud_id',v_solicitud_id,'conductor_id',v_conductor_id,'documento_id',p_documento_id,
    'decision',p_estado,'motivo',v_motivo
  ));
end;
$$;

drop function if exists public.aprobar_solicitud_conductor_admin(uuid);
create function public.aprobar_solicitud_conductor_admin(
  p_solicitud_id uuid,
  p_motivo text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.solicitudes_conductor;
  v_conductor_id uuid;
  v_admin_id uuid;
  v_motivo text:=coalesce(nullif(trim(p_motivo),''),'Expediente, documentos y consentimientos validados.');
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  select id into v_admin_id from public.admins where auth_user_id=auth.uid();
  if v_admin_id is null then raise exception 'No se encontró el administrador autenticado.'; end if;
  select * into s from public.solicitudes_conductor where id=p_solicitud_id for update;
  if s.id is null or s.estado<>'en_revision' then raise exception 'La solicitud no está en revisión.'; end if;
  if exists (
    select 1 from (values ('licencia_frente'),('licencia_reverso'),('identificacion_oficial')) r(tipo)
    where not exists (
      select 1 from public.documentos_conductor d
      where d.solicitud_id=s.id and d.tipo=r.tipo and d.es_actual and d.estado='aprobado'
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
      where c.solicitud_id=s.id and c.tipo_documento=r.tipo
    )
  ) then raise exception 'Faltan consentimientos obligatorios.'; end if;

  perform set_config('ruum.aprobando_solicitud','si',true);
  insert into public.conductores (
    auth_user_id,nombre,telefono,curp,codigo_postal,estado_residencia,ciudad_municipio,colonia,calle,numero,referencias,
    licencia_numero,licencia_tipo,licencia_vigencia,autoriza_verificacion_antecedentes,declara_sin_suspensiones,
    contacto_emergencia_nombre,contacto_emergencia_telefono,version_terminos_aceptada,terminos_aceptados_en,marca_terminos
  ) values (
    s.auth_user_id,coalesce(s.datos_personales->>'nombre',''),s.datos_personales->>'telefono',s.curp_normalizada,
    s.domicilio->>'codigo_postal',s.domicilio->>'estado',s.domicilio->>'ciudad_municipio',s.domicilio->>'colonia',s.domicilio->>'calle',s.domicilio->>'numero',s.domicilio->>'referencias',
    s.licencia_normalizada,s.licencia->>'tipo',(s.licencia->>'vigencia')::date,
    true,true,
    s.contacto_emergencia->>'nombre',s.contacto_emergencia->>'telefono',1,now(),'registro_v2_consentimientos_historicos'
  ) returning id into v_conductor_id;
  perform set_config('ruum.aprobando_solicitud','',true);

  perform set_config('ruum.cambio_documento_autorizado','si',true);
  update public.documentos_conductor set conductor_id=v_conductor_id,solicitud_id=null where solicitud_id=s.id;
  perform set_config('ruum.cambio_documento_autorizado','',true);

  perform public.cambiar_estado_expediente_conductor(v_conductor_id,'listo_para_enviar');
  perform public.cambiar_estado_expediente_conductor(v_conductor_id,'en_revision');
  perform public.cambiar_estado_expediente_conductor(v_conductor_id,'aprobado');
  update public.conductores set estado='activo',documentos_vigentes=true where id=v_conductor_id;

  perform set_config('ruum.decision_solicitud','aprobar_solicitud',true);
  perform set_config('ruum.motivo_decision_solicitud',v_motivo,true);
  perform public.cambiar_estado_solicitud_conductor(s.id,'aprobado');
  perform set_config('ruum.decision_solicitud','',true);
  perform set_config('ruum.motivo_decision_solicitud','',true);
  update public.solicitudes_conductor set conductor_id=v_conductor_id where id=s.id;

  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('verificacion_cuenta','admin',v_admin_id,jsonb_build_object(
    'solicitud_id',s.id,'conductor_id',v_conductor_id,'decision','aprobar_solicitud','motivo',v_motivo
  ));
  return v_conductor_id;
end;
$$;

create or replace function public.rechazar_solicitud_conductor_admin(
  p_solicitud_id uuid,
  p_motivo text
) returns void language plpgsql security definer set search_path = public as $$
declare
  s public.solicitudes_conductor;
  v_admin_id uuid;
  v_motivo text:=trim(coalesce(p_motivo,''));
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  select id into v_admin_id from public.admins where auth_user_id=auth.uid();
  if v_admin_id is null then raise exception 'No se encontró el administrador autenticado.'; end if;
  if length(v_motivo)<5 then raise exception 'Escribe un motivo de al menos 5 caracteres.'; end if;
  select * into s from public.solicitudes_conductor where id=p_solicitud_id for update;
  if s.id is null or s.estado<>'en_revision' then raise exception 'La solicitud no está en revisión.'; end if;

  perform set_config('ruum.decision_solicitud','rechazar_solicitud',true);
  perform set_config('ruum.motivo_decision_solicitud',v_motivo,true);
  perform public.cambiar_estado_solicitud_conductor(s.id,'rechazado');
  perform set_config('ruum.decision_solicitud','',true);
  perform set_config('ruum.motivo_decision_solicitud','',true);

  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('verificacion_cuenta','admin',v_admin_id,jsonb_build_object(
    'solicitud_id',s.id,'decision','rechazar_solicitud','motivo',v_motivo
  ));
end;
$$;

revoke all on function public.revisar_documento_conductor_admin(uuid,text,text) from public,anon;
grant execute on function public.revisar_documento_conductor_admin(uuid,text,text) to authenticated;
revoke all on function public.aprobar_solicitud_conductor_admin(uuid,text) from public,anon;
grant execute on function public.aprobar_solicitud_conductor_admin(uuid,text) to authenticated;
revoke all on function public.rechazar_solicitud_conductor_admin(uuid,text) from public,anon;
grant execute on function public.rechazar_solicitud_conductor_admin(uuid,text) to authenticated;

comment on table public.historial_estados_solicitud_conductor is
  'Historial inmutable de transiciones y decisiones administrativas del expediente de alta.';
