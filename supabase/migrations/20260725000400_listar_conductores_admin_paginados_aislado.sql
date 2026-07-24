-- =============================================================================
-- Migration: listar_conductores_admin_paginados aislado
-- Descripcion: RPC paginado idempotente para conductores activos en panel admin.
-- =============================================================================

create or replace function public.listar_conductores_admin_paginados(
  p_pagina int default 1,
  p_tamano int default 25,
  p_busqueda text default null,
  p_estado text default null
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
  if not public.admin_tiene_permiso('conductores:leer') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  v_limit := least(greatest(coalesce(p_tamano, 25), 1), 100);
  v_offset := (greatest(coalesce(p_pagina, 1), 1) - 1) * v_limit;

  if p_estado is not null and p_estado <> 'todos' then
    v_where := v_where || ' AND c.estado = ' || quote_literal(p_estado) || '::public.estado_conductor';
  end if;

  if p_busqueda is not null and trim(p_busqueda) <> '' then
    v_where := v_where || ' AND (
      c.nombre ILIKE ' || quote_literal('%' || trim(p_busqueda) || '%') || '
      OR c.telefono ILIKE ' || quote_literal('%' || trim(p_busqueda) || '%') || '
      OR c.curp ILIKE ' || quote_literal('%' || trim(p_busqueda) || '%') || '
      OR c.licencia_numero ILIKE ' || quote_literal('%' || trim(p_busqueda) || '%') || '
      OR c.id::text ILIKE ' || quote_literal('%' || trim(p_busqueda) || '%') || '
    )';
  end if;

  execute format(
    'SELECT count(*) FROM public.conductores c WHERE %s',
    v_where
  ) into v_total;

  execute format(
    'SELECT coalesce(jsonb_agg(to_jsonb(sub)), ''[]''::jsonb) FROM (
      SELECT c.* FROM public.conductores c WHERE %s ORDER BY c.creado_en DESC LIMIT %L OFFSET %L
    ) sub',
    v_where,
    v_limit,
    v_offset
  ) into v_filas;

  return jsonb_build_object(
    'data', coalesce(v_filas, '[]'::jsonb),
    'paginacion', jsonb_build_object(
      'pagina', greatest(coalesce(p_pagina, 1), 1),
      'tamano', v_limit,
      'total', coalesce(v_total, 0),
      'total_paginas', case when coalesce(v_total, 0) = 0 then 0 else ceil(v_total::numeric / v_limit)::int end
    )
  );
end;
$$;

revoke all on function public.listar_conductores_admin_paginados(int, int, text, text) from public;
grant execute on function public.listar_conductores_admin_paginados(int, int, text, text) to authenticated;

comment on function public.listar_conductores_admin_paginados(int, int, text, text) is
  'Lista conductores para panel admin con paginacion y filtros; aislada para despliegues con migraciones parciales.';
