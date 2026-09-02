-- PR-08: Facturación atómica (FASE 8 / P2)
-- Actualización atómica transaccional de datos fiscales en usuarios y empresas via RPC.

create or replace function public.actualizar_datos_facturacion(
  p_rfc text default null,
  p_razon_social text default null,
  p_regimen_fiscal text default null,
  p_codigo_postal_fiscal text default null,
  p_uso_cfdi text default null,
  p_correo_facturacion text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid;
  v_usuario public.usuarios%rowtype;
  v_empresa_actualizada boolean := false;
  v_rfc text;
  v_razon_social text;
  v_regimen_fiscal text;
  v_codigo_postal_fiscal text;
  v_uso_cfdi text;
  v_correo_facturacion text;
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception 'Sin sesión activa' using errcode = '42501';
  end if;

  select * into v_usuario
  from public.usuarios
  where auth_user_id = v_auth_user_id
  for update;

  if not found then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;

  v_rfc := nullif(trim(p_rfc), '');
  v_razon_social := nullif(trim(p_razon_social), '');
  v_regimen_fiscal := nullif(trim(p_regimen_fiscal), '');
  v_codigo_postal_fiscal := nullif(trim(p_codigo_postal_fiscal), '');
  v_uso_cfdi := nullif(trim(p_uso_cfdi), '');
  v_correo_facturacion := nullif(trim(p_correo_facturacion), '');

  -- 1. Actualizar datos fiscales en usuarios
  update public.usuarios
  set
    rfc = v_rfc,
    razon_social = v_razon_social,
    regimen_fiscal = v_regimen_fiscal,
    codigo_postal_fiscal = v_codigo_postal_fiscal,
    uso_cfdi = v_uso_cfdi,
    correo_facturacion = v_correo_facturacion
  where id = v_usuario.id;

  -- 2. Si el usuario es titular de empresa, actualizar conjuntamente en empresas
  if v_usuario.empresa_id is not null and v_usuario.rol = 'titular_empresa' then
    update public.empresas
    set
      rfc = v_rfc,
      razon_social = v_razon_social,
      regimen_fiscal = v_regimen_fiscal,
      codigo_postal_fiscal = v_codigo_postal_fiscal,
      uso_cfdi = v_uso_cfdi,
      correo_facturacion = v_correo_facturacion
    where id = v_usuario.empresa_id;

    v_empresa_actualizada := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'usuario_id', v_usuario.id,
    'empresa_id', v_usuario.empresa_id,
    'empresa_actualizada', v_empresa_actualizada
  );
end;
$$;

revoke all on function public.actualizar_datos_facturacion(text, text, text, text, text, text) from public;
grant execute on function public.actualizar_datos_facturacion(text, text, text, text, text, text) to authenticated;
