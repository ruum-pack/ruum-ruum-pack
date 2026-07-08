-- Complementa la sección Cuenta: perfil, dirección principal, facturación y
-- vehículos frecuentes. No almacena datos sensibles de tarjeta ni contraseña.
alter table public.usuarios
  add column foto_url text,
  add column pais text,
  add column estado text,
  add column direccion_principal text,
  add column correo_facturacion text;

alter table public.empresas
  add column rfc text,
  add column razon_social text,
  add column regimen_fiscal text,
  add column codigo_postal_fiscal text,
  add column uso_cfdi text,
  add column correo_facturacion text;

alter table public.vehiculos
  add column alias text,
  add column fotos_urls text[] not null default '{}';
