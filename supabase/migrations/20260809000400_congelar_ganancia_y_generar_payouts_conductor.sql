-- Cierra el hueco detectado en "Mis ganancias" (app-conductor):
-- payouts_conductor nunca se llenaba porque nada congelaba
-- ganancia_conductor_congelada al CERRAR el viaje (solo se congelaba al
-- ACEPTARLO, en conductor_acepta_viaje / 20260720000100), y ningún proceso
-- agrupaba esas ganancias en payouts_conductor. Verificado en producción:
-- un traslado real cerrado (servicio_cerrado, $8,744.51 MXN cotizados)
-- tenía ganancia_conductor_congelada en NULL.
--
-- 1) Trigger de seguridad: cualquier camino que mueva un traslado a
--    'servicio_cerrado' (conductor_cierra_flujo_entrega,
--    conductor_cierra_viaje_sin_pago, admin_cambiar_estado_traslado, o
--    futuros) congela la ganancia si aún no estaba congelada, y registra
--    cuándo se cerró (cerrado_en).
-- 2) admin_generar_payouts_periodo: RPC (permiso pagos:ejecutar, mismo
--    patrón que admin_ejecutar_pago) que agrupa por conductor los
--    traslados cerrados de un periodo aún no incluidos en un payout
--    (payout_id is null) y crea el payout en payouts_conductor con estado
--    'pendiente'. Idempotente: una vez que un traslado queda enlazado a un
--    payout_id, una segunda corrida no lo vuelve a contar.
-- 3) Backfill: congela la ganancia del único traslado real ya cerrado que
--    quedó sin congelar antes de que existiera este trigger.
--
-- Ya se aplicó este mismo cambio directamente contra la base
-- (proyecto rgvzrzjfyzdedowgokjl) el 2026-08-09 vía MCP; esta migración
-- documenta el fix en el repo.

alter table public.traslados
  add column if not exists cerrado_en timestamptz,
  add column if not exists payout_id uuid references public.payouts_conductor(id);

create index if not exists traslados_pendientes_de_payout_idx
  on public.traslados (conductor_id, cerrado_en)
  where estado = 'servicio_cerrado' and payout_id is null;

-- 1) Congelar ganancia + marcar cerrado_en -------------------------------------
create or replace function public.congelar_ganancia_conductor_al_cerrar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_certificacion public.certificacion_conductor;
begin
  if new.conductor_id is not null then
    if new.ganancia_conductor_congelada is null then
      select certificacion_pago into v_certificacion
      from public.conductores
      where id = new.conductor_id;

      if v_certificacion is not null then
        new.ganancia_conductor_congelada := public.calcular_pago_conductor(
          v_certificacion,
          coalesce(new.precio_final, new.precio_cotizado)
        );
      end if;
    end if;

    if new.cerrado_en is null then
      new.cerrado_en := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists congelar_ganancia_conductor_al_cerrar on public.traslados;
create trigger congelar_ganancia_conductor_al_cerrar
  before update on public.traslados
  for each row
  when (new.estado = 'servicio_cerrado' and old.estado is distinct from new.estado)
  execute function public.congelar_ganancia_conductor_al_cerrar();

-- 2) Generar payouts por periodo -----------------------------------------------
create or replace function public.admin_generar_payouts_periodo(
  p_periodo_inicio date,
  p_periodo_fin date
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_conductor record;
  v_payout_id uuid;
  v_generados jsonb := '[]'::jsonb;
  v_total integer := 0;
begin
  if not public.admin_tiene_permiso('pagos:ejecutar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  if p_periodo_fin < p_periodo_inicio then
    raise exception using errcode='22023', message='PERIODO_INVALIDO';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  for v_conductor in
    select t.conductor_id, sum(t.ganancia_conductor_congelada) as bruto, count(*) as viajes
    from public.traslados t
    where t.estado = 'servicio_cerrado'
      and t.payout_id is null
      and t.ganancia_conductor_congelada is not null
      and t.cerrado_en::date between p_periodo_inicio and p_periodo_fin
    group by t.conductor_id
  loop
    insert into public.payouts_conductor (
      conductor_id, periodo_inicio, periodo_fin, monto_bruto, ajustes, monto_neto, estado
    ) values (
      v_conductor.conductor_id, p_periodo_inicio, p_periodo_fin,
      v_conductor.bruto, 0, v_conductor.bruto, 'pendiente'
    )
    returning id into v_payout_id;

    update public.traslados
    set payout_id = v_payout_id
    where conductor_id = v_conductor.conductor_id
      and estado = 'servicio_cerrado'
      and payout_id is null
      and ganancia_conductor_congelada is not null
      and cerrado_en::date between p_periodo_inicio and p_periodo_fin;

    v_generados := v_generados || jsonb_build_object(
      'payout_id', v_payout_id,
      'conductor_id', v_conductor.conductor_id,
      'monto_bruto', v_conductor.bruto,
      'viajes', v_conductor.viajes
    );
    v_total := v_total + 1;
  end loop;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'payouts_conductor', 'generar_periodo',
    jsonb_build_object('periodo_inicio', p_periodo_inicio, 'periodo_fin', p_periodo_fin,
      'payouts_generados', v_total));

  return jsonb_build_object('payouts_generados', v_total, 'detalle', v_generados);
end;
$$;

revoke all on function public.admin_generar_payouts_periodo(date, date) from public;
grant execute on function public.admin_generar_payouts_periodo(date, date) to authenticated;

-- 3) Backfill del traslado real que cerró antes de que existiera el trigger ----
update public.traslados t
set ganancia_conductor_congelada = public.calcular_pago_conductor(c.certificacion_pago, coalesce(t.precio_final, t.precio_cotizado)),
    cerrado_en = coalesce(t.cerrado_en, t.actualizado_en, now())
from public.conductores c
where c.id = t.conductor_id
  and t.estado = 'servicio_cerrado'
  and t.ganancia_conductor_congelada is null
  and t.conductor_id is not null;
