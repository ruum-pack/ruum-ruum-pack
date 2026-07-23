-- RPC aislado para la bandeja de traslados del panel admin.
-- Se mantiene separado de acciones masivas para poder desplegar la paginacion
-- aunque una migracion operativa mas amplia no se haya aplicado completa.

create or replace function public.listar_viajes_admin_paginados(
  p_pagina int default 1,
  p_tamano int default 25,
  p_filtro_estado text default 'todos',
  p_busqueda text default null,
  p_orden_columna text default 'creado_en',
  p_orden_direccion text default 'desc'
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
  v_order text;
begin
  if not public.admin_tiene_permiso('viajes:leer') then
    raise exception using errcode = '42501', message = 'PERMISO_INSUFICIENTE';
  end if;

  v_limit := least(greatest(coalesce(p_tamano, 25), 1), 100);
  v_offset := (greatest(coalesce(p_pagina, 1), 1) - 1) * v_limit;

  if p_filtro_estado is not null and p_filtro_estado <> 'todos' then
    v_where := v_where || ' AND p.estado = ' || quote_literal(p_filtro_estado) || '::public.estado_traslado';
  end if;

  if p_busqueda is not null and btrim(p_busqueda) <> '' then
    v_where := v_where || ' AND (
      p.traslado_id::text ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.origen_ciudad ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.destino_ciudad ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.vehiculo_marca ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.vehiculo_modelo ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.vehiculo_placas ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
      OR p.conductor_nombre ILIKE ' || quote_literal('%' || btrim(p_busqueda) || '%') || '
    )';
  end if;

  v_order := case
    when p_orden_columna = 'folio' then 'p.traslado_id'
    when p_orden_columna = 'inicio_programado' then 'coalesce(p.fecha_hora_programada, p.creado_en)'
    when p_orden_columna = 'ruta' then 'p.origen_ciudad'
    when p_orden_columna = 'vehiculo' then 'p.vehiculo_marca'
    when p_orden_columna = 'conductor' then 'p.conductor_nombre'
    when p_orden_columna = 'estatus' then 'p.estado'
    else 'p.creado_en'
  end || case when lower(coalesce(p_orden_direccion, 'desc')) = 'asc' then ' ASC' else ' DESC' end;

  execute format('select count(*) from public.pasaporte_digital p where %s', v_where)
    into v_total;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(f)), ''[]''::jsonb)
     from (
       select p.*
       from public.pasaporte_digital p
       where %s
       order by %s
       limit %L offset %L
     ) f',
    v_where,
    v_order,
    v_limit,
    v_offset
  ) into v_filas;

  return jsonb_build_object(
    'data', coalesce(v_filas, '[]'::jsonb),
    'paginacion', jsonb_build_object(
      'pagina', greatest(coalesce(p_pagina, 1), 1),
      'tamano', v_limit,
      'total', coalesce(v_total, 0),
      'total_paginas', case
        when coalesce(v_total, 0) = 0 then 0
        else ceil(v_total::numeric / v_limit)::int
      end
    )
  );
end;
$$;

revoke all on function public.listar_viajes_admin_paginados(int, int, text, text, text, text) from public;
grant execute on function public.listar_viajes_admin_paginados(int, int, text, text, text, text) to authenticated;

comment on function public.listar_viajes_admin_paginados(int, int, text, text, text, text) is
  'Lista traslados del panel admin con paginacion, busqueda y ordenamiento seguros.';
