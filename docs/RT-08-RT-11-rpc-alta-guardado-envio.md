# RT-08 a RT-11 — RPC de alta, borrador y envío

## Inicio idempotente

`iniciar_solicitud_conductor()` valida `auth.uid()`, serializa llamadas
concurrentes por usuario y localiza o crea una única solicitud activa. Devuelve:

- `solicitud_id`;
- `conductor_id`;
- `estado`;
- `paso_actual`.

En el modelo separado de RT-03, `conductor_id` es nulo durante el alta v2 y se
asigna al aprobar. Los conductores legacy reciben su identificador existente.
El frontend usa `solicitud_id` para cargar documentos y ya no consulta ni espera
la aparición de una fila.

## Guardado del borrador

`guardar_borrador_conductor()` acepta las cuatro secciones del contrato como
parámetros opcionales y `paso_actual`. La RPC:

- comprueba propiedad con `auth.uid()`;
- acepta guardado por sección sin borrar las secciones omitidas;
- valida objetos JSON, rango del paso, CURP, teléfono, licencia y fecha;
- deja que las columnas generadas normalicen CURP, teléfono y licencia;
- nunca retrocede `paso_actual`;
- nunca cambia el estado a `en_revision`;
- rechaza cambios después del envío.

Cuando todos los datos están completos puede avanzar únicamente hasta
`documentos_pendientes`. El borrador queda en PostgreSQL y sobrevive al cierre
de la aplicación o cambio de dispositivo.

## Envío

`enviar_solicitud_conductor()` ejecuta en una transacción:

1. bloquea la solicitud activa del usuario;
2. valida todos los datos obligatorios;
3. comprueba los tres tipos documentales vigentes;
4. rechaza licencias vencidas;
5. comprueba autorización de antecedentes, declaración de suspensiones y
   consentimiento legal versionado;
6. registra `enviado_en`;
7. recorre `listo_para_enviar → en_revision`;
8. escribe la auditoría `envio_solicitud_conductor`.

La carga del tercer documento ya no envía solicitudes v2 automáticamente. Los
expedientes legacy ligados directamente a `conductores` conservan su flujo
anterior por compatibilidad.

## Flujo del frontend

```text
sesión confirmada
→ iniciar_solicitud_conductor
→ guardar_borrador_conductor
→ cargar documentos usando solicitud_id
→ enviar_solicitud_conductor
```

Se eliminó el bucle de cinco consultas, la espera de 350 ms y la función
`obtenerSolicitudConReintento`. Los `setTimeout` que permanecen en el archivo
pertenecen exclusivamente al debounce del borrador local y a la interfaz OTP;
ninguno espera registros de base de datos.

## Verificación

`rt08_rt11_rpc_flujo_solicitud.test.sql` prueba dos inicios consecutivos,
guardado por secciones, reingreso, rechazo por documentos faltantes, rechazo de
licencia vencida, envío completo, auditoría y bloqueo de modificaciones
posteriores.
