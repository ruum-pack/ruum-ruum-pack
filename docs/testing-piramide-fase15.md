# FASE 15 — Pirámide de testing integral

```
            E2E (golden path operación)
          /     \
    Integration (RT-62: ciclo punta a punta)
    /           \
 Unit (vitest)   SQL/RLS (pgTAP por dominio)
```

Correr todo: `pnpm test:piramide` (= `test:unit` + `test:sql` + `test:e2e:golden`).
Requiere supabase local (`pnpm db:start`).

## Tests prioritarios por dominio

| Dominio | Test | Nivel | Qué protege |
| --- | --- | --- | --- |
| Organization | rt45, rt51, rt61.1–4/17–18 | SQL/RLS | Aislamiento entre empresas y outsiders |
| RBAC | rt42, rt43, rt61.8 | SQL/RLS | Permisos y conductor fuera de pagos |
| Operation | rt50, rt54, rt62 | SQL/RLS | CRUD y operación con 5 traslados |
| Transfer | rt52, a1, rt62 | SQL + integración | State machine punta a punta |
| Assignment | rt43, rt48, rt53 | SQL/RLS | Concurrencia, doble asignación, idempotencia |
| Tracking | rt56, rt61.13–16 | SQL/RLS | Offline/recovery sin duplicados |
| Custody | rt55 | SQL/RLS | Integridad, hash, append-only |
| Evidence | rt61.11–12, rt62 | SQL + integración | Inspección no duplicable, gates de 5 ángulos |
| Payment | rt49, rt61.5–7 | SQL/RLS | Doble cobro bloqueado (PaymentIntent/evento únicos) |
| Payout | rt40, rt61.9–10 | SQL/RLS | Doble pago bloqueado (transfer único) |
| Massive | rt38, rt54, u1 | SQL/RLS | Duplicados y cargas idempotentes |
| SLA | rt46, rt59 | SQL/RLS | Warning antes de breach |
| Incidents | rt57 | SQL/RLS | Escalamiento sin mover el traslado |
| Observabilidad | rt60 | SQL/RLS | Logs, latencias, tracking, purga, métricas |

## Golden path E2E (`tests/e2e/golden-path-operacion.mjs`)

Empresa crea operación → 5 vehículos → 5 traslados → aceptación →
pago anticipado → confirmación Torre → asignación (oferta+aceptación y
directa) → recolección → evidencia → tracking → en curso (flota) →
entrega → cierre → finanzas/métricas → operación cerrada. Más casos
negativos: doble cobro, transición inválida y aislamiento de outsider.

Se ejecuta contra el stack local con JWT reales por rol
(`pnpm test:e2e:golden`). Las altas que el esquema reserva a
service_role van marcadas `FIXTURE`; el flujo de negocio siempre usa
el rol correspondiente. Datos únicos por corrida; limpieza en `after`.
