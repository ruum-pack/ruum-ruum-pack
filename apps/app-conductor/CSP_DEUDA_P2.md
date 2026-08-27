# P2 CSP ÔÇö Deuda documentada y plan de retiro

## Estado actual (producci├│n) ÔÇö actualizaci├│n 2026-08-23
CSP prod sin `unsafe-eval` (eliminado). `script-src` ya usa `nonce` por request v├¡a `middleware` + `strict-dynamic`, por lo que `unsafe-inline` para scripts queda solo como fallback para navegadores sin soporte nonce (deuda residual m├¡nima). `style-src` mantiene `unsafe-inline` como deuda temporal:

- `style-src 'self' 'unsafe-inline' 'nonce-...'` ÔÇö requerido por Tailwind CSS y Next.js styled-jsx que inyectan estilos en runtime. Sin `unsafe-inline` los estilos no se aplican en SSR. Migraci├│n completa a `nonce` requiere pasar nonce a cada `<style>` generado por Next ÔÇö parcialmente hecho v├¡a `middleware` que a├▒ade `nonce` a `style-src`, pero Next a├║n inyecta estilos sin nonce. `unsafe-inline` se mantiene como fallback hasta validaci├│n report-only.
- `script-src 'self' 'nonce-...' 'strict-dynamic' https://*.sentry.io` ÔÇö en prod ya no contiene `unsafe-eval` ni depende de `unsafe-inline` para scripts propios; Next hidrataci├│n usa `strict-dynamic` + `nonce`. Se eliminaron inline propios (`/theme-init.js` externo con `beforeInteractive` + `nonce`, `/auth-callback-fallback.js` externo), y se movieron 3 `<style dangerouslySetInnerHTML>` a `globals.css`. `unsafe-inline` para scripts solo queda como fallback para navegadores antiguos (ignorado cuando `nonce`/`strict-dynamic` est├í presente).

## Inventario inline eliminado en P2
- `src/app/layout.tsx` ÔÇö theme script inline ÔåÆ `/public/theme-init.js` (externo, `Script beforeInteractive`)
- `src/app/auth/callback/route.ts` ÔÇö HTML fallback con script interpolado `${origin}`/`${type}` ÔåÆ `/public/auth-callback-fallback.js` est├ítico (sin interpolaci├│n, usa `window.location.origin`)
- `src/app/viajes/[id]/TripDetailsClient.tsx`, `CierreTrasladoDetails.tsx`, `viajes/[id]/evidencia/page.tsx` ÔÇö `<style dangerouslySetInnerHTML>` con `@keyframes fadeIn` ÔåÆ `src/app/globals.css`
- `cap-shell/index.html` ÔÇö queda fuera de Next (Capacitor offline shell), no sujeto a header CSP de Next; tiene su propio contexto `capacitor://`.

## CSP por ambiente (actualizado con middleware nonce)
- **Dev** (`NODE_ENV !== production`): `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io` + `connect-src ... ws: wss: http://localhost:*` para HMR. `style-src` incluye `nonce` pero mantiene `unsafe-inline` para DX.
- **Prod** (v├¡a `middleware`): `script-src 'self' 'nonce-{random}' 'strict-dynamic' https://*.sentry.io` (sin `unsafe-eval` y sin depender de `unsafe-inline`), `style-src 'self' 'unsafe-inline' 'nonce-{random}'`, resto igual a dev sin `ws/wss`. `next.config` mantiene fallback con `unsafe-inline` para requests no cubiertos por middleware (est├íticos).
- **Staging** (`NEXT_PUBLIC_RUUM_AMBIENTE=staging`): adem├ís `Content-Security-Policy-Report-Only` con `report-uri /api/csp-report` para validar sin romper (middleware).

Directivas adicionales endurecidas: `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `worker-src 'self' blob:'`.

`connect-src`/`img-src` confirmados: `https://*.supabase.co` (Supabase), `https://*.mapbox.com` (Mapbox), `https://*.sentry.io` (Sentry). No se a├▒adieron dominios extra; Capacitor `capacitor://*` se evaluar├í si se detectan violaciones en report-only.

## Plan de retiro de deuda (actualizado ÔÇö SEC-003 preparado)
1. Ô£à Generar nonce por request en `src/middleware.ts` (crypto.randomUUID) y a├▒adir `script-src 'nonce-<val>' 'strict-dynamic'` / `style-src 'nonce-<val>'` en header ÔÇö **hecho 2026-08-23**.
2. Ô£à Propagar nonce a `layout` v├¡a `x-nonce` header y `next/script` `nonce` prop ÔÇö **hecho** (`layout.tsx` lee `headers().get('x-nonce')`).
3. Ô£à Preparar flag `CSP_STRICT_STYLES=true` para eliminar `unsafe-inline` de `style-src` ÔÇö **hecho 2026-08-23 (P2+)**:
   - `src/middleware.ts` y `next.config.ts` leen `CSP_STRICT_STYLES` / `NEXT_PUBLIC_CSP_STRICT_STYLES` y generan `style-src 'self' 'nonce-...'` sin `unsafe-inline`.
   - `scripts/assert-csp.mjs` valida el flag.
   - Uso: `CSP_STRICT_STYLES=true pnpm --filter @ruum/app-conductor build` + staging 1 semana report-only.
4. ÔÅ│ Validar en staging sin violaciones report-only durante 1 semana (monitorear `/api/csp-report`), luego activar flag en prod. Mantener `unsafe-inline` en fallback solo para navegadores sin soporte `nonce` si se detectan violaciones.
Fecha objetivo: 2026-11-01 (revisar reportes `/api/csp-report`). Activaci├│n: `CSP_STRICT_STYLES=true` en Vercel env prod.

## Verificaci├│n
- `pnpm --filter @ruum/app-conductor build` en prod no contiene `unsafe-eval`.
- `pnpm --filter @ruum/app-conductor lint` pasa (theme script ya no es inline).
- Report-Only en staging sin bloqueos.
