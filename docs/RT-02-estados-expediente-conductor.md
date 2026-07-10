# RT-02 — Estados del expediente del conductor

## Separación de responsabilidades

`conductores.estado_expediente` es la fuente única del registro, completitud y
revisión administrativa. `conductores.estado` permanece como estado operativo
para elegibilidad, sanciones y asignación de viajes. Un conductor puede tener
expediente `aprobado` y después pasar a `suspendido` sin confundir esa suspensión
con un registro incompleto.

El frontend nunca escribe estados administrativos con `update`. Las decisiones
de revisión usan `revisar_documento_conductor_admin` y
`aprobar_expediente_conductor_admin`; Postgres rechaza escrituras directas aunque
provengan de una sesión administradora.

## Estados del expediente

| Estado | Significado | Responsable del avance |
|---|---|---|
| `borrador` | Aún no existe una cuenta Auth completa. | Sistema |
| `correo_pendiente` | Cuenta creada, correo todavía sin confirmar. | Auth/Sistema |
| `datos_incompletos` | Correo confirmado, faltan datos obligatorios. | Conductor/Sistema |
| `documentos_pendientes` | Datos completos; faltan documentos vigentes. | Conductor/Sistema |
| `listo_para_enviar` | Datos y documentos requeridos están completos. | Sistema |
| `en_revision` | Expediente enviado y bloqueado para decisión administrativa. | Sistema/Admin |
| `requiere_correccion` | Administración rechazó al menos un documento corregible. | Admin |
| `aprobado` | Revisión terminada; el conductor puede activarse. | Admin |
| `rechazado` | Decisión final negativa. Estado terminal. | Admin |
| `suspendido` | Expediente previamente aprobado con suspensión administrativa. | Admin/Sistema |

## Transiciones válidas del expediente

| Origen | Destinos permitidos |
|---|---|
| `borrador` | `correo_pendiente` |
| `correo_pendiente` | `datos_incompletos`, `documentos_pendientes` |
| `datos_incompletos` | `documentos_pendientes` |
| `documentos_pendientes` | `listo_para_enviar` |
| `listo_para_enviar` | `en_revision` |
| `en_revision` | `requiere_correccion`, `aprobado`, `rechazado` |
| `requiere_correccion` | `datos_incompletos`, `documentos_pendientes`, `listo_para_enviar` |
| `aprobado` | `suspendido` |
| `rechazado` | Ninguno |
| `suspendido` | `aprobado`, `rechazado` |

No se permiten saltos, auto-transiciones ni reabrir un rechazo final. La tabla
`expediente_conductor_transiciones` y un trigger validan estas reglas en la base.
El módulo `@ruum/shared/states` refleja la misma gráfica para UI y pruebas.

## Estados y transiciones de documentos

| Origen | Destinos permitidos |
|---|---|
| `en_revision` | `aprobado`, `rechazado`, `reemplazado` |
| `aprobado` | `vencido`, `reemplazado` |
| `rechazado` | `reemplazado` |
| `reemplazado` | Ninguno |
| `vencido` | `reemplazado` |

Una corrección siempre inserta una versión nueva en `en_revision`; la versión
anterior cambia automáticamente a `reemplazado`. No se sobrescribe ni se borra
evidencia histórica. Los valores heredados `pendiente` y `actualizacion` se
normalizan a `en_revision` durante la migración.

## Automatizaciones

1. La creación del conductor determina `correo_pendiente` o
   `documentos_pendientes` según la confirmación real de Auth.
2. Confirmar el correo evalúa si los datos están completos.
3. Al cargar el tercer documento obligatorio, el sistema recorre
   `documentos_pendientes → listo_para_enviar → en_revision`.
4. Rechazar un documento mueve `en_revision → requiere_correccion`.
5. La carga de su reemplazo mueve el expediente de vuelta a
   `documentos_pendientes` y reevalúa su completitud.
6. Sólo el RPC administrativo puede aprobar el expediente y activar al
   conductor, después de comprobar los tres documentos aprobados.

## Invariantes de seguridad

- El conductor sólo puede insertar documentos propios en `en_revision`.
- El conductor no puede actualizar o eliminar versiones documentales.
- Ni el conductor ni el panel administrativo pueden escribir directamente
  `estado_expediente` o el estado de un documento.
- Los RPC administrativos vuelven a comprobar `es_admin()` dentro de Postgres.
- Toda transición inválida falla en la base, incluso si un cliente omite el
  frontend o manipula una petición.
