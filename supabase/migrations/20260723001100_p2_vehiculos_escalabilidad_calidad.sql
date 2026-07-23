-- P2 escalabilidad y calidad: paginación backend para Vehículos.

create or replace function public.admin_listar_vehiculos_paginados(
  p_pagina integer default 1,
  p_tamano integer default 25,
  p_busqueda text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_tamano integer := least(greatest(coalesce(p_tamano, 25), 1), 10000);
  v_offset integer;
  v_busqueda text := nullif(btrim(coalesce(p_busqueda, '')), '');
  v_total integer := 0;
  v_vehiculos jsonb := '[]'::jsonb;
  v_usuarios jsonb := '[]'::jsonb;
begin
  if not public.admin_tiene_permiso('vehiculos:leer') then
    raise exception using errcode = '42501', message = 'PERMISO_INSUFICIENTE';
  end if;

  v_offset := (v_pagina - 1) * v_tamano;

  with filtrados as (
    select v.id
    from public.vehiculos v
    left join public.usuarios u on u.id = v.usuario_id
    where v_busqueda is null
      or v.marca ilike '%' || v_busqueda || '%'
      or v.modelo ilike '%' || v_busqueda || '%'
      or v.placas ilike '%' || v_busqueda || '%'
      or v.vin ilike '%' || v_busqueda || '%'
      or u.nombre ilike '%' || v_busqueda || '%'
      or u.correo_facturacion ilike '%' || v_busqueda || '%'
  )
  select count(*) into v_total from filtrados;

  with pagina as (
    select v.*
    from public.vehiculos v
    left join public.usuarios u on u.id = v.usuario_id
    where v_busqueda is null
      or v.marca ilike '%' || v_busqueda || '%'
      or v.modelo ilike '%' || v_busqueda || '%'
      or v.placas ilike '%' || v_busqueda || '%'
      or v.vin ilike '%' || v_busqueda || '%'
      or u.nombre ilike '%' || v_busqueda || '%'
      or u.correo_facturacion ilike '%' || v_busqueda || '%'
    order by v.creado_en desc nulls last, v.id desc
    limit v_tamano offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(pagina)), '[]'::jsonb)
  into v_vehiculos
  from pagina;

  with ids_usuario as (
    select distinct (vehiculo->>'usuario_id')::uuid as usuario_id
    from jsonb_array_elements(v_vehiculos) vehiculo
    where vehiculo ? 'usuario_id' and vehiculo->>'usuario_id' is not null
  )
  select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb)
  into v_usuarios
  from public.usuarios u
  inner join ids_usuario ids on ids.usuario_id = u.id;

  return jsonb_build_object(
    'vehiculos', v_vehiculos,
    'usuarios', v_usuarios,
    'paginacion', jsonb_build_object(
      'pagina', v_pagina,
      'tamano', v_tamano,
      'total', v_total,
      'total_paginas', case when v_total = 0 then 0 else ceil(v_total::numeric / v_tamano)::integer end
    )
  );
end;
$$;

revoke all on function public.admin_listar_vehiculos_paginados(integer, integer, text) from public;
grant execute on function public.admin_listar_vehiculos_paginados(integer, integer, text) to authenticated;
