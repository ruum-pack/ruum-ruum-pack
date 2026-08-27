# CLOSE-FIX-11 a CLOSE-FIX-16

- La cola nativa se guarda en un archivo independiente de `EncryptedSharedPreferences`, cifrado con Android Keystore y separado por usuario. Incluye migración de una sola vez desde el almacén cifrado anterior.
- El force logout con pendientes exige autorización, motivo, ticket y confirmación explícita; además genera un evento operativo sanitizado.
- El shell consulta cada 10 segundos la conectividad nativa y sólo vuelve a la URL remota tras confirmar `NET_CAPABILITY_VALIDATED` de forma estable.
- La prueba estática cubre una respuesta mixta con punto aceptado, duplicado, rechazo permanente y punto reintentable.
- El acta GO/NO-GO se entrega como plantilla pendiente de ejecución y firmas reales.
- El rollback debe probarse físicamente; para Android se recomienda una build basada en la versión anterior pero con `versionCode` superior, firmada con la misma clave.
