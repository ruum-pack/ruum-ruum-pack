# Prueba física Sprint C4

Registrar evidencia para cada caso: hora de encolado, envío, recepción, apertura, destino y dispositivo.

| Estado | Procedimiento | Resultado esperado |
|---|---|---|
| Abierta | Mantener `/panel` visible y enviar traslado asignado | Banner del sistema/handler recibido, centro actualizado y toque abre `/viajes/{id}` |
| Segundo plano | Minimizar la app | Push visible; toque abre destino exacto |
| Cerrada | Forzar cierre y enviar aviso | Android muestra push; toque restaura sesión y abre destino |
| Después de reinicio | Reiniciar teléfono sin abrir app | FCM entrega y abre la ruta al tocar |
| Sin sesión | Cerrar sesión desde la app y enviar evento | El dispositivo cerrado queda inactivo y no recibe avisos del usuario anterior |
| Sin conexión | Activar modo avión, enviar, reactivar red | FCM entrega al recuperar conexión; centro conserva el aviso |
| Token vencido | Invalidar/desinstalar el receptor | Entrega queda `token_invalido` y dispositivo se desactiva |
| Dos dispositivos | Iniciar sesión en dos teléfonos | Ambos reciben una vez; abrir uno no elimina el aviso del otro |

Pruebas adicionales:

- Repetir la misma `idempotency_key`: debe existir una sola notificación.
- Enviar oportunidad durante horario silencioso: no debe generar push inmediato según el scheduler, pero debe aparecer en el centro.
- Enviar cambio urgente durante horario silencioso: debe enviarse.
- Descartar el push del sistema: debe permanecer no leído en `/notificaciones`.
- Pulsar pago realizado: debe abrir `/ganancias`, no `/panel`.
