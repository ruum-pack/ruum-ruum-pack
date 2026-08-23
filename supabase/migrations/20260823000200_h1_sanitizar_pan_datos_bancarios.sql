-- Migración H1: Sanitización y enmascaramiento de PAN (Número de tarjeta) en datos_bancarios_conductor.
-- Elimina el almacenamiento de PAN completo en texto plano para reducir alcance PCI-DSS y riesgo de fuga.
-- En México, las transferencias de pago operativo (SPEI) solo requieren CLABE de 18 dígitos y Banco.
-- El número de tarjeta se vuelve opcional y se persiste únicamente enmascarado (últimos 4 dígitos).

-- 1. Actualizar restricción de formato en datos_bancarios_conductor
alter table public.datos_bancarios_conductor
  drop constraint if exists datos_bancarios_tarjeta_formato;

alter table public.datos_bancarios_conductor
  alter column numero_tarjeta drop not null;

alter table public.datos_bancarios_conductor
  add constraint datos_bancarios_tarjeta_formato
  check (numero_tarjeta is null or numero_tarjeta ~ '^[0-9*]{4,19}$');

-- 2. Sanitizar datos históricos existentes: convertir cualquier PAN completo a versión enmascarada
update public.datos_bancarios_conductor
set numero_tarjeta = case
  when numero_tarjeta is null or length(trim(numero_tarjeta)) = 0 then null
  when length(numero_tarjeta) > 4 then repeat('*', length(numero_tarjeta) - 4) || right(numero_tarjeta, 4)
  else numero_tarjeta
end
where numero_tarjeta is not null;

-- 3. Actualizar función RPC conductor_guarda_datos_bancarios
create or replace function public.conductor_guarda_datos_bancarios(
  p_titular_cuenta text,
  p_banco text,
  p_clabe text,
  p_numero_tarjeta text default null
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
  v_tarjeta_raw text := regexp_replace(coalesce(p_numero_tarjeta, ''), '[^0-9*]', '', 'g');
  v_tarjeta_enmascarada text := null;
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

  -- Procesar tarjeta: si viene con dígitos, guardar únicamente formato enmascarado (últimos 4)
  if length(v_tarjeta_raw) > 0 then
    if v_tarjeta_raw ~ '^[0-9]{16,19}$' then
      v_tarjeta_enmascarada := repeat('*', length(v_tarjeta_raw) - 4) || right(v_tarjeta_raw, 4);
    elsif v_tarjeta_raw ~ '^[0-9*]{4,19}$' then
      v_tarjeta_enmascarada := repeat('*', greatest(length(v_tarjeta_raw) - 4, 0)) || right(v_tarjeta_raw, 4);
    else
      raise exception using
        errcode = '23514',
        message = 'El numero de tarjeta debe tener entre 16 y 19 digitos.';
    end if;
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
    v_tarjeta_enmascarada,
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
      'tarjeta_ultimos4', case when v_row.numero_tarjeta is not null then right(v_row.numero_tarjeta, 4) else null end,
      'estado', v_row.estado
    )
  );

  return v_row;
end;
$$;

comment on column public.datos_bancarios_conductor.numero_tarjeta is
  'Numero de tarjeta enmascarado (ultimos 4 digitos) como referencia opcional; nunca se almacena PAN completo.';
