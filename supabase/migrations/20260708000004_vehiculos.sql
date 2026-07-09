-- PRD §4.2 — Vehículos. "Solo se aceptan vehículos en condiciones de
-- circular rodando." / "No se aceptan arrastres como servicio estándar."
create type public.tipo_vehiculo as enum (
  'sedan', 'suv', 'pick_up', 'van', 'luxury', 'coleccion'
);

create table public.vehiculos (
  id                          uuid primary key default gen_random_uuid(),
  usuario_id                  uuid not null references public.usuarios(id) on delete cascade,
  tipo                        public.tipo_vehiculo not null,
  marca                       text not null,
  modelo                      text not null,
  anio                        int not null check (anio between 1900 and 2100),
  -- PRD §4.2 — documentación obligatoria, con excepción de permiso especial
  tiene_tarjeta_circulacion   boolean not null default false,
  tiene_verificacion          boolean not null default false,
  tiene_placas                boolean not null default false,
  permiso_especial_vigente    text,
  puede_circular_rodando      boolean not null default false,
  creado_en                   timestamptz not null default now()
);

alter table public.vehiculos enable row level security;

create policy "usuario_ve_sus_vehiculos"
  on public.vehiculos for select
  using (
    usuario_id in (select id from public.usuarios where auth_user_id = auth.uid())
  );

create policy "usuario_administra_sus_vehiculos"
  on public.vehiculos for all
  using (
    usuario_id in (select id from public.usuarios where auth_user_id = auth.uid())
  );

create policy "admin_acceso_total_vehiculos"
  on public.vehiculos for all
  using (public.es_admin());

-- PRD §4.3 — "El cliente puede ver certificaciones, estatus y rendimiento
-- del conductor", lo simétrico aplica al conductor con el vehículo que va a
-- mover: necesita ver tipo/marca/modelo del traslado asignado, no la
-- titularidad completa. Se otorga vía join desde traslados (migración 0005),
-- no aquí, para no exponer todos los vehículos del usuario a cualquier conductor.
