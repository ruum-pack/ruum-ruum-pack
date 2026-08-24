# OPS-003 — Sentry Alerts — App Conductor

> **Objetivo:** Detectar `error rate >1%`, `p95 LCP >2.5s`, `csp-report flood`, `health down`.

## Alertas a configurar en Sentry (proyecto `ruum-conductor`)

### 1) Error Rate — Crash / ErrorBoundary
- **Metric:** `events` where `level:error`
- **Condition:** `count > 50 in 5m` OR `error rate > 1% of sessions` (si hay session replay)
- **Filter:** `release:ruum-conductor@*` AND `environment:production|staging`
- **Action:** Slack `#alertas-conductor` + PagerDuty (si prod)
- **Owner:** Frontend

### 2) Performance — LCP
- **Metric:** `transactions` where `transaction.op: pageload` p95(LCP)
- **Threshold:** `p95 > 2500ms for 10m`
- **Filter:** `transaction:/panel`, `/viajes/[id]`, `/viajes/[id]/evidencia`
- **Action:** Slack + ticket Jira `PERF`

### 3) CSP Report Flood
- **Metric:** `events` where `logger:csp-report` OR `transaction:/api/csp-report`
- **Condition:** `count > 10/min for 5m`
- **Action:** Slack `#secops` — indica regresión CSP (ej. style-src sin nonce)
- **Runbook:** Revisar `CSP_DEUDA_P2.md`, `scripts/assert-csp.mjs`

### 4) Health Down
- **Uptime check:** `GET https://conductor.ruumruum-moviliax.online/api/health` cada 1m (Checkly / UptimeRobot / Sentry Crons)
- **Condition:** `status:503` OR `json.status == "down"` 2 veces consecutivas
- **Action:** PagerDuty + Slack `#oncall`
- **Runbook:** `docs/ops/RUNBOOK_HEALTH.md` (Supabase, middleware, Vercel)

### 5) Offline Sync Stuck
- **Metric:** `recordOperationalEvent` where `type: sync_failure | evidence_stuck`
- **Condition:** `count > 5 in 15m`
- **Filter:** `extra.scope: evidencia|offline`
- **Action:** Slack `#conductor-ops`

## Configuración código

- `sentry.client.config.ts` / `sentry.server.config.ts` ya filtran PII (`sendDefaultPii:false`, `beforeSend` con `FORBIDDEN=/curp|clabe|.../`)
- `src/lib/observability.ts:recordOperationalEvent` hace `rpc:registrar_evento_operativo_app` + mirror a `window.Sentry.captureMessage` si existe
- `src/app/api/health/route.ts` expone `status:ok|degraded|down` + latencia Supabase

## Verificación local

```bash
pnpm --filter @ruum/app-conductor build
curl -s http://localhost:3001/api/health | jq
# {"status":"ok","version":"1.0.0","checks":{"supabase":{"status":"ok"}}}

node scripts/assert-csp.mjs
pnpm scan:secrets
```

## Integración con Crons (Sentry Crons / Vercel Crons)

Agregar en `vercel.json` (opcional):
```json
{ "crons": [{ "path": "/api/health", "schedule": "*/5 * * * *" }] }
```

Si `health` retorna `503`, Vercel Logs + Sentry Issue se crean automáticamente.
