# ADR 001 — CSP Nonce + strict-dynamic para App Conductor

- **Fecha:** 2026-08-23
- **Estado:** Aceptado
- **Contexto:** `next.config.ts` usaba `script-src 'self' 'unsafe-inline' 'unsafe-eval'` en prod (P0). Esto permitía XSS via inyección inline y era bloqueante para auditoría SEC-002/003.
- **Decisión:** Generar `nonce` por request en `src/middleware.ts` (`crypto.randomUUID()` → base64) y usar `script-src 'self' 'nonce-{random}' 'strict-dynamic' https://*.sentry.io` en prod. `next.config.ts` es fallback para estáticos; middleware es autoritativo. `style-src` mantiene `unsafe-inline` + `nonce` hasta 2026-11-01 con flag `CSP_STRICT_STYLES`.
- **Consecuencias:**
  - `+` Elimina `unsafe-eval` en prod, alinea con OWASP CSP, `assert-csp.mjs` bloquea regresiones en CI.
  - `+` Sentry y Mapbox siguen permitidos vía `connect-src`/`img-src`.
  - `-` Navegadores sin `strict-dynamic` usan fallback `next.config` (compatibilidad).
  - `→` Plan retiro `style-src unsafe-inline` vía `CSP_STRICT_STYLES=true` tras 1 semana report-only en staging (`/api/csp-report`).
- **Alternativas descartadas:** Hasheo de inline (frágil con Next hydration), `unsafe-inline` permanente (riesgo XSS).
- **Referencias:** `src/middleware.ts:26-46`, `next.config.ts:22-33`, `CSP_DEUDA_P2.md`, `scripts/assert-csp.mjs`.
