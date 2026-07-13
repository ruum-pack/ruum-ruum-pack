# Ruum Ruum by MoviliaX

Monorepo de Ruum Ruum: apps Next.js, paquetes compartidos, Supabase local y Edge Functions para la operacion de traslados vehiculares.

Para entender la arquitectura actual sin el historial de fases anteriores, lee [docs/architecture.md](docs/architecture.md).

## Requisitos

- Node.js 24
- pnpm 10 via Corepack
- Docker Desktop para Supabase local
- Deno para validar Edge Functions
- Playwright Chromium si vas a correr smokes de `panel-admin`

## Arranque rapido

```powershell
corepack enable
pnpm install
pnpm typecheck
pnpm test
```

Supabase local:

```powershell
pnpm db:start
pnpm db:reset
pnpm db:types
```

## Apps

- `apps/app-usuario`: registro, alta de traslados, seguimiento, pagos y soporte.
- `apps/app-conductor`: registro CONCER, panel, viajes, evidencia, chat y ganancias.
- `apps/panel-admin`: Torre de Control para viajes, conductores, usuarios, tarifas, pagos, incidencias y metricas.

Cada app tiene su propio `.env.example`. Los secretos de Edge Functions viven en `supabase/functions/.env.example`, no en las apps frontend.

## Paquetes

- `packages/shared`: tipos, estados, reglas puras, constantes y utilidades.
- `packages/ui`: sistema de componentes compartido.
- `packages/api`: clientes Supabase y servicios de dominio consumidos por las apps.

## Comandos utiles

```powershell
pnpm --filter @ruum/shared test
pnpm --filter @ruum/api test
pnpm --filter @ruum/panel-admin test:smoke
deno task check:functions
deno task test:functions
```

Regresiones sensibles:

- Cambios de Supabase deben mantener `pnpm db:reset` y `pnpm db:types` en verde.
- Cambios de traslado/pago deben mantener `b1_usuario_crea_traslado`, `b2_piso_techo_precio` y tests de Edge Functions.
- Cambios del panel admin deben mantener servicios `@ruum/api` y smoke browser de rutas criticas.

## Termux / Android

Turbo no soporta `android-arm64`, asi que en Termux usa los scripts sin Turbo:

```bash
pnpm run typecheck:android
pnpm run test:unit:android
```

`pnpm db:start` depende de Docker y no funciona en Android sin root.
