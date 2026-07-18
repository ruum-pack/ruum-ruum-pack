# F5-07 - Validacion TalkBack

Esta validacion se ejecuta en Android fisico o emulador con TalkBack activo.
Registrar dispositivo, version de Android, build de App Conductor, fecha y responsable.

## Criterios globales

- Todas las tareas criticas pueden completarse con exploracion tactil y gestos de TalkBack.
- Ningun control critico se anuncia como "boton sin etiqueta" o equivalente.
- El flujo no depende solo del color para comunicar estado, bloqueo o error.
- Las incidencias menores quedan registradas con severidad, ruta, paso, resultado esperado y resultado observado.

## Severidad

- P0: impide completar una tarea critica o activa una accion peligrosa sin nombre/confirmacion.
- P1: permite completar la tarea, pero con riesgo operativo alto o orden de foco confuso.
- P2: friccion menor, texto poco claro o redundancia anunciada que no bloquea.

## Flujos

### Iniciar sesion

- Verificar orden de foco: correo, contrasena, recuperar contrasena, entrar.
- Verificar nombres accesibles de inputs y boton principal.
- Verificar mensajes de error con credenciales invalidas.

### Consultar viaje activo

- Verificar que folio, etapa, destino actual y accion pendiente se anuncien en orden.
- Verificar que el acceso rapido al viaje tenga nombre accionable.
- Verificar que estados no se anuncien duplicados de forma confusa.

### Abrir navegacion

- Verificar que "Abrir navegacion" anuncie destino y sea distinguible de "Confirmar llegada".
- Verificar que si hay geocerca, el aviso se anuncie antes de confirmar.

### Contactar

- Verificar que llamada, WhatsApp o mensaje operativo anuncien canal y contacto.
- Verificar que no haya controles duplicados con el mismo nombre y diferente accion.

### Abrir emergencia

- Verificar foco inicial en el titulo del modal.
- Verificar nombre accesible de cada accion: 911, soporte, compartir ubicacion, accidente, no puedo continuar.
- Verificar confirmacion previa antes de llamar al 911.
- Verificar cierre con foco devuelto al boton que abrio el panel.

### Capturar evidencia

- Verificar progreso: paso actual, total, angulo e instruccion.
- Verificar que "Tomar foto", "Elegir de galeria", "Repetir" y "No aplica" tengan nombre correcto.
- Verificar estado offline, sincronizando, error y sincronizada.
- Verificar que el progreso de fotos y datos de inspeccion no se anuncie como completo si faltan campos obligatorios.

### Reportar problema

- Verificar que opciones simplificadas tengan nombres comprensibles.
- Verificar prioridad o urgencia sin depender solo del color.
- Verificar mensajes de error y exito.

### Consultar ganancias

- Verificar que cada monto anuncie cantidad y estado: estimado, confirmado, retenido, programado o sin calcular.
- Verificar que deposito final tenga prioridad semantica y visual.
- Verificar que el estado vacio anuncie la accion "Ver viajes disponibles".

### Revisar documentos

- Verificar estado de cada documento: falta, cargado, en revision, aprobado, rechazado, por vencer, vencido.
- Verificar motivo de rechazo y siguiente accion.
- Verificar que reemplazar documento este bloqueado cuando esta en revision.

## Registro de incidencias

Usar este formato por cada hallazgo:

```text
ID:
Severidad:
Ruta:
Flujo:
Paso:
Resultado esperado:
Resultado observado:
Captura o video:
Bloquea operacion: si/no
```
