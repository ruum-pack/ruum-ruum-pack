-- RT-17 / RT-18 — Evidencia histórica, separada e inmutable de cada
-- consentimiento otorgado durante el alta de conductor.

create type public.tipo_documento_consentimiento as enum (
  'terminos_servicio',
  'aviso_privacidad',
  'autorizacion_antecedentes',
  'declaracion_suspensiones'
);

create table public.versiones_documento_consentimiento (
  tipo_documento public.tipo_documento_consentimiento not null,
  version integer not null check (version>0),
  hash_documento text not null check (hash_documento ~ '^[0-9a-f]{64}$'),
  referencia text not null,
  vigente_desde timestamptz not null,
  vigente_hasta timestamptz,
  primary key(tipo_documento,version),
  check(vigente_hasta is null or vigente_hasta>vigente_desde)
);

insert into public.versiones_documento_consentimiento(
  tipo_documento,version,hash_documento,referencia,vigente_desde
) values
  ('terminos_servicio',1,'2b251d14e214b646cc5c1fbac552489caf45e616494cc205a7df0b239621a202','/docs-legales/terminos-y-condiciones-ruum-ruum.docx','2026-07-03T00:00:00Z'),
  ('aviso_privacidad',1,'a7a799394029c1d4b1e86918b1e3a18d495e3376ffcc561f3e7fe6836f6ef8cf','/docs-legales/aviso-de-privacidad-ruum-ruum.docx','2026-07-03T00:00:00Z'),
  ('autorizacion_antecedentes',1,'45036a337744aa53a347074ff5799556703836cae347a42095cb281e23d232eb','declaracion://autorizacion-antecedentes/v1','2026-07-03T00:00:00Z'),
  ('declaracion_suspensiones',1,'4cd02aa1ca0ff1d4617ea8f7e226a0f6153385f0b96faee0aab6f9b221dc43a1','declaracion://sin-suspensiones/v1','2026-07-03T00:00:00Z');

alter table public.versiones_documento_consentimiento enable row level security;
create policy "versiones_consentimiento_lectura"
  on public.versiones_documento_consentimiento for select using(true);
revoke insert,update,delete on public.versiones_documento_consentimiento from public,anon,authenticated;
grant select on public.versiones_documento_consentimiento to anon,authenticated;

create table public.consentimientos_usuario (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id),
  solicitud_id uuid references public.solicitudes_conductor(id),
  tipo_documento public.tipo_documento_consentimiento not null,
  version integer not null check(version>0),
  aceptado_en timestamptz not null default now(),
  canal text not null check(canal in ('web','android','ios','legacy_migracion')),
  version_app text not null check(length(btrim(version_app)) between 1 and 40),
  hash_documento text not null check(hash_documento ~ '^[0-9a-f]{64}$')
);
create unique index consentimientos_usuario_aceptacion_unica
  on public.consentimientos_usuario(
    auth_user_id,coalesce(solicitud_id,'00000000-0000-0000-0000-000000000000'::uuid),
    tipo_documento,version,hash_documento
  );
create index consentimientos_usuario_auth_fecha_idx
  on public.consentimientos_usuario(auth_user_id,aceptado_en desc);
create index consentimientos_usuario_solicitud_tipo_idx
  on public.consentimientos_usuario(solicitud_id,tipo_documento,aceptado_en desc)
  where solicitud_id is not null;

alter table public.consentimientos_usuario enable row level security;
create policy "usuario_ve_sus_consentimientos"
  on public.consentimientos_usuario for select using(auth.uid()=auth_user_id);
create policy "admin_ve_consentimientos"
  on public.consentimientos_usuario for select using(public.es_admin());
revoke insert,update,delete on public.consentimientos_usuario from public,anon,authenticated;
grant select on public.consentimientos_usuario to authenticated;

create or replace function public.bloquear_mutacion_consentimiento()
returns trigger language plpgsql set search_path=public as $$
begin
  raise exception 'El historial de consentimientos es inmutable; agrega una nueva aceptación.';
end;
$$;
create trigger consentimientos_usuario_append_only
  before update or delete on public.consentimientos_usuario
  for each row execute function public.bloquear_mutacion_consentimiento();

-- Compatibilidad: materializa la evidencia que todavía puede reconstruirse de
-- solicitudes y conductores legacy. Los registros nuevos nunca usan metadata.
insert into public.consentimientos_usuario(
  auth_user_id,solicitud_id,tipo_documento,version,aceptado_en,canal,version_app,hash_documento
)
select s.auth_user_id,s.id,x.tipo,
  case when x.tipo in ('terminos_servicio','aviso_privacidad') then greatest(coalesce(nullif(s.datos_personales->>'version_terminos_aceptada','')::integer,1),1) else 1 end,
  coalesce(nullif(s.datos_personales->>'terminos_aceptados_en','')::timestamptz,s.creado_en),
  'legacy_migracion','legacy',x.hash
from public.solicitudes_conductor s
cross join (values
  ('terminos_servicio'::public.tipo_documento_consentimiento,'2b251d14e214b646cc5c1fbac552489caf45e616494cc205a7df0b239621a202'),
  ('aviso_privacidad'::public.tipo_documento_consentimiento,'a7a799394029c1d4b1e86918b1e3a18d495e3376ffcc561f3e7fe6836f6ef8cf'),
  ('autorizacion_antecedentes'::public.tipo_documento_consentimiento,'45036a337744aa53a347074ff5799556703836cae347a42095cb281e23d232eb'),
  ('declaracion_suspensiones'::public.tipo_documento_consentimiento,'4cd02aa1ca0ff1d4617ea8f7e226a0f6153385f0b96faee0aab6f9b221dc43a1')
) x(tipo,hash)
where case x.tipo
  when 'terminos_servicio' then coalesce((s.datos_personales->>'acepta_terminos_privacidad')::boolean,false)
    or coalesce((s.datos_personales->>'version_terminos_aceptada')::integer,0)>0
  when 'aviso_privacidad' then coalesce((s.datos_personales->>'acepta_terminos_privacidad')::boolean,false)
    or coalesce((s.datos_personales->>'version_terminos_aceptada')::integer,0)>0
  when 'autorizacion_antecedentes' then coalesce((s.datos_personales->>'autoriza_verificacion_antecedentes')::boolean,false)
  else coalesce((s.datos_personales->>'declara_sin_suspensiones')::boolean,false)
end
on conflict do nothing;

insert into public.consentimientos_usuario(
  auth_user_id,solicitud_id,tipo_documento,version,aceptado_en,canal,version_app,hash_documento
)
select c.auth_user_id,s.id,x.tipo,
  case when x.tipo in ('terminos_servicio','aviso_privacidad') then greatest(coalesce(c.version_terminos_aceptada,1),1) else 1 end,
  coalesce(c.terminos_aceptados_en,c.creado_en),'legacy_migracion','legacy',x.hash
from public.conductores c
left join lateral(
  select sc.id from public.solicitudes_conductor sc
  where sc.auth_user_id=c.auth_user_id order by sc.actualizado_en desc limit 1
) s on true
cross join (values
  ('terminos_servicio'::public.tipo_documento_consentimiento,'2b251d14e214b646cc5c1fbac552489caf45e616494cc205a7df0b239621a202'),
  ('aviso_privacidad'::public.tipo_documento_consentimiento,'a7a799394029c1d4b1e86918b1e3a18d495e3376ffcc561f3e7fe6836f6ef8cf'),
  ('autorizacion_antecedentes'::public.tipo_documento_consentimiento,'45036a337744aa53a347074ff5799556703836cae347a42095cb281e23d232eb'),
  ('declaracion_suspensiones'::public.tipo_documento_consentimiento,'4cd02aa1ca0ff1d4617ea8f7e226a0f6153385f0b96faee0aab6f9b221dc43a1')
) x(tipo,hash)
where c.auth_user_id is not null and case x.tipo
  when 'terminos_servicio' then c.version_terminos_aceptada is not null
  when 'aviso_privacidad' then c.version_terminos_aceptada is not null
  when 'autorizacion_antecedentes' then c.autoriza_verificacion_antecedentes
  else c.declara_sin_suspensiones
end
on conflict do nothing;

create or replace function public.registrar_consentimientos_conductor(
  p_solicitud_id uuid,
  p_consentimientos jsonb,
  p_canal text,
  p_version_app text
) returns integer language plpgsql security definer set search_path=public as $$
declare
  v_auth uuid:=auth.uid(); v_item jsonb; v_tipo_text text; v_tipo public.tipo_documento_consentimiento;
  v_version integer; v_hash text; v_insertados integer:=0; v_filas integer;
begin
  if v_auth is null then raise exception 'Inicia sesión para registrar consentimientos.'; end if;
  if not exists(select 1 from public.solicitudes_conductor s where s.id=p_solicitud_id
    and s.auth_user_id=v_auth and s.estado in ('borrador','correo_pendiente','datos_incompletos','documentos_pendientes','requiere_correccion')) then
    raise exception 'La solicitud no existe, no te pertenece o ya no admite consentimientos.';
  end if;
  if jsonb_typeof(p_consentimientos)<>'array' or jsonb_array_length(p_consentimientos)=0 then
    raise exception 'Debes indicar al menos un consentimiento.';
  end if;
  if p_canal not in ('web','android','ios') then raise exception 'Canal de aceptación inválido.'; end if;
  if length(btrim(coalesce(p_version_app,''))) not between 1 and 40 then raise exception 'Versión de app inválida.'; end if;
  for v_item in select value from jsonb_array_elements(p_consentimientos) loop
    v_tipo_text:=v_item->>'tipo_documento';
    if v_tipo_text not in ('terminos_servicio','aviso_privacidad','autorizacion_antecedentes','declaracion_suspensiones') then
      raise exception 'Tipo de consentimiento inválido: %.',coalesce(v_tipo_text,'vacío');
    end if;
    v_tipo:=v_tipo_text::public.tipo_documento_consentimiento;
    begin v_version:=(v_item->>'version')::integer;
    exception when others then raise exception 'Versión inválida para %.',v_tipo_text; end;
    select d.hash_documento into v_hash from public.versiones_documento_consentimiento d
      where d.tipo_documento=v_tipo and d.version=v_version
        and d.vigente_desde<=now() and (d.vigente_hasta is null or d.vigente_hasta>now());
    if v_hash is null then raise exception 'La versión % de % no está vigente.',v_version,v_tipo_text; end if;
    insert into public.consentimientos_usuario(
      auth_user_id,solicitud_id,tipo_documento,version,canal,version_app,hash_documento
    ) values(v_auth,p_solicitud_id,v_tipo,v_version,p_canal,btrim(p_version_app),v_hash)
    on conflict do nothing;
    get diagnostics v_filas=row_count;
    v_insertados:=v_insertados+v_filas;
  end loop;
  if v_insertados>0 then
    insert into public.registro_auditoria(evento,actor,actor_id,datos)
    values('aceptacion_terminos','conductor',p_solicitud_id,jsonb_build_object(
      'accion','consentimientos_separados','registros',v_insertados,'canal',p_canal,'version_app',btrim(p_version_app)));
  end if;
  return v_insertados;
end;
$$;
revoke all on function public.registrar_consentimientos_conductor(uuid,jsonb,text,text) from public,anon;
grant execute on function public.registrar_consentimientos_conductor(uuid,jsonb,text,text) to authenticated;

create or replace function public.consentimientos_solicitud_completos(p_solicitud_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select not exists(
    select 1 from public.versiones_documento_consentimiento d
    where d.vigente_desde<=now() and (d.vigente_hasta is null or d.vigente_hasta>now())
      and not exists(
        select 1 from public.consentimientos_usuario c
        where c.solicitud_id=p_solicitud_id and c.tipo_documento=d.tipo_documento
          and c.version=d.version and c.hash_documento=d.hash_documento
      )
  );
$$;
revoke all on function public.consentimientos_solicitud_completos(uuid) from public,anon,authenticated;

create or replace function public.solicitud_conductor_datos_completos(p_solicitud_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    nullif(btrim(datos_personales->>'nombre'),'') is not null
    and nullif(btrim(datos_personales->>'telefono'),'') is not null
    and nullif(btrim(datos_personales->>'curp'),'') is not null
    and nullif(btrim(domicilio->>'codigo_postal'),'') is not null
    and nullif(btrim(domicilio->>'estado'),'') is not null
    and nullif(btrim(domicilio->>'ciudad_municipio'),'') is not null
    and nullif(btrim(domicilio->>'colonia'),'') is not null
    and nullif(btrim(domicilio->>'calle'),'') is not null
    and nullif(btrim(domicilio->>'numero'),'') is not null
    and nullif(btrim(licencia->>'numero'),'') is not null
    and nullif(btrim(licencia->>'tipo'),'') is not null
    and nullif(btrim(licencia->>'vigencia'),'') is not null
    and nullif(btrim(contacto_emergencia->>'nombre'),'') is not null
    and nullif(btrim(contacto_emergencia->>'telefono'),'') is not null
    and public.consentimientos_solicitud_completos(p_solicitud_id),false
  ) from public.solicitudes_conductor where id=p_solicitud_id;
$$;
revoke all on function public.solicitud_conductor_datos_completos(uuid) from public,anon,authenticated;

create or replace function public.cambiar_estado_solicitud_conductor(
  p_solicitud_id uuid,p_destino public.estado_expediente_conductor
) returns void language plpgsql security definer set search_path=public as $$
begin
  if p_destino in ('documentos_pendientes','listo_para_enviar','en_revision')
    and not public.consentimientos_solicitud_completos(p_solicitud_id) then
    raise exception 'Faltan consentimientos legales vigentes y separados.';
  end if;
  perform set_config('ruum.cambio_solicitud_autorizado','si',true);
  update public.solicitudes_conductor set estado=p_destino,enviado_en=case
    when p_destino in ('listo_para_enviar','en_revision','requiere_correccion','aprobado','rechazado','suspendido') then coalesce(enviado_en,now())
    else null end
  where id=p_solicitud_id;
  perform set_config('ruum.cambio_solicitud_autorizado','',true);
  if not found then raise exception 'Solicitud no encontrada.'; end if;
end;
$$;

comment on table public.consentimientos_usuario is
  'Historial append-only: una fila por documento, versión y aceptación; nunca se sobrescribe.';
