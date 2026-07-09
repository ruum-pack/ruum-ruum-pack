-- Preferencias de notificaciones del usuario. Defaults conservadores: avisos
-- operativos activos, promociones desactivadas.
alter table public.usuarios
  add column notificaciones_push boolean not null default true,
  add column notificaciones_email boolean not null default true,
  add column notificaciones_sms_whatsapp boolean not null default true,
  add column alertas_viaje boolean not null default true,
  add column alertas_pago boolean not null default true,
  add column alertas_evidencia boolean not null default true,
  add column notificaciones_promocionales boolean not null default false;
