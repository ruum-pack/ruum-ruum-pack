-- Empresas corporativas: operacion integral, RFC formal, versionado y cambios sensibles.

alter table public.empresas
  add column if not exists estado_operativo text not null default 'activa',
  add column if not exists limite_credito_mxn numeric(12,2) not null default 0,
  add column if not exists credito_disponible_mxn numeric(12,2) not null default 0,
  add column if not exists dias_credito integer not null default 0,
  add column if not exists requiere_orden_compra boolean not null default false,
  add column if not exists suspendida_en timestamptz,
  add column if not exists suspendida_por uuid references public.admins(id),
  add column if not exists motivo_suspension text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'empresas_estado_operativo_check'
      and conrelid = 'public.empresas'::regclass
  ) then
    alter table public.empresas
      add constraint empresas_estado_operativo_check
      check (estado_operativo in ('activa', 'suspendida'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'empresas_credito_no_negativo_check'
      and conrelid = 'public.empresas'::regclass
  ) then
    alter table public.empresas
      add constraint empresas_credito_no_negativo_check
      check (limite_credito_mxn >= 0 and credito_disponible_mxn >= 0 and dias_credito >= 0);
  end if;
end $$;

create or replace function public.rfc_mexicano_valido(p_rfc text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(upper(btrim(p_rfc)), '') ~
    '^([A-Z&Ñ]{3}|[A-Z&Ñ]{4})[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{3}$'
$$;

create unique index if not exists empresas_rfc_unico_idx
  on public.empresas (upper(rfc))
  where rfc is not null;

create table if not exists public.empresas_datos_fiscales_versiones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  version integer not null,
  rfc text not null,
  razon_social text,
  regimen_fiscal text,
  codigo_postal_fiscal text,
  uso_cfdi text,
  correo_facturacion text,
  vigente_desde timestamptz not null default now(),
  vigente_hasta timestamptz,
  creado_por uuid references public.admins(id),
  aprobado_por uuid references public.admins(id),
  cambio_sensible_id uuid,
  creado_en timestamptz not null default now(),
  unique (empresa_id, version)
);

create table if not exists public.empresas_condiciones_comerciales_versiones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  version integer not null,
  condiciones_pago text,
  limite_credito_mxn numeric(12,2) not null default 0,
  credito_disponible_mxn numeric(12,2) not null default 0,
  dias_credito integer not null default 0,
  requiere_orden_compra boolean not null default false,
  vigente_desde timestamptz not null default now(),
  vigente_hasta timestamptz,
  creado_por uuid references public.admins(id),
  aprobado_por uuid references public.admins(id),
  cambio_sensible_id uuid,
  creado_en timestamptz not null default now(),
  unique (empresa_id, version),
  check (limite_credito_mxn >= 0 and credito_disponible_mxn >= 0 and dias_credito >= 0)
);

create table if not exists public.empresas_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null,
  nombre text not null,
  folio text,
  url text,
  estado public.estado_verificacion not null default 'pendiente',
  vigente_desde date,
  vigente_hasta date,
  notas text,
  creado_por uuid references public.admins(id),
  revisado_por uuid references public.admins(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger empresas_documentos_actualizado_en
  before update on public.empresas_documentos
  for each row execute function public.set_actualizado_en();

create table if not exists public.empresas_cambios_sensibles (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null check (tipo in ('datos_fiscales', 'condiciones_comerciales')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  datos_anteriores jsonb not null default '{}'::jsonb,
  datos_propuestos jsonb not null default '{}'::jsonb,
  motivo text not null,
  solicitado_por uuid not null references public.admins(id),
  aprobado_por uuid references public.admins(id),
  solicitado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  comentario_resolucion text
);

alter table public.empresas_datos_fiscales_versiones
  add constraint empresas_datos_fiscales_cambio_fkey
  foreign key (cambio_sensible_id) references public.empresas_cambios_sensibles(id) on delete set null;

alter table public.empresas_condiciones_comerciales_versiones
  add constraint empresas_condiciones_cambio_fkey
  foreign key (cambio_sensible_id) references public.empresas_cambios_sensibles(id) on delete set null;

alter table public.empresas_datos_fiscales_versiones enable row level security;
alter table public.empresas_condiciones_comerciales_versiones enable row level security;
alter table public.empresas_documentos enable row level security;
alter table public.empresas_cambios_sensibles enable row level security;

grant select, update on public.empresas to authenticated;
grant select on public.empresas_datos_fiscales_versiones to authenticated;
grant select on public.empresas_condiciones_comerciales_versiones to authenticated;
grant select on public.empresas_documentos to authenticated;
grant select on public.empresas_cambios_sensibles to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='empresas_datos_fiscales_versiones' and policyname='admin_empresas_fiscal_lee') then
    create policy admin_empresas_fiscal_lee on public.empresas_datos_fiscales_versiones for select to authenticated
      using (public.admin_tiene_permiso('empresas:leer') or public.admin_tiene_permiso('empresas:gestionar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='empresas_condiciones_comerciales_versiones' and policyname='admin_empresas_condiciones_lee') then
    create policy admin_empresas_condiciones_lee on public.empresas_condiciones_comerciales_versiones for select to authenticated
      using (public.admin_tiene_permiso('empresas:leer') or public.admin_tiene_permiso('empresas:gestionar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='empresas_documentos' and policyname='admin_empresas_documentos_lee') then
    create policy admin_empresas_documentos_lee on public.empresas_documentos for select to authenticated
      using (public.admin_tiene_permiso('empresas:leer') or public.admin_tiene_permiso('empresas:gestionar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='empresas_cambios_sensibles' and policyname='admin_empresas_cambios_lee') then
    create policy admin_empresas_cambios_lee on public.empresas_cambios_sensibles for select to authenticated
      using (public.admin_tiene_permiso('empresas:leer') or public.admin_tiene_permiso('empresas:gestionar'));
  end if;
end $$;

create or replace function public.admin_crea_empresa_corporativa(p_empresa jsonb, p_titular jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_empresa_id uuid;
  v_usuario_id uuid;
  v_nombre text;
  v_titular_nombre text;
  v_correo text;
  v_rfc text;
begin
  if not public.admin_tiene_permiso('empresas:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  v_nombre := nullif(btrim(coalesce(p_empresa->>'nombre', '')), '');
  v_titular_nombre := nullif(btrim(coalesce(p_titular->>'nombre', '')), '');
  v_correo := lower(nullif(btrim(coalesce(p_titular->>'correo_facturacion', '')), ''));
  v_rfc := upper(nullif(btrim(coalesce(p_empresa->>'rfc', '')), ''));

  if v_nombre is null then raise exception 'Nombre comercial requerido'; end if;
  if v_rfc is null or not public.rfc_mexicano_valido(v_rfc) then raise exception 'RFC inválido'; end if;
  if exists (select 1 from public.empresas where upper(rfc) = v_rfc) then raise exception 'Ya existe una empresa con ese RFC'; end if;
  if v_titular_nombre is null then raise exception 'Nombre del titular requerido'; end if;
  if v_correo is null then raise exception 'Correo del titular requerido'; end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  insert into public.empresas (
    nombre, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, uso_cfdi,
    correo_facturacion, condiciones_pago, estado_verificacion, estado_operativo,
    limite_credito_mxn, credito_disponible_mxn, dias_credito, requiere_orden_compra
  ) values (
    v_nombre,
    v_rfc,
    nullif(btrim(coalesce(p_empresa->>'razon_social', '')), ''),
    nullif(btrim(coalesce(p_empresa->>'regimen_fiscal', '')), ''),
    nullif(btrim(coalesce(p_empresa->>'codigo_postal_fiscal', '')), ''),
    nullif(btrim(coalesce(p_empresa->>'uso_cfdi', '')), ''),
    lower(nullif(btrim(coalesce(p_empresa->>'correo_facturacion', '')), '')),
    nullif(btrim(coalesce(p_empresa->>'condiciones_pago', '')), ''),
    coalesce(nullif(p_empresa->>'estado_verificacion', ''), 'en_revision')::public.estado_verificacion,
    'activa',
    coalesce((nullif(p_empresa->>'limite_credito_mxn', ''))::numeric, 0),
    coalesce((nullif(p_empresa->>'credito_disponible_mxn', ''))::numeric, coalesce((nullif(p_empresa->>'limite_credito_mxn', ''))::numeric, 0)),
    coalesce((nullif(p_empresa->>'dias_credito', ''))::integer, 0),
    coalesce((nullif(p_empresa->>'requiere_orden_compra', ''))::boolean, false)
  )
  returning id into v_empresa_id;

  insert into public.usuarios (
    empresa_id, tipo_cuenta, rol, estado_verificacion, nombre, telefono,
    correo_facturacion, razon_social, rfc, regimen_fiscal, codigo_postal_fiscal, uso_cfdi,
    metodo_pago_registrado
  ) values (
    v_empresa_id,
    'empresa',
    'titular_empresa',
    coalesce(nullif(p_titular->>'estado_verificacion', ''), 'verificado')::public.estado_verificacion,
    v_titular_nombre,
    nullif(btrim(coalesce(p_titular->>'telefono', '')), ''),
    v_correo,
    nullif(btrim(coalesce(p_empresa->>'razon_social', '')), ''),
    v_rfc,
    nullif(btrim(coalesce(p_empresa->>'regimen_fiscal', '')), ''),
    nullif(btrim(coalesce(p_empresa->>'codigo_postal_fiscal', '')), ''),
    nullif(btrim(coalesce(p_empresa->>'uso_cfdi', '')), ''),
    coalesce((nullif(p_titular->>'metodo_pago_registrado', ''))::boolean, false)
  )
  returning id into v_usuario_id;

  insert into public.empresas_datos_fiscales_versiones (
    empresa_id, version, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal,
    uso_cfdi, correo_facturacion, creado_por, aprobado_por
  )
  select id, 1, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal,
    uso_cfdi, correo_facturacion, v_admin_id, v_admin_id
  from public.empresas
  where id = v_empresa_id;

  insert into public.empresas_condiciones_comerciales_versiones (
    empresa_id, version, condiciones_pago, limite_credito_mxn, credito_disponible_mxn,
    dias_credito, requiere_orden_compra, creado_por, aprobado_por
  )
  select id, 1, condiciones_pago, limite_credito_mxn, credito_disponible_mxn,
    dias_credito, requiere_orden_compra, v_admin_id, v_admin_id
  from public.empresas
  where id = v_empresa_id;

  insert into public.registro_auditoria (evento, actor, actor_id, datos)
  values (
    'creacion_cuenta',
    'admin',
    v_admin_id,
    jsonb_build_object('empresa_id', v_empresa_id, 'usuario_id', v_usuario_id, 'tipo', 'empresa_corporativa')
  );

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'empresas', 'crear',
    jsonb_build_object('empresa_id', v_empresa_id, 'usuario_id', v_usuario_id, 'rfc', v_rfc));

  return jsonb_build_object('empresa_id', v_empresa_id, 'usuario_id', v_usuario_id);
end;
$$;

create or replace function public.admin_actualiza_empresa_corporativa(
  p_empresa_id uuid,
  p_datos jsonb,
  p_motivo text default 'Actualizacion operativa'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_empresa public.empresas%rowtype;
  v_rfc text;
  v_cambio_fiscal uuid;
  v_cambio_condiciones uuid;
begin
  if not public.admin_tiene_permiso('empresas:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();
  select * into strict v_empresa from public.empresas where id = p_empresa_id for update;

  if p_datos ? 'nombre' or p_datos ? 'correo_facturacion' then
    update public.empresas
    set nombre = coalesce(nullif(btrim(p_datos->>'nombre'), ''), nombre),
        correo_facturacion = case when p_datos ? 'correo_facturacion' then lower(nullif(btrim(p_datos->>'correo_facturacion'), '')) else correo_facturacion end
    where id = p_empresa_id;
  end if;

  if p_datos ?| array['rfc','razon_social','regimen_fiscal','codigo_postal_fiscal','uso_cfdi'] then
    v_rfc := upper(coalesce(nullif(btrim(p_datos->>'rfc'), ''), v_empresa.rfc));
    if v_rfc is null or not public.rfc_mexicano_valido(v_rfc) then raise exception 'RFC inválido'; end if;
    if exists (select 1 from public.empresas where id <> p_empresa_id and upper(rfc) = v_rfc) then
      raise exception 'Ya existe una empresa con ese RFC';
    end if;

    insert into public.empresas_cambios_sensibles (
      empresa_id, tipo, datos_anteriores, datos_propuestos, motivo, solicitado_por
    ) values (
      p_empresa_id,
      'datos_fiscales',
      jsonb_build_object(
        'rfc', v_empresa.rfc,
        'razon_social', v_empresa.razon_social,
        'regimen_fiscal', v_empresa.regimen_fiscal,
        'codigo_postal_fiscal', v_empresa.codigo_postal_fiscal,
        'uso_cfdi', v_empresa.uso_cfdi,
        'correo_facturacion', v_empresa.correo_facturacion
      ),
      jsonb_build_object(
        'rfc', v_rfc,
        'razon_social', coalesce(p_datos->>'razon_social', v_empresa.razon_social),
        'regimen_fiscal', coalesce(p_datos->>'regimen_fiscal', v_empresa.regimen_fiscal),
        'codigo_postal_fiscal', coalesce(p_datos->>'codigo_postal_fiscal', v_empresa.codigo_postal_fiscal),
        'uso_cfdi', coalesce(p_datos->>'uso_cfdi', v_empresa.uso_cfdi),
        'correo_facturacion', coalesce(p_datos->>'correo_facturacion', v_empresa.correo_facturacion)
      ),
      coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'Actualizacion operativa'),
      v_admin_id
    )
    returning id into v_cambio_fiscal;
  end if;

  if p_datos ?| array['condiciones_pago','limite_credito_mxn','credito_disponible_mxn','dias_credito','requiere_orden_compra'] then
    insert into public.empresas_cambios_sensibles (
      empresa_id, tipo, datos_anteriores, datos_propuestos, motivo, solicitado_por
    ) values (
      p_empresa_id,
      'condiciones_comerciales',
      jsonb_build_object(
        'condiciones_pago', v_empresa.condiciones_pago,
        'limite_credito_mxn', v_empresa.limite_credito_mxn,
        'credito_disponible_mxn', v_empresa.credito_disponible_mxn,
        'dias_credito', v_empresa.dias_credito,
        'requiere_orden_compra', v_empresa.requiere_orden_compra
      ),
      jsonb_build_object(
        'condiciones_pago', coalesce(p_datos->>'condiciones_pago', v_empresa.condiciones_pago),
        'limite_credito_mxn', coalesce((p_datos->>'limite_credito_mxn')::numeric, v_empresa.limite_credito_mxn),
        'credito_disponible_mxn', coalesce((p_datos->>'credito_disponible_mxn')::numeric, v_empresa.credito_disponible_mxn),
        'dias_credito', coalesce((p_datos->>'dias_credito')::integer, v_empresa.dias_credito),
        'requiere_orden_compra', coalesce((p_datos->>'requiere_orden_compra')::boolean, v_empresa.requiere_orden_compra)
      ),
      coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'Actualizacion operativa'),
      v_admin_id
    )
    returning id into v_cambio_condiciones;
  end if;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'empresas', 'actualizar',
    jsonb_build_object('empresa_id', p_empresa_id, 'cambio_fiscal_id', v_cambio_fiscal, 'cambio_condiciones_id', v_cambio_condiciones));

  return jsonb_build_object(
    'empresa_id', p_empresa_id,
    'cambio_fiscal_id', v_cambio_fiscal,
    'cambio_condiciones_id', v_cambio_condiciones
  );
end;
$$;

create or replace function public.admin_resuelve_cambio_empresa(
  p_cambio_id uuid,
  p_aprobar boolean,
  p_comentario text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_cambio public.empresas_cambios_sensibles%rowtype;
  v_version integer;
begin
  if not public.admin_tiene_permiso('empresas:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();
  select * into strict v_cambio from public.empresas_cambios_sensibles where id = p_cambio_id for update;

  if v_cambio.estado <> 'pendiente' then
    raise exception 'El cambio ya fue resuelto';
  end if;

  if not p_aprobar then
    update public.empresas_cambios_sensibles
    set estado = 'rechazado', aprobado_por = v_admin_id, resuelto_en = now(), comentario_resolucion = p_comentario
    where id = p_cambio_id;
    return jsonb_build_object('cambio_id', p_cambio_id, 'estado', 'rechazado');
  end if;

  if v_cambio.tipo = 'datos_fiscales' then
    update public.empresas_datos_fiscales_versiones
    set vigente_hasta = now()
    where empresa_id = v_cambio.empresa_id and vigente_hasta is null;

    select coalesce(max(version), 0) + 1 into v_version
    from public.empresas_datos_fiscales_versiones
    where empresa_id = v_cambio.empresa_id;

    update public.empresas
    set rfc = upper(v_cambio.datos_propuestos->>'rfc'),
        razon_social = nullif(v_cambio.datos_propuestos->>'razon_social', ''),
        regimen_fiscal = nullif(v_cambio.datos_propuestos->>'regimen_fiscal', ''),
        codigo_postal_fiscal = nullif(v_cambio.datos_propuestos->>'codigo_postal_fiscal', ''),
        uso_cfdi = nullif(v_cambio.datos_propuestos->>'uso_cfdi', ''),
        correo_facturacion = lower(nullif(v_cambio.datos_propuestos->>'correo_facturacion', ''))
    where id = v_cambio.empresa_id;

    insert into public.empresas_datos_fiscales_versiones (
      empresa_id, version, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal,
      uso_cfdi, correo_facturacion, creado_por, aprobado_por, cambio_sensible_id
    ) values (
      v_cambio.empresa_id, v_version, upper(v_cambio.datos_propuestos->>'rfc'),
      nullif(v_cambio.datos_propuestos->>'razon_social', ''),
      nullif(v_cambio.datos_propuestos->>'regimen_fiscal', ''),
      nullif(v_cambio.datos_propuestos->>'codigo_postal_fiscal', ''),
      nullif(v_cambio.datos_propuestos->>'uso_cfdi', ''),
      lower(nullif(v_cambio.datos_propuestos->>'correo_facturacion', '')),
      v_cambio.solicitado_por, v_admin_id, p_cambio_id
    );
  else
    update public.empresas_condiciones_comerciales_versiones
    set vigente_hasta = now()
    where empresa_id = v_cambio.empresa_id and vigente_hasta is null;

    select coalesce(max(version), 0) + 1 into v_version
    from public.empresas_condiciones_comerciales_versiones
    where empresa_id = v_cambio.empresa_id;

    update public.empresas
    set condiciones_pago = nullif(v_cambio.datos_propuestos->>'condiciones_pago', ''),
        limite_credito_mxn = (v_cambio.datos_propuestos->>'limite_credito_mxn')::numeric,
        credito_disponible_mxn = (v_cambio.datos_propuestos->>'credito_disponible_mxn')::numeric,
        dias_credito = (v_cambio.datos_propuestos->>'dias_credito')::integer,
        requiere_orden_compra = (v_cambio.datos_propuestos->>'requiere_orden_compra')::boolean
    where id = v_cambio.empresa_id;

    insert into public.empresas_condiciones_comerciales_versiones (
      empresa_id, version, condiciones_pago, limite_credito_mxn, credito_disponible_mxn,
      dias_credito, requiere_orden_compra, creado_por, aprobado_por, cambio_sensible_id
    ) values (
      v_cambio.empresa_id, v_version, nullif(v_cambio.datos_propuestos->>'condiciones_pago', ''),
      (v_cambio.datos_propuestos->>'limite_credito_mxn')::numeric,
      (v_cambio.datos_propuestos->>'credito_disponible_mxn')::numeric,
      (v_cambio.datos_propuestos->>'dias_credito')::integer,
      (v_cambio.datos_propuestos->>'requiere_orden_compra')::boolean,
      v_cambio.solicitado_por, v_admin_id, p_cambio_id
    );
  end if;

  update public.empresas_cambios_sensibles
  set estado = 'aprobado', aprobado_por = v_admin_id, resuelto_en = now(), comentario_resolucion = p_comentario
  where id = p_cambio_id;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'empresas', 'aprobar_cambio',
    jsonb_build_object('empresa_id', v_cambio.empresa_id, 'cambio_id', p_cambio_id, 'tipo_cambio', v_cambio.tipo));

  return jsonb_build_object('cambio_id', p_cambio_id, 'estado', 'aprobado', 'version', v_version);
end;
$$;

create or replace function public.admin_cambia_estado_empresa(
  p_empresa_id uuid,
  p_estado_operativo text,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
begin
  if not public.admin_tiene_permiso('empresas:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if p_estado_operativo not in ('activa', 'suspendida') then raise exception 'Estado operativo inválido'; end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then raise exception 'Motivo requerido'; end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  update public.empresas
  set estado_operativo = p_estado_operativo,
      suspendida_en = case when p_estado_operativo = 'suspendida' then now() else null end,
      suspendida_por = case when p_estado_operativo = 'suspendida' then v_admin_id else null end,
      motivo_suspension = case when p_estado_operativo = 'suspendida' then btrim(p_motivo) else null end
  where id = p_empresa_id;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, motivo, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'empresas', p_estado_operativo, btrim(p_motivo),
    jsonb_build_object('empresa_id', p_empresa_id));

  return jsonb_build_object('empresa_id', p_empresa_id, 'estado_operativo', p_estado_operativo);
end;
$$;

create or replace function public.admin_guarda_usuario_empresa(
  p_empresa_id uuid,
  p_usuario jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_usuario_id uuid;
  v_rol text;
begin
  if not public.admin_tiene_permiso('empresas:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();
  v_rol := coalesce(nullif(p_usuario->>'rol', ''), 'usuario_autorizado');
  if v_rol not in ('titular_empresa', 'usuario_autorizado') then raise exception 'Rol empresarial inválido'; end if;

  if nullif(p_usuario->>'id', '') is null then
    insert into public.usuarios (
      empresa_id, tipo_cuenta, rol, estado_verificacion, nombre, telefono,
      correo_facturacion, metodo_pago_registrado
    ) values (
      p_empresa_id, 'empresa', v_rol, 'verificado',
      nullif(btrim(coalesce(p_usuario->>'nombre', '')), ''),
      nullif(btrim(coalesce(p_usuario->>'telefono', '')), ''),
      lower(nullif(btrim(coalesce(p_usuario->>'correo_facturacion', '')), '')),
      coalesce((nullif(p_usuario->>'metodo_pago_registrado', ''))::boolean, false)
    )
    returning id into v_usuario_id;
  else
    v_usuario_id := (p_usuario->>'id')::uuid;
    update public.usuarios
    set rol = v_rol,
        nombre = nullif(btrim(coalesce(p_usuario->>'nombre', '')), ''),
        telefono = nullif(btrim(coalesce(p_usuario->>'telefono', '')), ''),
        correo_facturacion = lower(nullif(btrim(coalesce(p_usuario->>'correo_facturacion', '')), '')),
        metodo_pago_registrado = coalesce((nullif(p_usuario->>'metodo_pago_registrado', ''))::boolean, metodo_pago_registrado)
    where id = v_usuario_id and empresa_id = p_empresa_id;
  end if;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'empresas', 'guardar_usuario',
    jsonb_build_object('empresa_id', p_empresa_id, 'usuario_id', v_usuario_id, 'rol', v_rol));

  return jsonb_build_object('empresa_id', p_empresa_id, 'usuario_id', v_usuario_id);
end;
$$;

create or replace function public.admin_guarda_documento_empresa(
  p_empresa_id uuid,
  p_documento jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_documento_id uuid;
begin
  if not public.admin_tiene_permiso('empresas:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  insert into public.empresas_documentos (
    empresa_id, tipo, nombre, folio, url, estado, vigente_desde, vigente_hasta, notas, creado_por
  ) values (
    p_empresa_id,
    coalesce(nullif(btrim(p_documento->>'tipo'), ''), 'contrato'),
    coalesce(nullif(btrim(p_documento->>'nombre'), ''), 'Documento empresarial'),
    nullif(btrim(coalesce(p_documento->>'folio', '')), ''),
    nullif(btrim(coalesce(p_documento->>'url', '')), ''),
    coalesce(nullif(p_documento->>'estado', ''), 'pendiente')::public.estado_verificacion,
    nullif(p_documento->>'vigente_desde', '')::date,
    nullif(p_documento->>'vigente_hasta', '')::date,
    nullif(btrim(coalesce(p_documento->>'notas', '')), ''),
    v_admin_id
  )
  returning id into v_documento_id;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'empresas', 'guardar_documento',
    jsonb_build_object('empresa_id', p_empresa_id, 'documento_id', v_documento_id));

  return jsonb_build_object('empresa_id', p_empresa_id, 'documento_id', v_documento_id);
end;
$$;

create index if not exists empresas_documentos_empresa_idx on public.empresas_documentos (empresa_id, vigente_hasta);
create index if not exists empresas_cambios_empresa_idx on public.empresas_cambios_sensibles (empresa_id, estado, solicitado_en desc);
create index if not exists empresas_datos_fiscales_vigente_idx on public.empresas_datos_fiscales_versiones (empresa_id) where vigente_hasta is null;
create index if not exists empresas_condiciones_vigente_idx on public.empresas_condiciones_comerciales_versiones (empresa_id) where vigente_hasta is null;

revoke all on function public.admin_actualiza_empresa_corporativa(uuid,jsonb,text) from public;
revoke all on function public.admin_resuelve_cambio_empresa(uuid,boolean,text) from public;
revoke all on function public.admin_cambia_estado_empresa(uuid,text,text) from public;
revoke all on function public.admin_guarda_usuario_empresa(uuid,jsonb) from public;
revoke all on function public.admin_guarda_documento_empresa(uuid,jsonb) from public;

grant execute on function public.admin_actualiza_empresa_corporativa(uuid,jsonb,text) to authenticated;
grant execute on function public.admin_resuelve_cambio_empresa(uuid,boolean,text) to authenticated;
grant execute on function public.admin_cambia_estado_empresa(uuid,text,text) to authenticated;
grant execute on function public.admin_guarda_usuario_empresa(uuid,jsonb) to authenticated;
grant execute on function public.admin_guarda_documento_empresa(uuid,jsonb) to authenticated;
