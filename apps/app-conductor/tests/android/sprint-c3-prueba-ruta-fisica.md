# Sprint C3 — Protocolo de prueba de ruta física

## Precondiciones

- Build Android firmado contra staging.
- Conductor de prueba asignado a un traslado autorizado.
- Torre de Control abierta en otro dispositivo.
- Batería inicial, versión Android, fabricante y modelo registrados.
- Relojes de ambos dispositivos sincronizados.

## Ejecución mínima de 60 minutos

| Tramo | Duración | Condición | Evidencia esperada |
|---|---:|---|---|
| A | 10 min | Ruta urbana, pantalla encendida | Punto cada 10–20 s durante traslado |
| B | 10 min | Pantalla bloqueada | Notificación persistente y puntos continuos |
| C | 5 min | Estacionamiento/túnel | Cola local aumenta; no se pierden puntos válidos |
| D | 10 min | Cambio Wi‑Fi → datos → sin red → datos | Reintento por lote sin duplicados |
| E | 10 min | App en segundo plano usando otra app | Servicio continúa activo |
| F | 10 min | Vehículo detenido | Frecuencia baja a 30–60 s |
| G | 5 min | Incidencia simulada | Frecuencia temporal de 5–10 s |

## Reinicio y batería

1. Con viaje activo, reiniciar el dispositivo.
2. Confirmar recuperación sólo cuando Android lo permita y el viaje persistido siga activo.
3. Activar ahorro de batería y registrar si el fabricante detiene el servicio.
4. Repetir con batería menor a 15%.

## Métricas de aceptación

- Duración total con pantalla bloqueada: **≥ 60 min**.
- Pérdida de puntos tras recuperar conectividad: **< 1%** de puntos aceptados por política de muestreo.
- Duplicados por reintento: **0** por `traslado_id + local_id`.
- Lag p95 online: **≤ 45 s**.
- Lag p95 después de reconexión: **≤ 3 min**.
- Precisión urbana mediana: registrar; objetivo operativo **≤ 35 m**.
- Consumo de batería: registrar porcentaje/hora por modelo; investigar si supera **8%/h**.
- Ningún punto aceptado para un traslado ajeno.

## Registro de resultados

Capturar: dispositivo, Android, fabricante, hora inicial/final, batería inicial/final, puntos generados, insertados, duplicados, rechazados, lag p50/p95, precisión p50/p95, interrupciones y causa reportada por `lastError`.
