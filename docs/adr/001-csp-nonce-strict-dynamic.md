# ADR 001 — Estrategia CSP con Nonce y strict-dynamic para Apps Next.js (Conductor y Usuario)

- **Fecha:** 2026-08-23 (Actualizado: 2026-09-02)
- **Estado:** Aceptado / Implementado
- **Contexto:**
  Anteriormente, las aplicaciones web dependían de `script-src 'self' 'unsafe-inline' 'unsafe-eval'` en producción para facilitar la ejecución de scripts y herramientas de bundling. Esto exponía a las aplicaciones a riesgos de Cross-Site Scripting (XSS) y representaba un hallazgo bloqueante en las auditorías de seguridad (SEC-002 / SEC-003).

- **Decisión:**
  1. Generar un `nonce` criptográficamente seguro por petición en `src/middleware.ts` (`crypto.randomUUID()` en Base64) y transmitirlo vía encabezado `x-nonce`.
  2. Configurar la directiva `Content-Security-Policy` con `script-src 'self' 'nonce-{random}' 'strict-dynamic' ...` en producción, delegando la confianza de scripts dependientes a `strict-dynamic` y eliminando totalmente `'unsafe-eval'` y `'unsafe-inline'` para scripts propios.
  3. Extraer scripts inline a recursos estáticos externos (`/theme-init.js`, `/auth-callback-fallback.js`) consumidos con el componente `Script` de Next.js (`strategy="beforeInteractive"`, `nonce={nonce}`).
  4. Habilitar modo `Report-Only` en entornos de staging (`NEXT_PUBLIC_RUUM_AMBIENTE=staging` / `CSP_REPORT_ONLY=true`) hacia el endpoint `/api/csp-report` para validar políticas sin disrupción del servicio.
  5. Soportar el flag de endurecimiento de estilos `CSP_STRICT_STYLES=true` para transicionar progresivamente `style-src` hacia `'self' 'nonce-{random}'`.

- **Consecuencias:**
  - `+` Protección robusta contra ataques XSS conforme a las directrices de OWASP.
  - `+` Cumplimiento de gates obligatorios en CI (`assert-csp.mjs` y tests automatizados).
  - `+` Preservación explícita de integraciones requeridas (Stripe Elements, Didit, Mapbox, Supabase, Sentry, Capacitor).
  - `-` Requiere propagar el `nonce` a cualquier script de terceros que no sea inyectado por scripts raíz autorizados por `strict-dynamic`.

- **Referencias:**
  - `apps/app-conductor/src/middleware.ts`
  - `apps/app-usuario/src/middleware.ts`
  - `docs/CSP_DEUDA.md`
