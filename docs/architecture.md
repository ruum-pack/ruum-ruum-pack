# Arquitectura

Este documento describe el estado actual del monorepo. El README queda como guia de arranque; el historial de decisiones y fases anteriores vive en los documentos especificos de `docs/`, READMEs de apps y migraciones.

## Vision General

Ruum Ruum se organiza como un monorepo pnpm con tres apps Next.js, tres paquetes compartidos y una capa Supabase local/desplegable.

```text
apps/
  app-usuario/
  app-conductor/
  panel-admin/
packages/
  shared/
  ui/
  api/
supabase/
  migrations/
  test/
  functions/
```

La regla general es que el frontend orquesta experiencia, pero las decisiones sensibles viven en servidor, RPC, RLS, triggers o Edge Functions.

## Apps

### app-usuario

Responsable de registro/login de usuarios, alta de traslados, seguimiento del Pasaporte Digital, pagos, chat, disputas y soporte. Usa `@ruum/api` para hablar con Supabase y `@ruum/shared` para validar reglas antes de enviar, sin tratar esa validacion frontend como fuente de verdad.

Variables publicas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

### app-conductor

Responsable de registro CONCER, revision de expediente, panel del conductor, viajes, evidencia, chat, emergencia y ganancias. El registro conserva un flujo de varios pasos y emite telemetria operacional; las decisiones administrativas del expediente se mantienen del lado de Supabase/admin.

Variables publicas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_VERSION`.

### panel-admin

Torre de Control. Concentra lectura operativa, tarifas, asignacion, expediente de conductores, pagos, incidencias, disputas, reclamos, mapa y metricas. El panel no debe sustituir la autoridad de RPC/RLS para cambios sensibles; los servicios de `packages/api` son la capa reusable que centraliza esas operaciones.

Rutas criticas cubiertas por smoke browser: `/`, `/viajes`, `/tarifas`, `/mapa`, `/metricas-registro`.

## Paquetes

### packages/shared

Contiene tipos de dominio, estados, transiciones, reglas puras, catalogos y utilidades. Debe permanecer libre de dependencias de Next/Supabase runtime para que pueda probarse con Vitest y usarse desde apps/servicios.

### packages/ui

Sistema de componentes compartido y tokens visuales. Exporta componentes y `styles/tokens.css`. Las apps importan el paquete por workspace, no mediante copias.

### packages/api

Contiene clientes Supabase tipados y servicios de dominio. Aqui viven servicios usados por apps como `admin`, `tarifas`, `traslados`, `conductores`, `evidencia`, `chat` y `auditoria`.

Las pruebas unitarias mockean el cliente Supabase para proteger contratos de servicio: normalizacion de metricas, filtros, validaciones locales, payloads admin y delegacion a RPCs.

## Supabase

### Migraciones

`supabase/migrations` define esquema, RLS, triggers, RPCs y vistas. Para cambios de esquema, la ruta preferida es:

```powershell
pnpm db:reset
pnpm db:types
```

Si un reset limpio falla, se corrige la migracion temprana rota, no se tapa con una migracion posterior.

### Tests SQL

`supabase/test` contiene regresiones transaccionales. La matriz completa por flujo vive en `docs/sql-test-matrix.md` y cubre traslado, pago, identidad, conductor, admin, auditoria, RLS y metricas.

### Edge Functions

`supabase/functions` contiene funciones para Stripe, Twilio, validacion documental y limpieza de documentos. Sus secretos se documentan en `supabase/functions/.env.example`.

Comandos:

```powershell
deno task check:functions
deno task test:functions
```

## Reglas Sensibles

- `presupuesto_usuario` es solo referencia del usuario; cobros usan `precio_final ?? precio_cotizado`.
- `tipo_pago` y autorizacion de creacion de traslado se deciden en Supabase, no por el payload del cliente.
- Estados administrativos de conductores se cambian por RPC/servicios admin auditables.
- Documentos sensibles se validan por Edge Function + RPC, no por escrituras directas del cliente.
- El panel admin puede iniciar acciones, pero RLS/RPC/triggers siguen siendo la barrera de verdad.

## CI y Verificacion

Workflows relevantes:

- `ci.yml`: instala con lockfile congelado, corre `pnpm typecheck`, `pnpm test:unit`, `deno task check:functions` y smoke browser de `panel-admin`.
- `supabase-types.yml`: reset local, genera tipos y falla si `packages/shared/src/types/supabase.ts` queda desfasado.
- `traslados-pagos-regression.yml`: corre SQL y Edge tests para traslado/pago cuando cambian rutas sensibles.

Checks locales recomendados segun cambio:

```powershell
pnpm typecheck
pnpm test
pnpm --filter @ruum/api test
pnpm --filter @ruum/panel-admin test:smoke
deno task check:functions
deno task test:functions
git diff --check
```

## Documentacion Por Area

- `apps/app-usuario/README.md`
- `apps/app-conductor/README.md`
- `apps/panel-admin/README.md`
- `supabase/functions/README.md`
- `docs/registro-conductor-regresion.md`
- `docs/RT-12-modelo-de-tarifas.md`
