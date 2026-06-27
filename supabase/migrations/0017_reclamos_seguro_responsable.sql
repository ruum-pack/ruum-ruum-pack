-- Decisión de producto (sesión de arquitectura, 2026-06-27) — cierra la
-- ambigüedad del PRD §4.9: el deducible NUNCA se carga al usuario, sin
-- distinción de severidad del daño (mayor o menor) — se cubre por la
-- aplicación o por el conductor en caso de negligencia comprobada.
--
-- Esto NO contradice la nota original del PRD ("deducible y tiempos de
-- resolución deben validarse con la aseguradora y área legal"): esa nota
-- habla de MONTOS, que siguen sin modelarse aquí a propósito. Lo que esta
-- columna captura es solo QUIÉN absorbe el deducible, no CUÁNTO es.
alter table public.reclamos_seguro
  add column responsable_pago text check (responsable_pago in ('aplicacion', 'conductor'));

-- No se puede resolver un reclamo sin haber asignado responsable de pago.
alter table public.reclamos_seguro
  add constraint reclamos_seguro_responsable_si_resuelto
  check (estado <> 'resuelto' or responsable_pago is not null);

comment on column public.reclamos_seguro.responsable_pago is
  'Quién absorbe el deducible: aplicacion o conductor (nunca usuario, sin distinción de severidad del daño). No incluye montos, que siguen pendientes de validación con la aseguradora (ver nota original de esta tabla en 0012).';
