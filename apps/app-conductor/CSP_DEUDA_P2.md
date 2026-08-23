# P2 CSP — Deuda documentada y plan de retiro

## Estado actual (producción)
CSP prod sin `unsafe-eval` (eliminado). `script-src` y `style-src` mantienen `unsafe-inline` como deuda temporal:

- `style-src 'self' 'unsafe-inline'` — requerido por Tailwind CSS y Next.js styled-jsx que inyectan estilos en runtime. Sin `unsafe-inline` los estilos no se aplican en SSR. Migración a nonce requiere `style-src 'nonce-...'` y pasar nonce a cada `<style>` generado por Next — no soportado sin middleware que genere nonce por request.
- `script-src 'self' 'unsafe-inline' https://*.sentry.io` — requerido por Next.js hidratación (`__NEXT_DATA__`, chunks inline). Migración a `nonce`/`hash` requiere generar nonce por request en middleware y propagarlo a `next/script` y a `layout` theme script. Ya se eliminó un inline (`/theme-init.js` externo con `beforeInteractive` y `/auth-callback-fallback.js` externo), y se movieron 3 `<style dangerouslySetInnerHTML>` a `globals.css`.

## Inventario inline eliminado en P2
- `src/app/layout.tsx` — theme script inline → `/public/theme-init.js` (externo, `Script beforeInteractive`)
- `src/app/auth/callback/route.ts` — HTML fallback con script interpolado `${origin}`/`${type}` → `/public/auth-callback-fallback.js` estático (sin interpolación, usa `window.location.origin`)
- `src/app/viajes/[id]/TripDetailsClient.tsx`, `CierreTrasladoDetails.tsx`, `viajes/[id]/evidencia/page.tsx` — `<style dangerouslySetInnerHTML>` con `@keyframes fadeIn` → `src/app/globals.css`
- `cap-shell/index.html` — queda fuera de Next (Capacitor offline shell), no sujeto a header CSP de Next; tiene su propio contexto `capacitor://`.

## CSP por ambiente
- **Dev** (`NODE_ENV !== production`): `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io` + `connect-src ... ws: wss: http://localhost:*` para HMR.
- **Prod**: `script-src 'self' 'unsafe-inline' https://*.sentry.io` (sin `unsafe-eval`), resto igual a dev sin `ws/wss`.
- **Staging** (`NEXT_PUBLIC_RUUM_AMBIENTE=staging`): además `Content-Security-Policy-Report-Only` con `report-uri /api/csp-report` para validar sin romper.

Directivas adicionales endurecidas: `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `worker-src 'self' blob:'`.

`connect-src`/`img-src` confirmados: `https://*.supabase.co` (Supabase), `https://*.mapbox.com` (Mapbox), `https://*.sentry.io` (Sentry). No se añadieron dominios extra; Capacitor `capacitor://*` se evaluará si se detectan violaciones en report-only.

## Plan de retiro de deuda
1. Generar nonce por request en `src/middleware.ts` (crypto.randomUUID) y añadir `script-src 'nonce-<val>'` / `style-src 'nonce-<val>'` en header.
2. Propagar nonce a `layout` vía `x-nonce` header y `next/script` `nonce` prop, y a todos los inline `<style>` restantes.
3. Una vez validado en staging sin violaciones report-only durante 1 semana, eliminar `'unsafe-inline'` de `script-src` y `style-src` en prod.
Fecha objetivo: 2026-11-01 (revisar reportes `/api/csp-report`).

## Verificación
- `pnpm --filter @ruum/app-conductor build` en prod no contiene `unsafe-eval`.
- `pnpm --filter @ruum/app-conductor lint` pasa (theme script ya no es inline).
- Report-Only en staging sin bloqueos.
