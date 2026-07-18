# F5-08 - Matriz de camara

Validar en Android fisico o emulador con build de App Conductor. Registrar dispositivo, Android, version de app, fecha y responsable.

## Criterios de aceptacion

- La app explica como recuperar permisos cuando camara o galeria quedan bloqueadas.
- No entra en bucle de solicitud de permisos.
- La foto no se pierde al volver desde segundo plano o ajustes.
- La evidencia puede guardarse offline.
- El conductor puede repetir la captura.

## Escenarios

| Escenario | Preparacion | Pasos | Resultado esperado | Evidencia |
| --- | --- | --- | --- | --- |
| Permiso concedido | Camara permitida | Abrir evidencia, tocar Tomar foto, aceptar captura | Se muestra previsualizacion, se guarda en cola local y puede repetirse | Captura de preview y estado de cola |
| Permiso denegado | Revocar permiso antes de abrir | Tocar Tomar foto y negar permiso | Mensaje claro, no hay bucle, puede usar galeria o intentar de nuevo | Video corto |
| Denegado permanentemente | Denegar con "No volver a preguntar" o revocar desde ajustes | Tocar Tomar foto | Mensaje indica ir a Ajustes de Android para permitir camara | Captura del mensaje |
| Camara no disponible | Emulador sin camara o camara ocupada | Tocar Tomar foto | Mensaje claro y salida a galeria; no se pierde el paso activo | Log y captura |
| App enviada a segundo plano | Iniciar captura y mandar app a background | Volver a la app | Si habia foto capturada, sigue visible; si no, conserva paso activo | Video |
| Retorno desde ajustes | Permiso denegado permanentemente | Abrir ajustes, conceder permiso, volver | La captura funciona sin reiniciar el viaje | Video |
| Seleccion de galeria | Fotos permitidas | Tocar Elegir de galeria | Imagen se guarda como evidencia local y puede sincronizar offline | Captura de preview |
| Foto pesada | Seleccionar imagen grande | Guardar imagen | App no se cierra, muestra feedback; si falla, mensaje recuperable | Tamano de archivo y resultado |
| Orientacion vertical | Dispositivo vertical | Capturar foto | Preview legible, CTA visible, no overflow horizontal | Captura |
| Orientacion horizontal | Dispositivo horizontal | Capturar foto | Preview legible, CTA visible, no se ocultan controles | Captura |

## Incidencias

Registrar cualquier desviacion con:

```text
ID:
Severidad:
Dispositivo:
Android:
Escenario:
Paso:
Resultado esperado:
Resultado observado:
Bloquea operacion: si/no
Evidencia:
```
