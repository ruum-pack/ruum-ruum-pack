-- catalogar_vehiculo_para_tarifa() llama a unaccent() sin calificar de
-- esquema. Mientras el único llamador tenía el search_path por defecto
-- (incluye public), funcionaba porque la extensión unaccent vive en public.
-- Pero usuario_previsualizar_tarifa (20260714000100) declara
-- `set search_path = ''` (buena práctica de seguridad) y, como
-- catalogar_vehiculo_para_tarifa es una función SQL simple, Postgres la
-- inlinea dentro de la llamadora -- heredando ese search_path vacío. Con
-- search_path vacío, unaccent() sin calificar ya no se encuentra:
--   ERROR 42883: function unaccent(text) does not exist
-- Esto rompía el 100% de las llamadas a usuario_previsualizar_tarifa, que es
-- lo que calcula la tarifa que se muestra en el paso "¿Cuándo lo
-- trasladamos?" del wizard de app-usuario (y también usuario_crea_traslado,
-- que usa la misma función para autoclasificar el vehículo al crear la
-- solicitud).
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
