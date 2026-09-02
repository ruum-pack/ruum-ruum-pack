# OPS-004 — Sentry Alerts — App Usuario

> **Objetivo:** Detectar `error rate >1%`, `p95 LCP >2.5s`, `fallos de cotización/geocodificación`, `fallos de pago Stripe`, `health down`.

## Alertas a configurar en Sentry (proyecto `ruum-usuario`)

### 1) Error Rate — Crash / ErrorBoundary
- **Metric:** `events` where `level:error`
- **Condition:** `count > 50 in 5m` OR `error rate > 1% of sessions`
- **Filter:** `release:ruum-usuario@*` AND `environment:production|staging`
- **Action:** Slack `#alertas-usuario` + PagerDuty (si prod)
- **Owner:** Frontend

### 2) Fallos de Pago Stripe (P1)
- **Metric:** `recordOperationalEvent` where `type: stripe_payment_failure`
- **Condition:** `count > 3 in 10m`
- **Action:** Slack `#pagos-ops` + Canal de soporte
- **Runbook:** Verificar status de API Stripe, webhooks y payment intents.

### 3) Fallos de Cotización / Geocodificación Mapbox
- **Metric:** `recordOperationalEvent` where `type: quote_calculation_failure | geocoding_failure`
- **Condition:** `count > 5 in 15m`
- **Action:** Slack `#alertas-usuario`
- **Runbook:** Verificar estado de tokens de Mapbox y límites de cuota/rate limit.

### 4) CSP Report Flood (Report-Only Staging)
- **Metric:** `events` where `logger:csp-report-usuario` OR `transaction:/api/csp-report`
- **Condition:** `count > 10/min for 5m`
- **Action:** Slack `#secops` — indica regresión en CSP (ej. orígenes de Stripe/Mapbox sin permitir).

### 5) Auth Callback & Recovery Stuck
- **Metric:** `recordOperationalEvent` where `type: auth_callback_error | recovery_failure`
- **Condition:** `count > 10 in 15m`
- **Action:** Slack `#alertas-usuario`

---

## Privacidad y Sanitización de Datos (P1)

- `sentry.client.config.ts`, `sentry.server.config.ts` e `instrumentation.ts` configuran `sendDefaultPii: false`.
- Toda la telemetría es filtrada por `sanitizeDetails`:
  - **Prohibido**: `password`, `token`, `jwt`, `service_role`, `cvv`, `tarjeta`, `cuenta`, `curp`, `clabe`, `documento`, `foto`, `url_firmada`.
  - Los strings largos son truncados a 240 caracteres.
  - Los JWTs y tokens Bearer son automáticamente redactados (`[REDACTED_SECRET]`).
