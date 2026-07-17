-- RT-35 -- pasaporte_digital es security_invoker: la visibilidad real queda en
-- RLS de las tablas base, pero el rol autenticado necesita permiso SELECT sobre
-- la vista para que app-conductor pueda listar oportunidades operativas.
grant select on public.pasaporte_digital to authenticated;
