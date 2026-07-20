# Sprint CLOSE — Bloque P0

## Implementado
- Caché del viaje activo administrada por `ViajeActivoProvider`.
- Limpieza integral única mediante `limpiarSesionIntegral`.
- Stop de tracking, borrado de cola y credenciales nativas al salir.
- Credenciales del tracking en `EncryptedSharedPreferences` respaldadas por Android Keystore.
- Solicitud progresiva real de `ACCESS_BACKGROUND_LOCATION`.
- Cold start offline con shell local; con red, `MainActivity` abre la aplicación remota.
- Versión única en `config/app-version.json`, consumida por Android y validada en CI; backend fijado por migración.
- Firebase inyectado como secreto Base64 y validado por package name en CI.

## Pendientes físicos obligatorios
COND-CLOSE-09 y COND-CLOSE-10 requieren APK firmado, teléfono físico y Firebase real. No deben marcarse PASS por inspección estática. Utilizar los protocolos incluidos en `tests/physical`.
