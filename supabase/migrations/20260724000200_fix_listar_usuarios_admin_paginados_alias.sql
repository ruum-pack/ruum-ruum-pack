-- Corrige alias fuera de alcance en listar_usuarios_admin_paginados.

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
    raise exception using errcode = '42501', message = 'PERMISO_INSUFICIENTE';
  end if;

  v_limit := least(greatest(p_tamano, 1), 100);
  v_offset := (greatest(p_pagina, 1) - 1) * v_limit;

  if p_busqueda is not null and btrim(p_busqueda) <> '' then
    v_where := v_where || ' and (
      u.nombre ilike ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      or u.correo_facturacion ilike ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      or u.telefono ilike ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      or u.id::text ilike ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
    )';
  end if;

  execute format(
    'select count(*) from public.usuarios u where %s',
    v_where
  ) into v_total;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(sub) order by sub.creado_en desc), ''[]''::jsonb)
     from (
       select u.*
       from public.usuarios u
       where %s
       order by u.creado_en desc
       limit %L offset %L
     ) sub',
    v_where,
    v_limit,
    v_offset
  ) into v_filas;

  return jsonb_build_object(
    'data', v_filas,
    'paginacion', jsonb_build_object(
      'pagina', greatest(p_pagina, 1),
      'tamano', v_limit,
      'total', v_total,
      'total_paginas', ceil(v_total::numeric / v_limit)::int
    )
  );
end;
$$;

revoke all on function public.listar_usuarios_admin_paginados(int, int, text) from public;
grant execute on function public.listar_usuarios_admin_paginados(int, int, text) to authenticated;
