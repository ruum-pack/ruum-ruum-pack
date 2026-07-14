create or replace function public.catalogar_vehiculo_para_tarifa(p_marca text, p_modelo text)
returns table(categoria_tarifa public.categoria_tarifa_vehiculo, gama public.gama_vehiculo)
language sql stable as $$
  with combinaciones as (
    select distinct c.categoria_tarifa, c.gama
    from public.catalogo_vehiculos_tarifa c
    where lower(public.unaccent(c.marca)) = lower(public.unaccent(p_marca))
      and lower(public.unaccent(c.modelo)) = lower(public.unaccent(p_modelo))
  )
  select combinaciones.categoria_tarifa, combinaciones.gama
  from combinaciones
  where (select count(*) from combinaciones) = 1;
$$;
