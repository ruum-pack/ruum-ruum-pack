# CLOSE-FIX-12 — Política de cierre forzado con pendientes

## Regla general

El conductor no puede cerrar sesión mientras existan evidencias o puntos de telemetría pendientes. La interfaz ordinaria debe mantener la sesión y mostrar los conteos pendientes.

## Excepción controlada

El cierre forzado sólo está permitido como procedimiento de soporte cuando continuar con la sesión representa un riesgo mayor, por ejemplo: cuenta equivocada en dispositivo compartido, sesión comprometida o aplicación irrecuperable.

Antes de ejecutarlo se requiere:

1. Intentar sincronización con red validada.
2. Registrar capturas, logs y conteos pendientes.
3. Crear un ticket de soporte.
4. Informar que los elementos locales pendientes podrían perderse.
5. Obtener autorización identificable del responsable operativo.
6. Introducir `autorizadoPor`, `motivo`, `ticketSoporte` y confirmación explícita.

No se permite utilizar `force: true` sin `autorizacion`. El intento falla con `force_logout_authorization_required`.

## Ejemplo de uso restringido

```ts
await limpiarSesionIntegral({
  force: true,
  autorizacion: {
    autorizadoPor: "supervisor@ruumruum.mx",
    motivo: "Sesión comprometida en dispositivo extraviado",
    ticketSoporte: "INC-2026-00125",
    confirmarPerdidaPendientes: true,
  },
});
```

El evento queda registrado como `session_force_logout`, sin incluir evidencia, ubicaciones, tokens ni datos bancarios.
