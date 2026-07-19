-- Alta operativa de empresa corporativa desde panel-admin.
-- Crea empresa + usuario titular empresarial en una sola operacion auditada.

create or replace function public.admin_crea_empresa_corporativa(p_empresa jsonb, p_titular jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_empresa_id uuid;
  v_usuario_id uuid;
  v_nombre text;
  v_titular_nombre text;
  v_correo text;
begin
  if not public.es_admin() then raise exception 'Acceso denegado'; end if;
  if p_empresa is null or jsonb_typeof(p_empresa) <> 'object' then raise exception 'Datos de empresa requeridos'; end if;
  if p_titular is null or jsonb_typeof(p_titular) <> 'object' then raise exception 'Datos del titular requeridos'; end if;

  v_nombre := nullif(btrim(coalesce(p_empresa->>'nombre', '')), '');
  v_titular_nombre := nullif(btrim(coalesce(p_titular->>'nombre', '')), '');
  v_correo := lower(nullif(btrim(coalesce(p_titular->>'correo_facturacion', '')), ''));

  if v_nombre is null then raise exception 'Nombre comercial requerido'; end if;
  if nullif(btrim(coalesce(p_empresa->>'rfc', '')), '') is null then raise exception 'RFC requerido'; end if;
  if v_titular_nombre is null then raise exception 'Nombre del titular requerido'; end if;
  if v_correo is null then raise exception 'Correo del titular requerido'; end if;

  select id into v_admin_id from public.admins where auth_user_id = auth.uid();
  if v_admin_id is null then raise exception 'Admin no encontrado'; end if;

  insert into public.empresas (
    nombre, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, uso_cfdi,
    correo_facturacion, condiciones_pago, estado_verificacion
  ) values (
    v_nombre,
    upper(btrim(p_empresa->>'rfc')),
    nullif(btrim(coalesce(p_empresa->>'razon_social', '')), ''),
    nullif(btrim(coalesce(p_empresa->>'regimen_fiscal', '')), ''),
    nullif(btrim(coalesce(p_empresa->>'codigo_postal_fiscal', '')), ''),
    nullif(btrim(coalesce(p_empresa->>'uso_cfdi', '')), ''),
    lower(nullif(btrim(coalesce(p_empresa->>'correo_facturacion', '')), '')),
    nullif(btrim(coalesce(p_empresa->>'condiciones_pago', '')), ''),
    coalesce(nullif(p_empresa->>'estado_verificacion', ''), 'en_revision')::public.estado_verificacion
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
    upper(btrim(p_empresa->>'rfc')),
    nullif(btrim(coalesce(p_empresa->>'regimen_fiscal', '')), ''),
    nullif(btrim(coalesce(p_empresa->>'codigo_postal_fiscal', '')), ''),
    nullif(btrim(coalesce(p_empresa->>'uso_cfdi', '')), ''),
    coalesce((nullif(p_titular->>'metodo_pago_registrado', ''))::boolean, false)
  )
  returning id into v_usuario_id;

  insert into public.registro_auditoria (evento, actor, actor_id, datos)
  values (
    'creacion_cuenta',
    'admin',
    v_admin_id,
    jsonb_build_object('empresa_id', v_empresa_id, 'usuario_id', v_usuario_id, 'tipo', 'empresa_corporativa')
  );

  return jsonb_build_object('empresa_id', v_empresa_id, 'usuario_id', v_usuario_id);
end;
$$;

revoke all on function public.admin_crea_empresa_corporativa(jsonb, jsonb) from public;
grant execute on function public.admin_crea_empresa_corporativa(jsonb, jsonb) to authenticated;

comment on function public.admin_crea_empresa_corporativa(jsonb, jsonb) is
  'Alta corporativa desde Torre de Control: crea empresa y titular empresarial con auditoria.';
