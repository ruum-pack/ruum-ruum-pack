# PR-14 — Inventario definitivo máquina de estados (34) — Fuente de verdad: código

**Regla:** `packages/shared/src/types/traslado.ts` (`EstadoTraslado`) es la fuente de verdad. Todos los mapas derivan de él; informes y documentación se regeneran desde código. Si se añade un estado sin actualizar los mapas relacionados, los tests de exhaustividad fallan.

## Inventario reconciliado

| Fuente | Cantidad reportada | Estado |
|--------|-------------------|--------|
| `traslado.ts:1` comentario histórico | 28 | **desactualizado** → actualizado a 34 |
| `estados-traslado.ts:4` comentario | 32 | **desactualizado** → actualizado a 34 |
| `estado-visual.ts:3` comentario | 32 | **desactualizado** → actualizado a 34 |
| `etapas.ts:3` comentario | 32 | **desactualizado** → actualizado a 34 |
| `supabase/migrations/20260708000005_traslados.sql:1` comentario | 32 | histórico, enum ahora tiene 34 tras `20260711000119/120` (`cotizacion_aceptada`) |
| `Informe_Arquitectura_Tecnica_Ruum_Usuario_Conductor.docx` §9 | 32 | desactualizado — regenerar desde código (34) |
| `packages/shared/src/types/traslado.ts` | **34** | **fuente de verdad** |
| `packages/shared/src/states/estados-traslado.ts` | 34 | fuente de verdad |
| `packages/shared/src/types/supabase.ts` enum `estado_traslado` | 34 | sincronizado (incluye `cotizacion_aceptada`) |
| `supabase/migrations/estado_transiciones_validas` | 34 estados × transiciones | sincronizado (incluye `cotizacion_generada->cotizacion_aceptada`) |
| `packages/ui/src/lib/estado-visual.ts` | 34 | `CATEGORIA_POR_ESTADO` exhaustivo |
| `packages/ui/src/lib/etapas.ts` | 34 (26 etapas + 8 ramificados) | exhaustivo |
| `apps/app-conductor/src/lib/trip-presentation.ts` | 34 | `getTripPresentation` cubre todos (switch + default) |

## Lista definitiva (34)

```
usuario_pendiente_verificacion, usuario_verificado, solicitud_creada,
documentacion_pendiente, documentacion_en_revision, documentacion_validada,
cotizacion_generada, cotizacion_aceptada, servicio_confirmado,
pendiente_de_conductor, conductor_asignado, conductor_en_camino_al_origen,
conductor_en_punto_de_recoleccion, verificacion_vehiculo_en_proceso,
evidencia_inicial_en_proceso, evidencia_inicial_completada, vehiculo_recibido,
traslado_en_curso, incidencia_reportada, llegada_a_destino,
evidencia_final_en_proceso, evidencia_final_completada, entrega_confirmada,
pago_pendiente, pago_completado, servicio_cerrado,
servicio_cancelado, traslado_fallido,
dano_no_reportado_en_revision, reclamo_abierto, reclamo_resuelto,
cierre_operativo_con_incidencia_abierta, disputa_abierta, disputa_resuelta
```

## Exhaustividad (tests)

`packages/shared/src/states/estados-traslado.test.ts` — 8 tests:
- `ESTADOS_TRASLADO` tiene 34 y coincide con `EstadoTraslado` union
- toda entrada tiene `ETIQUETA_ESTADO_TRASLADO` (no extra, no falta)
- toda entrada tiene `TRANSICIONES[estado]` válida o es terminal (`disputa_resuelta`, `servicio_cancelado`, `traslado_fallido` = 0)
- toda entrada tiene `CATEGORIA_POR_ESTADO` (inicial/activo/atencion/completado/fallido)
- toda entrada está en `ETAPAS_TRASLADO` o `ESTADOS_RAMIFICADOS` exactamente una vez (26+8=34, sin duplicados)
- transiciones sin duplicados ni auto-transición, destinos válidos
- supabase enum 34

`apps/app-conductor/test/pr14-trip-presentation.test.ts` — 2 tests:
- `getTripPresentation` para cada uno de los 34 estados tiene `title`/`instruction` y `primaryAction`; activos del conductor no caen en fallback genérico.

Si se añade `nuevo_estado` a `EstadoTraslado` sin añadirlo a `ESTADOS_TRASLADO`, `ETIQUETA_ESTADO_TRASLADO`, `TRANSICIONES`, `CATEGORIA_POR_ESTADO`, `ETAPAS/ESTADOS_RAMIFICADOS` o `getTripPresentation`, los tests fallan.

## Migración de reconciliación

`supabase/migrations/20260902000003_pr14_inventario_estados_34.sql` — verifica `pg_enum` count=34, inserta idempotente `cotizacion_generada->cotizacion_aceptada` etc., comenta `estado_traslado` como fuente de verdad.

## Acción para informes

Regenerar `Informe_Arquitectura_Tecnica_Ruum_Usuario_Conductor.docx` §9 desde `ESTADOS_TRASLADO.length` (34), no hardcodear 32.
