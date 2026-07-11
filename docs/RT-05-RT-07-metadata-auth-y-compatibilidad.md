# RT-05 a RT-07 — Metadata mínima y compatibilidad

## Contrato de Auth v2

El registro de conductor sólo envía estos valores no sensibles a Auth:

```ts
options: {
  data: {
    tipo_registro: "conductor",
    version_registro: 2
  }
}
```

El trigger `manejar_nuevo_usuario_auth()` crea una solicitud base en `borrador`,
con JSON vacíos y `version_registro = 2`. Para la rama conductor no consulta ni
copia CURP, teléfono, domicilio, licencia, contactos, antecedentes,
verificaciones o consentimientos desde `raw_user_meta_data`.

La compatibilidad temporal de `app-usuario` está aislada en
`crear_usuario_legacy_desde_auth()`. No forma parte de la rama conductor y puede
retirarse cuando esa aplicación adopte su propio registro v2.

## Persistencia del expediente

Después de obtener una sesión —inmediata o mediante OTP— la aplicación llama
`completar_solicitud_conductor_v2()`. La RPC:

- exige `auth.uid()` y correo confirmado;
- bloquea y localiza únicamente la solicitud activa del usuario;
- valida los objetos y campos obligatorios;
- deja actuar las restricciones normalizadas de RT-04;
- escribe la información en `solicitudes_conductor`;
- avanza el expediente hasta `documentos_pendientes`.

Los documentos se cargan sólo después de completar correctamente esa operación.
La PII nunca se vuelve a escribir en Auth.

## Compatibilidad

| Caso | Tratamiento |
|---|---|
| Conductor aprobado anterior | Conserva `conductores` y opera sin cambios. |
| Conductor pendiente anterior | Continúa con el flujo legacy basado en `conductores`. |
| Solicitud anterior con datos completos | Se conserva como versión 1, origen `legacy_metadata`. |
| Solicitud v2 incompleta | Permanece en `borrador`, `correo_pendiente` o `datos_incompletos` hasta autenticarse y completarse. |
| Solicitud v2 completa | Continúa con documentos y revisión de RT-02/03. |

`clasificar_registro_conductor()` permite auditar esos casos durante la
transición. Es una función interna, no expuesta a clientes.

## Metadata histórica

Esta fase no borra ni modifica `auth.users.raw_user_meta_data` existente. La
información histórica puede compararse con los datos relacionales y eliminarse
en una migración futura únicamente después de verificar cobertura y respaldos.

## Verificación

La prueba `rt05_rt07_metadata_minima_compatibilidad.test.sql` demuestra que:

1. metadata con sólo dos claves crea el perfil base;
2. no se crea un conductor antes de la aprobación;
3. la solicitud base no contiene PII;
4. completar el expediente autenticado no cambia `user_metadata`;
5. usuarios legacy aprobados, pendientes y con solicitudes v1 se clasifican y
   continúan existiendo sin eliminar su metadata.
