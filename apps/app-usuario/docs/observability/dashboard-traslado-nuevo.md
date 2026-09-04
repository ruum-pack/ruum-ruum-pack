# Dashboard — Traslado Nuevo (Fase 3.3)

> Grafana/Datadog — Conversión, tiempo por paso, errores y alertas. Fuente: `src/lib/analytics.ts` (`ruum:ux` → `dataLayer` → Sentry breadcrumbs).

## 1. Métricas clave (Grafana Stat + Timeseries)

**Query Datadog (ejemplo):**
```sql
sum:ruum.traslado_paso_iniciado{paso:0}.as_count()         -> usuarios iniciados
sum:ruum.traslado_paso_completado{paso:0}.as_count()       -> completaron paso 0
sum:ruum.traslado_paso_completado{paso:1}.as_count()       -> paso 1
sum:ruum.traslado_paso_completado{paso:2}.as_count()       -> paso 2
sum:ruum.traslado_paso_completado{paso:3}.as_count()       -> paso 3
sum:ruum.traslado_nuevo_exitoso{*}.as_count()              -> crearon traslado
```

**Panel — Embudo:**
```
Usuarios iniciados:        1,234
Completaron paso 0:        1,100 (89%)
Completaron paso 1:          980 (79%)
Completaron paso 2:          850 (69%)
Completaron paso 3:          750 (61%)
Crearon traslado:            650 (53%)
Conversion rate:             53%
```

**Promedio tiempo por paso (p50, p95):**
```sql
avg:ruum.traslado_paso_completado.duracion_ms{paso:0} -> 2m 15s
avg:ruum.traslado_paso_completado.duracion_ms{paso:1} -> 3m 45s
avg:ruum.traslado_paso_completado.duracion_ms{paso:2} -> 4m 30s
avg:ruum.traslado_paso_completado.duracion_ms{paso:3} -> 1m 20s
avg:ruum.traslado_nuevo_exitoso.duracion_total_ms -> 13m 40s
```

| Paso | p50 | p95 | SLO |
|------|-----|-----|-----|
| 0 Conoce tarifa | 2m 15s | 4m 00s | <3m |
| 1 Vehículo | 3m 45s | 6m 00s | <5m |
| 2 Ruta | 4m 30s | 7m 00s | <6m |
| 3 Detalles | 1m 20s | 2m 30s | <2m |
| Total | 13m 40s | 20m 00s | <20m |

## 2. Errores más comunes

- `traslado_geocodificacion_error` (timeout 504, 2.3%)
- `traslado_rate_limit_hit` (429, 0.8%)
- `tarifa_validacion_fallida` (marca_cambio, 1.2%)
- `CP no encontrado` (1.8%)
- `traslado_validacion_fallida` (schema, <1%)

**Query:**
```sql
top(sum:ruum.traslado_geocodificacion_error{*}.as_count(), 5, 'error_code', 'desc')
```

## 3. Alertas recomendadas

| Alerta | Condición | Ventana | Severidad |
|--------|-----------|---------|-----------|
| Conversion <45% | `conversion < 0.45` tendencia 1h | 30m | warning |
| Tiempo total p95 >20m | `avg > 1200000` | 1h | warning |
| Tasa error paso >5% | `error_rate{paso:*} > 0.05` | 15m | critical |
| Rate limit Mapbox >10/min | `sum:traslado_rate_limit_hit > 10` | 5m | warning |
| Abandono paso 2 >40% | `abandono{paso:2} / iniciado{paso:2} > 0.4` | 1h | info |

Datadog Monitor JSON (ejemplo):
```json
{
  "name": "[app-usuario] Traslado conversión <45%",
  "type": "query alert",
  "query": "avg(last_30m):sum:ruum.traslado_nuevo_exitoso{*}.as_count() / sum:ruum.traslado_nuevo_visto{*}.as_count() < 0.45",
  "message": "@slack-ruum-alerts @pagerduty",
  "tags": ["app:usuario", "flujo:traslado_nuevo"]
}
```

## 4. Sentry — Métricas a monitorear

- `NuevoTraslado` `captureException` tags: `paso`, `etapa` (creacion, geocodificacion, supabase, stripe)
- `traslado_rate_limit_hit` y `geocoding_failure` como `warning` (no error) para no inflar tasa error.
- SLA response time: `previsualizarTarifaUsuario` p95 <800ms, `geocodificarDireccion` p95 <2s.

## 5. Implementación

- `src/lib/analytics.ts`: `registrarEventoUx` + helpers `iniciarFlujoTraslado`, `registrarPasoIniciado/Completado`, `registrarAbandono`.
- `src/app/traslados/nuevo/hooks/useNuevoTraslado.ts`: `Sentry.captureException` con `contexts.traslado`, `beforeunload` → `traslado_abandono`.
- `src/lib/mapbox.ts`: `adquirirPermisoMapbox` rate limiter + `traslado_rate_limit_hit` / `traslado_geocodificacion_error`.
