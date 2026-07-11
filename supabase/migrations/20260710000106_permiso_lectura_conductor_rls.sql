-- RT-09 — La policy de documentos consulta conductores para validar propiedad.
-- El GRANT habilita la consulta; RLS conserva el aislamiento por fila.
grant select on public.conductores to authenticated;
