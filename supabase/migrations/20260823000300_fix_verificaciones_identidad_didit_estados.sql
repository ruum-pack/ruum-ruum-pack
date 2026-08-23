-- =====================================================================
-- Migración: Fix estados y ciclo de vida de verificaciones_identidad_didit
-- =====================================================================

-- 1. Actualizar el constraint de estado en verificaciones_identidad_didit
--    para permitir todos los estados del ciclo de vida:
--    ('pendiente', 'en_revision', 'aprobado', 'rechazado', 'error', 'expirado', 'cancelado')

alter table public.verificaciones_identidad_didit
  drop constraint if exists verificaciones_identidad_didit_estado_check;

alter table public.verificaciones_identidad_didit
  add constraint verificaciones_identidad_didit_estado_check
  check (estado in ('pendiente', 'en_revision', 'aprobado', 'rechazado', 'error', 'expirado', 'cancelado'));

comment on constraint verificaciones_identidad_didit_estado_check on public.verificaciones_identidad_didit is
  'Permite todos los estados del ciclo de vida de Didit (pendiente, en_revision, aprobado, rechazado, error, expirado, cancelado).';
