# CSP — Estado Consolidado y Retiro de Deuda Técnica

## Estado Actual (Producción — 2026-09-02)

La estrategia de Content Security Policy (CSP) ha sido migrada y estandarizada al 100% en todas las aplicaciones del monorepo (`app-conductor` y `app-usuario`):

1. **`script-src` sin `unsafe-eval` ni dependencia de `unsafe-inline`**:
   - `middleware.ts` genera criptográficamente un `nonce` por petición (`crypto.randomUUID()` en Base64).
   - En producción se inyecta `script-src 'self' 'nonce-{random}' 'strict-dynamic' ...`.
   - Todos los scripts inline de tema y fallback fueron extraídos a archivos estáticos externos (`/theme-init.js`, `/auth-callback-fallback.js`) y consumidos con el componente `<Script ... nonce={nonce} />`.

2. **`style-src` y Endurecimiento Estricto (`CSP_STRICT_STYLES=true`)**:
   - `style-src` soporta el flag `CSP_STRICT_STYLES=true` / `NEXT_PUBLIC_CSP_STRICT_STYLES=true` en ambas aplicaciones para activar de forma controlada `style-src 'self' 'nonce-{random}'` sin `unsafe-inline`.
   - En fallback de desarrollo o transición controlada, se mantiene `style-src 'self' 'unsafe-inline' 'nonce-{random}'`.

3. **Modo Report-Only en Staging**:
   - En entornos staging (`NEXT_PUBLIC_RUUM_AMBIENTE=staging` o `CSP_REPORT_ONLY=true`), ambas aplicaciones emiten el encabezado `Content-Security-Policy-Report-Only` apuntando a sus respectivos endpoints `/api/csp-report`.

4. **HSTS (`Strict-Transport-Security`)**:
   - Ambas aplicaciones emiten en producción:
     `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

5. **Excepciones de Terceros Preservadas**:
   - **Stripe**: `js.stripe.com`, `api.stripe.com`, `*.stripe.com`, `*.stripe.network`, `hooks.stripe.com`.
   - **Didit**: `verify.didit.me`, `*.didit.me`, `apx.didit.me`.
   - **Mapbox**: `*.mapbox.com`, `api.mapbox.com`, `events.mapbox.com`, `worker-src 'self' blob:`.
   - **Supabase**: `*.supabase.co`, `*.supabase.in`, `ws:`, `wss:`.
   - **Capacitor**: `capacitor://localhost`, `http://localhost:*`, `http://127.0.0.1:*`.

## Estado del Plan de Retiro
- ✅ **Paso 1**: Generar nonce dinámico por request en `middleware.ts` (Conductor y Usuario).
- ✅ **Paso 2**: Propagar `nonce` a `layout.tsx` y eliminar scripts inline propios.
- ✅ **Paso 3**: Preparar y validar flag `CSP_STRICT_STYLES=true` en ambos `middleware.ts` y `next.config.ts`.
- ✅ **Paso 4**: Habilitar endpoints `/api/csp-report` en ambas aplicaciones y soporte de Report-Only para staging.
- ✅ **Paso 5**: CI con suites de seguridad y tests unitarios de CSP bloqueando regresiones.
