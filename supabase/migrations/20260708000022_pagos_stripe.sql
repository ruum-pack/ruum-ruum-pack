-- Decisión de producto (Stripe, sesión de arquitectura 2026-06-27) — cierra
-- el "pendiente de modelarse" que dejó 0007_pagos.sql: el pago semanal al
-- conductor (PRD §4.6: "El conductor recibe pago semanal los viernes
-- mediante transferencia bancaria") es un proceso distinto al cobro al
-- usuario por traslado, vía Stripe Connect (cuentas Express).

-- Trazabilidad/idempotencia de Stripe en el cobro al usuario. Únicos para
-- que un webhook reintentado (Stripe reintenta si no recibe 200 a tiempo)
-- no procese el mismo evento dos veces.
alter table public.pagos
  add column stripe_payment_intent_id text unique,
  add column stripe_event_id text unique;

comment on column public.pagos.stripe_payment_intent_id is
  'PaymentIntent de Stripe asociado a este cobro.';
comment on column public.pagos.stripe_event_id is
  'Último evento de webhook de Stripe procesado para este pago (idempotencia ante reintentos de Stripe).';

-- Cuenta de Stripe Connect (Express) del conductor.
create type public.estado_cuenta_stripe as enum ('pendiente_onboarding', 'activa', 'rechazada', 'deshabilitada');

create table public.cuentas_conductor_stripe (
  id                 uuid primary key default gen_random_uuid(),
  conductor_id       uuid not null unique references public.conductores(id) on delete cascade,
  stripe_account_id  text not null unique,
  estado             public.estado_cuenta_stripe not null default 'pendiente_onboarding',
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

create trigger cuentas_conductor_stripe_actualizado_en
  before update on public.cuentas_conductor_stripe
  for each row execute function public.set_actualizado_en();

alter table public.cuentas_conductor_stripe enable row level security;

create policy "conductor_ve_su_cuenta_stripe"
  on public.cuentas_conductor_stripe for select
  using (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

create policy "admin_acceso_total_cuentas_stripe"
  on public.cuentas_conductor_stripe for all
  using (public.es_admin());

-- Payout semanal (Stripe Connect Transfer) — esto es lo que
-- apps/app-conductor/src/lib/datos-demo.ts simula con GANANCIAS_DEMO /
-- RESUMEN_SEMANAL_DEMO; con esta tabla, esa pantalla ya tiene un esquema
-- real al que conectarse cuando haya transferencias de verdad.
create type public.estado_payout as enum ('pendiente', 'procesado', 'fallido');

create table public.payouts_conductor (
  id                  uuid primary key default gen_random_uuid(),
  conductor_id        uuid not null references public.conductores(id),
  periodo_inicio      date not null,
  periodo_fin         date not null,
  monto_bruto         numeric(10,2) not null check (monto_bruto >= 0),
  ajustes             numeric(10,2) not null default 0,
  monto_neto          numeric(10,2) not null check (monto_neto >= 0),
  estado              public.estado_payout not null default 'pendiente',
  stripe_transfer_id  text unique,
  creado_en           timestamptz not null default now(),
  procesado_en        timestamptz,
  constraint payouts_conductor_periodo_valido check (periodo_fin >= periodo_inicio)
);

create index payouts_conductor_idx on public.payouts_conductor (conductor_id, periodo_inicio desc);

alter table public.payouts_conductor enable row level security;

create policy "conductor_ve_sus_payouts"
  on public.payouts_conductor for select
  using (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

create policy "admin_acceso_total_payouts"
  on public.payouts_conductor for all
  using (public.es_admin());
