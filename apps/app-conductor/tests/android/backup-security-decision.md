# F5-10 - Seguridad del backup Android

## Decision

App Conductor usa `allowBackup=false`.

Motivo: la app maneja datos operativos sensibles de conductor y traslado. La evidencia local, cola offline, sesion, URLs firmadas, cache y borradores no deben salir del dispositivo mediante backup automatico ni transferencia entre dispositivos.

## Inventario de datos locales

| Dato | Ubicacion actual | Sensibilidad | Decision |
| --- | --- | --- | --- |
| Sesion Supabase/cookies WebView | Almacenamiento interno de WebView/cookies | Alta | Excluido por `allowBackup=false` |
| Cola offline de evidencia | Capacitor Preferences, key `ruum_cola_evidencia` | Alta: contiene dataUrl/base64, traslado, lat/lng | Excluido |
| Evidencia local pendiente | Dentro de cola offline como data URL | Alta | Excluido |
| URLs firmadas temporales | Estado de app/cache WebView cuando existen | Alta | Excluido |
| Borrador de registro | `localStorage`, key `ruum_conductor_registration_draft_v2` | Alta: datos personales/documentales | Excluido |
| Flag onboarding visto | Capacitor Preferences, key `ruum_conductor_onboarding_visto` | Baja | Excluido junto con todo backup |
| Aviso de chat visto | `localStorage`, key por traslado | Media-baja | Excluido |
| Cache WebView/Next assets | Cache interna | Media si incluye HTML con datos | Excluido |

## Controles implementados

- `android:allowBackup="false"` en `AndroidManifest.xml`.
- `android:fullBackupContent="@xml/backup_rules"` con exclusion defensiva de `sharedpref`, `database`, `file`, `external` y `root`.
- `android:dataExtractionRules="@xml/data_extraction_rules"` con exclusion defensiva para `cloud-backup` y `device-transfer`.

## Screenshots sensibles

No se activo `FLAG_SECURE` global en este cambio.

Razon: bloquear capturas en toda la app puede impedir soporte operativo durante piloto y no distingue entre pantallas sensibles y pantallas de ayuda. La decision recomendada para la siguiente etapa es evaluar proteccion por pantalla nativa o una politica de soporte para:

- evidencia;
- documentos;
- datos bancarios;
- datos sensibles de perfil;
- emergencia.

Hasta entonces, el criterio cerrado en este ticket es backup de dispositivo, no captura de pantalla.

## Criterio de aceptacion

Los datos operativos sensibles no se incluyen en backups de dispositivo ni en transferencia entre dispositivos.
