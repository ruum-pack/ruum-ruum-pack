-- RT-03 — Los GRANT de tabla complementan RLS; sin ambos PostgREST rechaza
-- la petición antes de evaluar las políticas.

grant select, update on public.solicitudes_conductor to authenticated;
grant select, insert on public.documentos_conductor to authenticated;
grant select on public.expediente_conductor_transiciones to authenticated;
grant select on public.documento_conductor_transiciones to authenticated;
