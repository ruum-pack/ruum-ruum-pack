-- Fase 1 de blindaje del registro de conductor (sesión 2026-07-10) — el
-- flujo de /registro en app-conductor no impedía a nivel de base de datos
-- que dos cuentas se registraran con la misma CURP, el mismo teléfono o el
-- mismo número de licencia. La validación del wizard solo comprueba formato,
-- no unicidad; sin constraint en Postgres, un conductor rechazado o alguien
-- de mala fe podía crear cuentas duplicadas indefinidamente.
--
-- Se usan índices únicos parciales (no "unique" directo en la columna)
-- porque:
--   1) Las columnas son nullable (conductores creados por el trigger sin
--      estos datos, o registros previos a esta migración).
--   2) Se normaliza con upper(trim(...)) para que "abc123" y "ABC123 " no
--      convivan como si fueran distintos.
--   3) El WHERE excluye vacíos/nulos: no queremos que dos filas con
--      telefono null (o '') choquen entre sí — eso rompería inserciones
--      legítimas que aún no tienen el dato.
--
-- Si esta migración falla al aplicarse es porque ya existen duplicados
-- reales en los datos actuales; hay que resolverlos manualmente antes
-- (ver query de diagnóstico comentada al final) — no bajar la guardia
-- quitando el constraint, es la señal de que hay que limpiar datos.

create unique index if not exists conductores_curp_unico
  on public.conductores (upper(trim(curp)))
  where curp is not null and trim(curp) <> '';

create unique index if not exists conductores_telefono_unico
  on public.conductores (trim(telefono))
  where telefono is not null and trim(telefono) <> '';

create unique index if not exists conductores_licencia_numero_unico
  on public.conductores (upper(trim(licencia_numero)))
  where licencia_numero is not null and trim(licencia_numero) <> '';

-- Diagnóstico manual si la migración falla por duplicados existentes:
--
-- select upper(trim(curp)), array_agg(id)
--   from public.conductores
--   where curp is not null and trim(curp) <> ''
--   group by 1 having count(*) > 1;
--
-- (repetir con telefono y licencia_numero)
