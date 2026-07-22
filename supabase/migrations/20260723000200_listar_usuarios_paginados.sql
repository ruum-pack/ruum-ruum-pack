-- =============================================================================
-- Migration: listar_usuarios_admin_paginados
-- Descripcion: RPC paginado para listar usuarios en el panel admin
-- =============================================================================

create or replace function public.listar_usuarios_admin_paginados(
  p_pagina int default 1,
  p_tamano int default 25,
  p_busqueda text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offset int;
  v_limit int;
  v_total bigint;
  v_filas jsonb;
  v_where text := 'true';
begin
  if not public.admin_tiene_permiso('usuarios:leer') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  v_limit := least(greatest(p_tamano, 1), 100);
  v_offset := (greatest(p_pagina, 1) - 1) * v_limit;

  if p_busqueda is not null and trim(p_busqueda) <> '' then
    v_where := v_where || ' AND (
      u.nombre ILIKE ' || quote_literal('%' || trim(p_busqueda) || '%') || '
      OR u.correo_facturacion ILIKE ' || quote_literal('%' || trim(p_busqueda) || '%') || '
      OR u.telefono ILIKE ' || quote_literal('%' || trim(p_busqueda) || '%') || '
      OR u.id::text ILIKE ' || quote_literal('%' || trim(p_busqueda) || '%') || '
    )';
  end if;

  execute format(
    'SELECT count(*) FROM public.usuarios u WHERE %s', v_where
  ) into v_total;

  execute format(
    'SELECT jsonb_agg(sub ORDER BY u.creado_en DESC) FROM (
      SELECT u.* FROM public.usuarios u WHERE %s ORDER BY u.creado_en DESC LIMIT %L OFFSET %L
    ) sub', v_where, v_limit, v_offset
  ) into v_filas;

  return jsonb_build_object(
    'data', coalesce(v_filas, '[]'::jsonb),
    'paginacion', jsonb_build_object(
      'pagina', p_pagina,
      'tamano', v_limit,
      'total', v_total,
      'total_paginas', ceil(v_total::numeric / v_limit)::int
    )
  );
end;
$$;

-- Grants
revoke all on function public.listar_usuarios_admin_paginados(int, int, text) from public;
grant execute on function public.listar_usuarios_admin_paginados(int, int, text) to authenticated;
