-- RT pagos conductor: se elimina Stripe Connect para conductores.
-- El cobro al usuario sigue usando Stripe PaymentIntent; este cambio solo
-- reemplaza la cuenta Express/transfer del conductor por datos bancarios
-- capturados en Ruum para pago operativo por transferencia.

alter type public.evento_auditable add value if not exists 'actualizacion_datos_bancarios_conductor';

create type public.estado_datos_bancarios_conductor as enum (
  'en_revision',
  'verificada',
  'rechazada'
);

create table public.datos_bancarios_conductor (
  id uuid primary key default gen_random_uuid(),
  conductor_id uuid not null unique references public.conductores(id) on delete cascade,
  titular_cuenta text not null,
  banco text not null,
  clabe text not null,
  numero_tarjeta text not null,
  estado public.estado_datos_bancarios_conductor not null default 'en_revision',
  motivo_rechazo text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint datos_bancarios_titular_requerido check (length(trim(titular_cuenta)) >= 3),
  constraint datos_bancarios_banco_requerido check (length(trim(banco)) >= 2),
  constraint datos_bancarios_clabe_formato check (clabe ~ '^[0-9]{18}$'),
  constraint datos_bancarios_tarjeta_formato check (numero_tarjeta ~ '^[0-9]{16,19}$')
);

create trigger datos_bancarios_conductor_actualizado_en
  before update on public.datos_bancarios_conductor
  for each row execute function public.set_actualizado_en();

alter table public.datos_bancarios_conductor enable row level security;

grant select on public.datos_bancarios_conductor to authenticated;

create policy "conductor_ve_sus_datos_bancarios"
  on public.datos_bancarios_conductor for select
  using (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

create policy "admin_acceso_total_datos_bancarios"
  on public.datos_bancarios_conductor for all
  using (public.es_admin());

comment on table public.datos_bancarios_conductor is
  'Datos bancarios capturados por el conductor para pagos por transferencia. Sustituye Stripe Connect para conductores.';
comment on column public.datos_bancarios_conductor.clabe is
  'CLABE mexicana de 18 digitos para transferencia bancaria.';
comment on column public.datos_bancarios_conductor.numero_tarjeta is
  'Numero de tarjeta del conductor para referencia operativa de pago; acceso limitado por RLS.';

create or replace function public.conductor_guarda_datos_bancarios(
  p_titular_cuenta text,
  p_banco text,
  p_clabe text,
  p_numero_tarjeta text
)
returns public.datos_bancarios_conductor
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conductor_id uuid;
  v_row public.datos_bancarios_conductor;
  v_clabe text := regexp_replace(coalesce(p_clabe, ''), '[^0-9]', '', 'g');
  v_tarjeta text := regexp_replace(coalesce(p_numero_tarjeta, ''), '[^0-9]', '', 'g');
begin
  select id into v_conductor_id
  from public.conductores
  where auth_user_id = auth.uid();

  if v_conductor_id is null then
    raise exception 'No se encontro el conductor autenticado.';
  end if;

  if length(trim(coalesce(p_titular_cuenta, ''))) < 3 then
    raise exception 'Escribe el nombre del titular de la cuenta.';
  end if;

  if length(trim(coalesce(p_banco, ''))) < 2 then
    raise exception 'Escribe el banco del conductor.';
  end if;

  if v_clabe !~ '^[0-9]{18}$' then
    raise exception using
      errcode = '23514',
      message = 'La CLABE debe tener exactamente 18 digitos.';
  end if;

  if v_tarjeta !~ '^[0-9]{16,19}$' then
    raise exception using
      errcode = '23514',
      message = 'El numero de tarjeta debe tener entre 16 y 19 digitos.';
  end if;

  insert into public.datos_bancarios_conductor (
    conductor_id,
    titular_cuenta,
    banco,
    clabe,
    numero_tarjeta,
    estado,
    motivo_rechazo
  )
  values (
    v_conductor_id,
    trim(p_titular_cuenta),
    trim(p_banco),
    v_clabe,
    v_tarjeta,
    'en_revision',
    null
  )
  on conflict (conductor_id) do update set
    titular_cuenta = excluded.titular_cuenta,
    banco = excluded.banco,
    clabe = excluded.clabe,
    numero_tarjeta = excluded.numero_tarjeta,
    estado = 'en_revision',
    motivo_rechazo = null
  returning * into v_row;

  insert into public.registro_auditoria (evento, actor, actor_id, datos)
  values (
    'actualizacion_datos_bancarios_conductor',
    'conductor',
    v_conductor_id,
    jsonb_build_object(
      'banco', v_row.banco,
      'clabe_ultimos4', right(v_row.clabe, 4),
      'tarjeta_ultimos4', right(v_row.numero_tarjeta, 4),
      'estado', v_row.estado
    )
  );

  return v_row;
end;
$$;

revoke all on function public.conductor_guarda_datos_bancarios(text, text, text, text) from public;
grant execute on function public.conductor_guarda_datos_bancarios(text, text, text, text) to authenticated;

alter table public.payouts_conductor
  rename column stripe_transfer_id to referencia_pago;

comment on column public.payouts_conductor.referencia_pago is
  'Referencia operativa del pago al conductor por transferencia bancaria.';

drop policy if exists "conductor_ve_su_cuenta_stripe" on public.cuentas_conductor_stripe;
drop policy if exists "admin_acceso_total_cuentas_stripe" on public.cuentas_conductor_stripe;
drop trigger if exists cuentas_conductor_stripe_actualizado_en on public.cuentas_conductor_stripe;
drop table if exists public.cuentas_conductor_stripe;
drop type if exists public.estado_cuenta_stripe;
