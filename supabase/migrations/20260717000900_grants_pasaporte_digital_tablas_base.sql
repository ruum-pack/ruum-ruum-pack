-- RT-35 -- pasaporte_digital corre como security_invoker. Para que el rol
-- authenticated pueda consultar la vista, necesita SELECT en sus tablas base;
-- la visibilidad de filas permanece limitada por las policies RLS existentes.
grant select on public.traslados to authenticated;
grant select on public.vehiculos to authenticated;
grant select on public.evidencia_fotos to authenticated;
grant select on public.incidencias to authenticated;
grant select on public.pagos to authenticated;
