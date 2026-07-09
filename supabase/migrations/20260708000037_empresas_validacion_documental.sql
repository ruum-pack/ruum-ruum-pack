-- PRD §17.12 / Fase 5.2 — empresas deja de ser mock en panel-admin.
-- Agrega los campos mínimos que el panel necesita para validar RFC, CFDI y
-- condiciones de pago sin inventar estado en la UI.

alter table public.empresas
  add column if not exists estado_verificacion public.estado_verificacion not null default 'pendiente',
  add column if not exists condiciones_pago text;
