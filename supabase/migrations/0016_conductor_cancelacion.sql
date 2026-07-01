-- Decisión de producto (sesión de arquitectura, 2026-06-27) — cierra el
-- vacío del PRD §4.8: esa sección solo definía consecuencias por NO
-- PRESENTACIÓN (no llegar). Cancelación activa de un traslado ya aceptado,
-- sin justificación, es una infracción distinta y necesitaba su propio
-- contador (ver packages/shared/src/rules/cancelacion-conductor.ts).
-- No se reutiliza no_presentaciones_6m: son dos infracciones distintas con
-- ventanas y escaladas distintas.
alter table public.conductores
  add column cancelaciones_sin_justificacion_count int not null default 0;

comment on column public.conductores.cancelaciones_sin_justificacion_count is
  'Cancelaciones de un traslado ya aceptado, sin justificación registrada por Admin. 1ra = suspendido_30d, 2da o más = bloqueado_permanente. Una cancelación con justificación válida no incrementa este contador (lógica de aplicación, igual criterio que no_presentaciones_6m).';
