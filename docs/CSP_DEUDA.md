# P2 CSP — Deuda documentada y plan de retiro

## Estado actual (producción) — actualización 2026-08-23
CSP prod sin `unsafe-eval` (eliminado). `script-src` ya usa `nonce` por request vía `middleware` + `strict-dynamic`, por lo que `unsafe-inline` para scripts queda solo como fallback para navegadores sin soporte nonce (deuda residual mínima). `style-src` mantiene `unsafe-inline` como deuda temporal:

- `style-src 'self' 'unsafe-inline' 'nonce-...'` — requerido por Tailwind CSS y Next.js styled-jsx que inyectan estilos en runtime. Sin `unsafe-inline` los estilos no se aplican en SSR. Migración completa a `nonce` requiere pasar nonce a cada `<style>` generado por Next — parcialmente hecho vía `middleware` que añade `nonce` a `style-src`, pero Next aún inyecta estilos sin nonce. `unsafe-inline` se mantiene como fallback hasta validación report-only.
- `script-src 'self' 'nonce-...' 'strict-dynamic' https://*.sentry.io` — en prod ya no contiene `unsafe-eval` ni depende de `unsafe-inline` para scripts propios; Next hidratación usa `strict-dynamic` + `nonce`. Se eliminaron inline propios (`/theme-init.js` externo con `beforeInteractive` + `nonce`, `/auth-callback-fallback.js` externo), y se movieron 3 `<style dangerouslySetInnerHTML>` a `globals.css`. `unsafe-inline` para scripts solo queda como fallback para navegadores antiguos (ignorado cuando `nonce`/`strict-dynamic` está presente).

## Inventario inline eliminado en P2
- `src/app/layout.tsx` — theme script inline → `/public/theme-init.js` (externo, `Script beforeInteractive`)
- `src/app/auth/callback/route.ts` — HTML fallback con script interpolado `${origin}`/`${type}` → `/public/auth-callback-fallback.js` estático (sin interpolación, usa `window.location.origin`)
- `src/app/viajes/[id]/TripDetailsClient.tsx`, `CierreTrasladoDetails.tsx`, `viajes/[id]/evidencia/page.tsx` — `<style dangerouslySetInnerHTML>` con `@keyframes fadeIn` → `src/app/globals.css`
- `cap-shell/index.html` — queda fuera de Next (Capacitor offline shell), no sujeto a header CSP de Next; tiene su propio contexto `capacitor://`.

## CSP por ambiente (actualizado con middleware nonce)
- **Dev** (`NODE_ENV !== production`): `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io` + `connect-src ... ws: wss: http://localhost:*` para HMR. `style-src` incluye `nonce` pero mantiene `unsafe-inline` para DX.
- **Prod** (vía `middleware`): `script-src 'self' 'nonce-{random}' 'strict-dynamic' https://*.sentry.io` (sin `unsafe-eval` y sin depender de `unsafe-inline`), `style-src 'self' 'unsafe-inline' 'nonce-{random}'`, resto igual a dev sin `ws/wss`. `next.config` mantiene fallback con `unsafe-inline` para requests no cubiertos por middleware (estáticos).
- **Staging** (`NEXT_PUBLIC_RUUM_AMBIENTE=staging`): además `Content-Security-Policy-Report-Only` con `report-uri /api/csp-report` para validar sin romper (middleware).

Directivas adicionales endurecidas: `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `worker-src 'self' blob:'`.

`connect-src`/`img-src` confirmados: `https://*.supabase.co` (Supabase), `https://*.mapbox.com` (Mapbox), `https://*.sentry.io` (Sentry). No se añadieron dominios extra; Capacitor `capacitor://*` se evaluará si se detectan violaciones en report-only.

## Plan de retiro de deuda (actualizado)
1. ✅ Generar nonce por request en `src/middleware.ts` (crypto.randomUUID) y añadir `script-src 'nonce-<val>' 'strict-dynamic'` / `style-src 'nonce-<val>'` en header — **hecho 2026-08-23**.
2. ✅ Propagar nonce a `layout` vía `x-nonce` header y `next/script` `nonce` prop — **hecho** (`layout.tsx` lee `headers().get('x-nonce')`).
3. ⏳ Validar en staging sin violaciones report-only durante 1 semana (monitorear `/api/csp-report`), luego eliminar `'unsafe-inline'` de `style-src` en prod (script ya no depende de él gracias a `strict-dynamic`). Mantener `unsafe-inline` en `next.config` fallback solo para compatibilidad con navegadores sin soporte `nonce`/`strict-dynamic`.
Fecha objetivo: 2026-11-01 (revisar reportes `/api/csp-report`). Si no hay violaciones, remover `unsafe-inline` de `style-src` prod.

## Verificación
- `pnpm --filter @ruum/app-conductor build` en prod no contiene `unsafe-eval`.
- `pnpm --filter @ruum/app-conductor lint` pasa (theme script ya no es inline).
- Report-Only en staging sin bloqueos.
