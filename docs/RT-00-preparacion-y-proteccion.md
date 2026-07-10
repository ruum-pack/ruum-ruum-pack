# RT-00 — Preparación y protección

Fecha de línea base: 2026-07-10  
Rama: `refactor/registro-conductor-seguro`  
Commit inicial de la rama: `86fc70dd8a681926f6c001d4d39c6a3c4a1e8e49`  
Punto de retorno en `main`: `b4e462f`

## Estado de los ambientes

| Ambiente | Proyecto | Estado de migraciones al cierre |
|---|---|---|
| Local | Supabase CLI en `127.0.0.1` | 54/54 aplicadas |
| Remoto vinculado | `rgvzrzjfyzdedowgokjl.supabase.co` | 54/54 aplicadas |

Las cuatro configuraciones locales de las aplicaciones apuntan al mismo
proyecto remoto. No se encontró configuración para un segundo proyecto de
staging o producción. Por tanto, la confirmación cubre todos los ambientes
configurados y accesibles desde este repositorio, no ambientes externos que no
estén registrados aquí.

La base local tenía pendientes las migraciones 52–54. Después de respaldarla se
aplicaron con `supabase migration up --local`; la comparación final quedó sin
diferencias. El proyecto remoto ya tenía las 54.

## Política de migraciones

- Las migraciones `20260708000001` a `20260710000054` forman la línea base
  inmutable.
- Sus hashes SHA-256 están en `docs/RT-00-migraciones.sha256`.
- Una modificación posterior se comprueba recalculando el hash de cada archivo
  y comparándolo con esa línea base.
- Una corrección de esquema siempre se agrega como una migración nueva con un
  timestamp mayor; nunca se edita una migración aplicada.
- Antes de `supabase db push` se ejecutan `supabase migration list` y un nuevo
  respaldo de esquema, datos y roles.

## Flujo actual de registro de conductor

1. `/registro` muestra un wizard de cinco pasos: identidad, domicilio,
   documentos, verificación y revisión.
2. El cliente valida campos, contraseña, CURP, vigencia de licencia, teléfono,
   aceptación legal y archivos. Sólo guarda un borrador no sensible en
   `localStorage`, con caducidad de 48 horas; excluye contraseña, CURP y archivos.
3. Al confirmar, el navegador llama a `supabase.auth.signUp()` y envía los datos
   del formulario en `raw_user_meta_data` con `tipo_registro = conductor`.
4. El trigger `manejar_nuevo_usuario_auth`, definido por la migración 49, crea
   `public.conductores` en estado `pendiente_verificacion` y registra los eventos
   de creación de cuenta y aceptación de términos.
5. Si `signUp()` entrega sesión inmediata, el cliente busca el conductor con
   hasta cinco reintentos y sube licencia frontal, licencia reversa e
   identificación al bucket `documentos-conductor`. Después inserta cada
   referencia en `documentos_conductor` con estado `en_revision`.
6. Si la confirmación de correo impide una sesión inmediata, la cuenta queda
   creada pero la carga de documentos se difiere a Configuración.
7. Las migraciones 52–54 impiden duplicar CURP, teléfono o licencia, traducen
   conflictos de unicidad y evitan que un conductor apruebe, modifique o elimine
   sus propios registros documentales.

## Puntos de comparación para el refactor

- Resultado exitoso: existe exactamente un usuario Auth y un conductor ligado
  por `auth_user_id`.
- Estado inicial: `pendiente_verificacion`.
- Los tres documentos quedan en `en_revision` cuando hay sesión y las cargas
  terminan correctamente.
- Sin sesión inmediata, no se pierden los datos del conductor; sólo queda
  pendiente la carga documental.
- CURP, teléfono y licencia repetidos se rechazan sin crear duplicados.
- La auditoría conserva `creacion_cuenta`, `aceptacion_terminos` y
  `carga_documentos` cuando corresponde.

## Respaldo y reversión

Los respaldos completos se guardaron fuera del repositorio en el entregable
`rt-00-backups/2026-07-10`. Hay archivos separados de esquema, datos y roles
para local y remoto, con hashes en su `MANIFEST.md`.

Reversión de código:

```powershell
git stash push --include-untracked -m "resguardo antes de volver a main"
git switch main
```

El `stash` conserva los cambios sin commit y deja `main` en el punto de retorno
anterior al trabajo de esta rama. Para retomarlos:

```powershell
git switch refactor/registro-conductor-seguro
git stash pop
```

Reversión de base de datos:

1. Detener escrituras de las aplicaciones.
2. Verificar el SHA-256 del respaldo contra `MANIFEST.md`.
3. Restaurar en una base vacía o en un proyecto de recuperación primero; no
   sobrescribir producción sin validar ese ensayo.
4. Aplicar en orden `roles`, `schema` y `data` con `psql -v ON_ERROR_STOP=1`.
5. Comparar conteos, relaciones críticas y la tabla
   `supabase_migrations.schema_migrations` antes de cambiar tráfico.

Ejemplo para una base de recuperación local:

```powershell
psql "$env:RECOVERY_DATABASE_URL" -v ON_ERROR_STOP=1 -f remote-roles.sql
psql "$env:RECOVERY_DATABASE_URL" -v ON_ERROR_STOP=1 -f remote-schema.sql
psql "$env:RECOVERY_DATABASE_URL" -v ON_ERROR_STOP=1 -f remote-data.sql
```

Los dumps contienen registros y deben tratarse como información sensible: no
se versionan, no se envían por correo y deben almacenarse cifrados cuando se
copien fuera de este equipo.

El dump de `storage.objects` respalda los registros y metadatos de Storage, no
el contenido binario de los objetos. La copia de archivos del bucket requiere
un respaldo separado si el alcance futuro incluye también esos binarios.
