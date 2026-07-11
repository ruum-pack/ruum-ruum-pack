# RT-03 / RT-04 — Solicitudes de conductor e integridad

## Modelo

`solicitudes_conductor` representa el proceso de alta. Puede existir desde
`borrador`, pertenece a un usuario de Auth y sólo obtiene `conductor_id` al ser
aprobada. `conductores` queda reservado para identidades operativas aprobadas.

Campos principales:

- `id`, `auth_user_id`, `conductor_id`, `estado` y `paso_actual`.
- `datos_personales`, `domicilio`, `licencia` y `contacto_emergencia` como
  objetos JSON validados.
- `creado_en`, `actualizado_en` y `enviado_en`.
- `curp_normalizada`, `telefono_normalizado` y `licencia_normalizada` como
  columnas generadas por PostgreSQL; el frontend no puede falsificarlas.

Una solicitud se considera activa mientras no esté `aprobado` o `rechazado`.
El índice parcial `solicitudes_conductor_auth_activa_unica` impide que un mismo
usuario de Auth tenga dos solicitudes activas.

## Integridad y búsquedas

PostgreSQL mantiene índices únicos para:

- CURP normalizada con `upper(trim(...))`.
- Teléfono normalizado conservando sólo dígitos.
- Número de licencia con `upper(trim(...))`.
- `conductores.auth_user_id` (restricción existente).
- Solicitud activa por `auth_user_id`.

Las solicitudes también se validan contra los identificadores ya existentes en
`conductores`, y las altas directas de conductores se validan contra solicitudes.
La misma validación cruzada impide crear una solicitud para un `auth_user_id`
que ya tenga identidad operativa.
Se usan bloqueos transaccionales consultivos para evitar carreras entre dos
altas concurrentes. Los conflictos usan SQLSTATE `23505` y mensajes
`conductor_duplicado:<campo>`.

Índices de consulta:

- `(estado, actualizado_en desc)` para colas de revisión.
- `auth_user_id` para recuperar el expediente de la sesión.
- GIN sobre `datos_personales` para búsquedas administrativas justificadas.
- `(solicitud_id, creado_en desc)` para versiones documentales.

## Flujo de alta

1. `auth.signUp()` crea una fila en `solicitudes_conductor`, no en
   `conductores`.
2. Si el correo requiere confirmación, inicia en `correo_pendiente`; después
   avanza a `documentos_pendientes`.
3. Los documentos se relacionan con `solicitud_id`. Exactamente uno de
   `solicitud_id` o `conductor_id` debe estar presente.
4. Al completar los tres documentos obligatorios la solicitud avanza a
   `en_revision` mediante la máquina de RT-02.
5. `aprobar_solicitud_conductor_admin()` comprueba permisos y documentos,
   crea la identidad operativa, transfiere los documentos, activa el conductor
   y enlaza la solicitud aprobada.

## Seguridad

- RLS permite al solicitante leer su expediente y editar sólo estados
  corregibles; no puede cambiar directamente el estado administrativo.
- El solicitante únicamente puede insertar documentos propios en
  `en_revision`.
- Administración revisa y aprueba mediante RPC `security definer` que vuelven
  a comprobar `es_admin()`.
- Una restricción `CHECK` impide documentos huérfanos o ligados a solicitud y
  conductor simultáneamente.
- Los permisos de tabla se limitan a las operaciones que las políticas RLS
  pueden autorizar.

## Compatibilidad

Las filas de `conductores` anteriores a RT-03 se conservan. No se migran ni se
eliminan registros históricos. Sólo las cuentas creadas después de la migración
57 utilizan el alta separada.
