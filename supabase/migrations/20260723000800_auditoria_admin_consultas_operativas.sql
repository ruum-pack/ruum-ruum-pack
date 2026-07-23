-- Permite auditar consultas sensibles, no solo mutaciones o denegaciones.

alter table public.auditoria_admin_seguridad
  drop constraint if exists auditoria_admin_seguridad_tipo_check;

alter table public.auditoria_admin_seguridad
  add constraint auditoria_admin_seguridad_tipo_check
  check (tipo in ('acceso_denegado','permiso_denegado','mutacion','consulta'));
