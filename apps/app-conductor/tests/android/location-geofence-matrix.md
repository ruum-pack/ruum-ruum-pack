# F5-09 - Matriz de ubicacion y geocerca

Validar con ubicacion simulada o dispositivo fisico. La salida segura significa que el conductor entiende el estado, puede reintentar o continuar con confirmacion consciente cuando GPS no es confiable.

## Criterios de aceptacion

- Mensaje claro para cada fallo.
- No se bloquea por error de GPS sin alternativa.
- Fuera de radio requiere doble confirmacion.
- La distancia confirmada queda disponible para auditoria.
- Torre de Control puede identificar la excepcion.

## Escenarios

| Escenario | Preparacion | Pasos | Resultado esperado | Auditoria esperada |
| --- | --- | --- | --- | --- |
| Dentro de 500 m | Mock GPS a menos de 500 m | Tocar He llegado | Avanza sin confirmacion extra | Evento normal de llegada |
| Fuera de 500 m | Mock GPS a mas de 500 m | Tocar He llegado | Muestra distancia aproximada y solicita confirmar de todos modos | No avanza hasta segunda accion |
| Confirmacion excepcional | Fuera de 500 m con banner visible | Tocar Confirmar de todos modos | Avanza y manda distancia | `fuera_geocerca=true`, `distancia_m` |
| GPS apagado | Desactivar ubicacion del dispositivo | Tocar He llegado | Mensaje comprensible y alternativa para confirmar/reintentar | Evento de fallo o ausencia de GPS si existe logger |
| Permiso denegado | Denegar permiso | Tocar He llegado | Explica recuperar permiso y no entra en bucle | Sin avance automatico silencioso |
| Permiso permanente denegado | Denegar permanentemente desde ajustes | Tocar He llegado | Indica abrir ajustes de Android | Incidencia manual si no hay deep link |
| Timeout | Simular proveedor sin respuesta | Tocar He llegado | Mensaje recuperable, permite reintento | Error clasificado como timeout |
| Precision deficiente | Mock accuracy alto, ej. 1500 m | Tocar He llegado | Advierte precision baja y permite decision consciente | Registrar precision si se envia |
| Ubicacion antigua | Mock con timestamp viejo si herramienta lo permite | Tocar He llegado | Advierte ubicacion sin actualizar o fuerza reintento | Registrar antiguedad si se envia |
| Reintento | Provocar fallo y restaurar GPS | Tocar reintento o repetir accion | Flujo se recupera sin reiniciar viaje | Evento final correcto |

## Observaciones tecnicas actuales

- `DirigeteADestino` ya envia `fueraGeocerca` y `distanciaM` a la RPC de llegada destino cuando hay confirmacion excepcional.
- `DirigeteAOrigen` muestra confirmacion fuera de radio, pero aun usa transicion generica y no envia distancia a una RPC atomica especifica de origen.
- `obtenerUbicacionActual()` devuelve `null` para varios errores; para diagnostico mas fino conviene consumir `obtenerUbicacionActualConEstado()` en geocerca y mapear `denegado`, `no_disponible`, `timeout` y `precision_deficiente`.

## Incidencias

```text
ID:
Severidad:
Ruta:
Escenario:
Distancia simulada:
Precision:
Paso:
Resultado esperado:
Resultado observado:
Evento/auditoria:
Bloquea operacion: si/no
```
