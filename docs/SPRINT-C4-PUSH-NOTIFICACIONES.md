# Sprint C4 — Push notifications y comunicación operativa

## Arquitectura aplicada

1. Android obtiene el token FCM mediante `@capacitor/push-notifications`.
2. La app registra el token con `registrar_dispositivo_push`; la identidad estable es `device_id`, no el token.
3. Torre de Control o una función privilegiada invoca `encolar_notificacion_conductor` con una clave de idempotencia.
4. `despachar-notificaciones-push` toma la cola y envía por FCM HTTP v1 a todos los dispositivos activos.
5. El push incluye `notificacion_id`, `tipo` y `destino`; al tocarlo se registra apertura y se navega a la ruta exacta.
6. El centro `/notificaciones` conserva el historial, separa leídas/no leídas y permite recuperar avisos descartados.

## Configuración obligatoria

- Crear una app Android Firebase con package `com.moviliax.ruumruum.conductor`.
- Copiar el archivo real como `apps/app-conductor/android/app/google-services.json` (no versionarlo).
- Ejecutar `pnpm install` y `pnpm --filter @ruum/app-conductor exec cap sync android`.
- Desplegar la función: `supabase functions deploy despachar-notificaciones-push --no-verify-jwt`.
- Configurar secretos `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL` y `FCM_PRIVATE_KEY`.
- Invocar la función sólo con `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` desde un scheduler seguro.

## Contrato para Torre de Control

Ejemplo de alta idempotente:

```sql
select public.encolar_notificacion_conductor(
  p_usuario_id := '<auth-user-id>',
  p_tipo := 'traslado_asignado',
  p_titulo := 'Nuevo traslado asignado',
  p_cuerpo := 'Traslado RR-00125 listo para revisión',
  p_destino := '/viajes/<traslado-id>',
  p_idempotency_key := 'traslado:<traslado-id>:asignado:v1',
  p_entidad_tipo := 'traslado',
  p_entidad_id := '<traslado-id>',
  p_prioridad := 'alta'
);
```

Destinos normativos:

- traslado asignado: `/viajes/{id}`
- evidencia pendiente: `/viajes/{id}/evidencia`
- mensaje operativo: `/viajes/{id}/soporte`
- documento rechazado: `/documentos` (o la ruta vigente equivalente)
- pago realizado: `/ganancias`

## Preferencias

El servidor debe consultar `preferencias_conductor` antes de encolar eventos no críticos. `seguridad_critica`, `cambio_urgente_traslado` e incidencias activas no se cancelan por preferencias promocionales. `modo_no_molestar` sólo aplica a oportunidades, promociones y recordatorios no operativos.

## Invalidación

- Al cerrar sesión se desactiva únicamente el `device_id` actual.
- Un token renovado reemplaza el anterior para el mismo dispositivo.
- FCM `UNREGISTERED/NOT_FOUND` desactiva el token automáticamente.
- Un conductor puede mantener varios dispositivos activos.
