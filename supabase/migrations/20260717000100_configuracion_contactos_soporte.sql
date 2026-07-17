create table if not exists public.configuracion_contactos_soporte (
  ambiente text primary key check (ambiente in ('production', 'staging', 'development', 'test')),
  soporte_telefono text not null,
  soporte_correo text not null,
  emergencia_telefono text not null,
  actualizado_en timestamptz not null default now()
);

comment on table public.configuracion_contactos_soporte is
  'Canales oficiales de soporte por ambiente. La app publica los valores por NEXT_PUBLIC_* y esta tabla deja una fuente auditable para operaciones.';

insert into public.configuracion_contactos_soporte (
  ambiente,
  soporte_telefono,
  soporte_correo,
  emergencia_telefono
) values
  ('production', '5669522178', 'ruum.ruum.mx@gmail.com', '911'),
  ('staging', '5500000000', 'soporte-conductores-pruebas@example.test', '5500000911'),
  ('development', '5500000000', 'soporte-conductores-pruebas@example.test', '5500000911'),
  ('test', '5500000000', 'soporte-conductores-pruebas@example.test', '5500000911')
on conflict (ambiente) do update set
  soporte_telefono = excluded.soporte_telefono,
  soporte_correo = excluded.soporte_correo,
  emergencia_telefono = excluded.emergencia_telefono,
  actualizado_en = now();

alter table public.configuracion_contactos_soporte enable row level security;

drop policy if exists "configuracion_contactos_soporte_lectura" on public.configuracion_contactos_soporte;
create policy "configuracion_contactos_soporte_lectura"
  on public.configuracion_contactos_soporte
  for select
  to authenticated
  using (true);
