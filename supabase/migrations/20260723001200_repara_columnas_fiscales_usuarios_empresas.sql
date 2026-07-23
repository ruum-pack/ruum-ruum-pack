-- Repair idempotente: el alta corporativa inserta datos fiscales del titular
-- en usuarios. Algunos entornos remotos quedaron sin estas columnas por
-- migraciones antiguas no idempotentes.

alter table public.usuarios
  add column if not exists nombre text,
  add column if not exists telefono text,
  add column if not exists foto_url text,
  add column if not exists pais text,
  add column if not exists estado text,
  add column if not exists direccion_principal text,
  add column if not exists correo_facturacion text,
  add column if not exists rfc text,
  add column if not exists razon_social text,
  add column if not exists regimen_fiscal text,
  add column if not exists codigo_postal_fiscal text,
  add column if not exists uso_cfdi text;

alter table public.empresas
  add column if not exists rfc text,
  add column if not exists razon_social text,
  add column if not exists regimen_fiscal text,
  add column if not exists codigo_postal_fiscal text,
  add column if not exists uso_cfdi text,
  add column if not exists correo_facturacion text;
