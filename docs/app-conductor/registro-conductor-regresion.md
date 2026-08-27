# Registro seguro de conductores — regresión y monitoreo

## Ejecución reproducible

Con Supabase local iniciado:

```powershell
./scripts/test-registro-conductor.ps1
```

Para una vuelta rápida sin compilar las tres aplicaciones:

```powershell
./scripts/test-registro-conductor.ps1 -OmitirBuilds
```

Las pruebas SQL abren una transacción y terminan con `ROLLBACK`; no dejan usuarios, solicitudes ni documentos de prueba.

## Matriz RT-26

| Caso | Evidencia automatizada principal | Comprobación funcional |
| --- | --- | --- |
| Onboarding de cinco pasos | Validadores de `@ruum/shared`; build de app-conductor | Recorrer `/registro` y confirmar que cada paso impide avanzar con campos obligatorios vacíos. |
| Cuenta nueva | `rt05_rt07_metadata_minima_compatibilidad.test.sql` | Confirmar que `user_metadata` sólo contiene `tipo_registro` y `version_registro`. |
| OTP | Pruebas de traducción de Auth en `@ruum/shared` | Usar el SMTP local, probar código inválido, código válido y reenvío con cooldown. |
| Guardado remoto | `rt08_rt11_rpc_flujo_solicitud.test.sql` | Ver `Guardando…` y después `Guardado`, con debounce de 900 ms. |
| Cierre inesperado | Guardado remoto idempotente de RT-08/RT-09 | Cerrar la pestaña después de `Guardado` y volver a `/registro`. |
| Recuperación/cambio de dispositivo | `rt08_rt11_rpc_flujo_solicitud.test.sql` | Iniciar la misma cuenta en otro navegador y comprobar hidratación del expediente. |
| Documentos | `rt12_rt15_documentos_versionados.test.sql` | Subir los tres tipos, verificar estados visibles y que Storage no sea público. |
| Error de red | Telemetría `rpc_error` y estado local `sin_conexion` | Desactivar red durante edición y comprobar `Sin conexión`. |
| Reintento | Idempotencia RT-08 y versionado RT-15 | Reactivar red y confirmar un solo expediente y una sola versión vigente. |
| Envío | `rt08_rt11_rpc_flujo_solicitud.test.sql` | Intentar envío incompleto y luego envío completo; sólo el segundo entra a revisión. |
| Revisión administrativa | `rt23_rt24_torre_control_auditoria.test.sql` | Abrir la solicitud en `/conductores/[id]` con sesión administrativa. |
| Corrección | RT-15 y RT-23/RT-24 | Rechazar documento, entrar como conductor, reemplazarlo y conservar historial. |
| Aprobación | RT-23/RT-24 y `rt25_rls_perfiles_reales.test.sql` | Aprobar documentos y expediente; confirmar autor y fecha en historial. |

RT-25 se ejecuta con cinco contextos reales de PostgreSQL: anónimo, conductor A, conductor B, administrador y `service_role`. Comprueba aislamiento, ausencia de autoaprobación y acceso administrativo.

## RT-27 — definición de indicadores

La tabla `eventos_registro_conductor` sólo admite eventos y códigos enumerados; no guarda correo, CURP, teléfono, rutas, mensajes de proveedor ni contenido documental. `auth_user_id` y `solicitud_id` se derivan en servidor.

- **Abandono por paso:** expediente no terminal cuya última actualización ocurrió hace al menos 24 horas, agrupado por `paso_actual`.
- **Errores de OTP:** eventos `otp_error` por verificación o reenvío.
- **Errores de RPC:** fallos operativos de recuperación, guardado o envío.
- **Fallos de documentos:** cada carga documental rechazada por el pipeline.
- **Tiempo promedio de registro:** segundos entre creación y envío del expediente.
- **Tiempo promedio de revisión:** segundos desde entrada a revisión hasta corrección, aprobación o rechazo.
- **Documentos rechazados por tipo:** decisiones administrativas históricas, no sólo el estado vigente.

El agregado se consulta mediante `obtener_metricas_registro_conductor`; sólo un administrador autenticado puede ejecutarlo. Torre de Control lo presenta en `/metricas-registro` con un periodo máximo de 366 días.

## Despliegue y reversibilidad

1. Verificar que el respaldo previo a la fase existe y puede leerse.
2. Comparar `supabase migration list` entre local y el proyecto remoto.
3. Aplicar migraciones en orden; nunca modificar una migración aplicada.
4. Ejecutar esta regresión contra un ambiente de ensayo.
5. Desplegar las aplicaciones y observar `/metricas-registro` durante las primeras 24 horas.
6. Ante un incidente, revertir aplicaciones y restaurar la base desde el respaldo; los eventos de telemetría son aditivos y no contienen PII del expediente.
