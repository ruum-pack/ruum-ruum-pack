-- PRD §4.6 — Pagos. "No se acepta efectivo." El pago debe quedar registrado
-- dentro del Pasaporte Digital de Traslado.
create type public.momento_pago as enum ('anticipado', 'al_cierre');
create type public.estado_pago as enum ('pendiente', 'completado', 'reembolsado', 'fallido');

create table public.pagos (
  id            uuid primary key default gen_random_uuid(),
  traslado_id   uuid not null references public.traslados(id) on delete cascade,
  monto         numeric(10,2) not null check (monto >= 0),
  momento       public.momento_pago not null,
  estado        public.estado_pago not null default 'pendiente',
  metodo        text not null,
  registrado_en timestamptz not null default now(),
  -- PRD §4.6 — "No se acepta efectivo." Regla dura también a nivel de base
  -- de datos, no solo en constants/metodos-pago.ts (defensa en profundidad).
  constraint metodo_no_efectivo check (lower(metodo) <> 'efectivo')
);

create index pagos_traslado_idx on public.pagos (traslado_id);

alter table public.pagos enable row level security;

create policy "usuario_ve_pagos_de_sus_traslados"
  on public.pagos for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_pagos"
  on public.pagos for all
  using (public.es_admin());

-- Nota: conductores NO tienen política de lectura sobre pagos — el PRD §3
-- no les otorga ese permiso ("No puede modificar precio"); su pago semanal
-- (PRD §4.6: "El conductor recibe pago semanal los viernes") es un proceso
-- agregado distinto a esta tabla de pagos por traslado, pendiente de
-- modelarse cuando se defina la integración con el proveedor de pagos.
