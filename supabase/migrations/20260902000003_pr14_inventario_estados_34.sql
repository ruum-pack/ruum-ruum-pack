-- PR-14 — Inventario definitivo máquina de estados (34)
-- Reconcilia: código 34 (fuente de verdad), histórico 28 desactualizado, informe 32 desactualizado, catálogo 34.
-- Verifica que Supabase enum, transiciones, etiquetas, visual y operativo estén sincronizados.

-- El enum ya contiene 34 tras las migraciones 20260711000119/120/121 (cotizacion_aceptada) y el tipo supabase.ts ya refleja 34.
-- Esta migración es idempotente y asegura que no falte ningún estado ni transición.

-- Verificar enum tiene 34 valores
do $$
declare
  v_count int;
begin
  select count(*) into v_count from pg_enum where enumtypid = 'public.estado_traslado'::regtype;
  if v_count <> 34 then
    raise exception 'Inventario PR-14 falló: enum estado_traslado tiene % valores, se esperaban 34', v_count;
  end if;
end $$;

-- Asegurar transiciones faltantes estén presentes (idempotente)
insert into public.estado_transiciones_validas (estado_actual, estado_siguiente) values
  ('cotizacion_generada', 'cotizacion_aceptada'),
  ('cotizacion_aceptada', 'servicio_confirmado'),
  ('cotizacion_aceptada', 'servicio_cancelado')
on conflict do nothing;

-- Verificar que todo EstadoTraslado tiene al menos etiqueta, transición o terminal, categoría visual y etapa
-- Esto se valida vía tests de exhaustividad en packages/shared/src/states/estados-traslado.test.ts
-- Si se añade un nuevo estado al tipo sin actualizar ETIQUETA_ESTADO_TRASLADO, TRANSICIONES, CATEGORIA_POR_ESTADO, ETAPAS, el test fallará.

-- Comentario de auditoría: código es fuente de verdad, docs se regeneran desde él
comment on type public.estado_traslado is 'PR-14 inventario 34 estados — fuente de verdad: packages/shared/src/types/traslado.ts (ESTADOS_TRASLADO 34). Histórico 28 y informe 32 desactualizados.';
