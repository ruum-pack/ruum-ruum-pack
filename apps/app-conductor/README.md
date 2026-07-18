# @ruum/app-conductor

PRD §14 — instrucción operativa: **"La App Conductor debe enfocarse en
ejecución guiada, seguridad e incidencia rápida."**

PRD §16.8 — idea central: la app debe responder tres preguntas en segundos:
**¿qué viajes tengo disponibles? ¿qué viajes ya acepté? ¿cuánto voy a cobrar?**

## Pantallas construidas (Fase 4, primer corte + login real)

- `/` — Panel: disponibilidad, resumen de la semana, próximo depósito (PRD §16.2), con estado de sesión real
  (Iniciar sesión / Cerrar sesión).
- `/login` — inicio de sesión real con Supabase Auth.
- `/registro` — solicitud de certificación CONCER: `auth.signUp()` + inserción real en `conductores`
  (`estado` queda en `pendiente_verificacion`, su default — PRD §4.13: validación CONCER antes de operar).
- `/viajes` — Viajes disponibles y aceptados como pestañas (PRD §16.3), con elegibilidad evaluada en vivo
  (`esElegibleParaViaje`, `@ruum/shared/rules`) y botón de aceptar conectado de verdad a la base. Si hay sesión
  real, usa el conductor real (su propio nivel CONCER decide qué ve y puede aceptar).
- `/viajes/[id]` — Detalle del viaje (mismo Pasaporte Digital que usa app-usuario), con el siguiente paso del
  camino feliz como acción contextual (`TRANSICIONES`, `@ruum/shared/states`).
- `/viajes/[id]/evidencia` — Checklist de los 5 ángulos obligatorios (PRD §4.4), completitud evaluada en vivo
  (`evidenciaCompleta`) y confirmación que avanza el estado real del traslado.
- `/ganancias` — Mis ganancias (PRD §16.4), consulta básica.

Validado con un `next build` real: las 7 rutas compilan y generan páginas correctamente (incluyendo el
middleware de sesión). Con `next start` en producción (Vercel) se confirmó contenido real en las 5 pantallas
del primer corte, incluyendo Viajes y Evidencia tras hidratarse — ver detalle de esa validación en el historial
de la conversación con el equipo de producto. Login/Registro reales quedan validados por typecheck + build +
pruebas de RLS contra Postgres real (ver más abajo); falta confirmar el flujo visual completo contra un proyecto
Supabase real.

## Cuatro bugs reales encontrados al construir login y las pantallas operativas

Ninguno era del código de esta app — todos eran del esquema de Fase 1, nunca antes ejercitado bajo RLS real
porque toda la validación previa corrió como superusuario de Postgres (que ignora RLS por completo):

1. **Ningún conductor podía ver un viaje disponible.** Las políticas de `0005_traslados.sql` solo cubrían "mis
   traslados como usuario" y "mis traslados ya asignados como conductor" — ninguna cubría traslados sin asignar.
   Corregido en `0018_traslados_viajes_disponibles.sql`, con políticas de SELECT y UPDATE probadas con dos
   conductores reales bajo un rol no-superusuario (uno acepta el viaje, el otro deja de verlo y no puede
   "robárselo" con un UPDATE directo).
2. **Recursión infinita en RLS sobre `usuarios`.** La política `titular_ve_usuarios_de_su_empresa` (0002) se
   consulta a sí misma. Esto no solo bloqueaba las pantallas nuevas — bloqueaba **cualquier** consulta real de
   `app-usuario` que tocara `usuarios` o `pasaporte_digital` bajo RLS real, incluyendo su propia pantalla de
   seguimiento. Corregido en `0019_fix_recursion_usuarios.sql` con una función `security definer`, mismo patrón
   que ya usaba `es_admin()`.
3. **Ni `usuarios` ni `conductores` tenían política de INSERT para autoservicio.** Solo SELECT/UPDATE sobre el
   propio registro — el registro/alta nunca podría haber completado bajo RLS real. Corregido en
   `0021_self_registro.sql`, probado con dos casos reales: alguien crea su propio registro (funciona) e intenta
   crear el registro de otra persona (se rechaza). `admins` no recibe una política equivalente, a propósito.
4. **El botón hacia la pantalla de Evidencia nunca se pintaba.** `ETIQUETA_SIGUIENTE_PASO` (en `AccionesViaje.tsx`)
   tenía una etiqueta para el paso que *lleva* a `evidencia_inicial_en_proceso`/`evidencia_final_en_proceso`, pero
   no para esos dos estados *en sí mismos* — que es justo cuando la pantalla de detalle debía mostrar el botón
   "ir a evidencia". El bail-out `if (!etiqueta) return null` lo ocultaba en silencio. Encontrado probando la
   cámara real en un teléfono Android (Fase 5): sin este fix, no había ninguna ruta navegable por toque hasta
   `/evidencia`, solo escribiendo la URL a mano. Corregido agregando las dos etiquetas faltantes.

## Datos reales

La app conductor ya no incluye datos ni acciones de muestra. Sin `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, las pantallas muestran estados vacíos o errores operativos y no simulan viajes,
mensajes, evidencia, solicitudes ni ganancias.

## Arquitectura actual

La App Conductor es una aplicacion Next.js dentro del monorepo. Consume servicios compartidos desde
`@ruum/api`, reglas/contratos desde `@ruum/shared` y componentes desde `@ruum/ui`. El frontend guia la operacion,
pero los cambios sensibles se validan en Supabase mediante RLS, RPC, triggers y Storage privado.

En Android, Capacitor usa una WebView que carga la app remota configurada en `capacitor.config.ts`. Esta decision
mantiene Server Components, middleware, Auth y RLS como en produccion, pero implica una limitacion importante:
si la app se abre desde cero sin red, no hay shell local completo que reconstruya la operacion.

## Evidencia privada

El bucket `evidencia` es privado. La app ya no debe tratar `evidencia_fotos.url` como una URL publica; ese campo
guarda el path relativo del objeto en Storage. La lectura de imagenes debe resolverse con signed URLs temporales
mediante los servicios compartidos de evidencia.

Flujo actual:

1. El conductor captura foto desde `/viajes/[id]/evidencia`.
2. La foto se guarda primero en cola local con `localId`, tipo, angulo, traslado y metadatos.
3. Al sincronizar, `cola-offline.ts` sube el blob a Storage privado.
4. Se guarda el path relativo en `evidencia_fotos.url`.
5. Las pantallas que necesitan mostrar evidencia generan signed URLs temporales.

Las signed URLs no deben subirse como artifacts, logs, backups ni datos persistentes.

## Cola offline

La cola de evidencia vive en `apps/app-conductor/src/lib/cola-offline.ts` y usa `@capacitor/preferences` por medio
de la interfaz `EvidenceQueueStorage`. Cada item almacena contador de reintentos, ultimo intento y ultimo codigo
de error para diagnostico y backoff.

La cola cubre evidencia pendiente durante una sesion ya cargada. No equivale a offline completo de arranque: si
Android destruye el proceso y no hay red, la app puede no poder reconstruir el viaje activo hasta recuperar
conexion.

## RPC atomica y geocerca

La llegada al destino usa la RPC atomica `conductor_confirmar_llegada_destino`. La UI no debe encadenar varias
transiciones de negocio para llegar al estado final.

La geocerca de confirmacion usa un radio operativo de 500 m. Si el conductor confirma fuera de radio, la app
solicita una segunda accion consciente y envia a la RPC:

- `p_fuera_geocerca`
- `p_distancia_m`

Esto permite auditoria y revision por Torre de Control.

## Temas y tarjetas

App Conductor usa tema oscuro explicito con `<html data-theme="dark">`. Los tokens compartidos viven en
`packages/ui/src/styles/tokens.css` y definen `color-scheme` por tema para controles nativos.

La regla visual vigente para App Conductor es no usar fondos pastel completos como tarjetas. Las tarjetas deben
usar superficies oscuras y reservar colores funcionales para borde, badge, icono, monto o fondo translucido.

Paleta operativa recomendada:

- Fondo app: `#070B14`
- Tarjeta base: `#101A2C`
- Tarjeta elevada: `#162238`
- Texto principal: `#E8EDF6`
- Texto secundario: `#B7C2D4`
- Azul: `#4DA3FF`
- Dorado CTA: `#F5A623`
- Verde exito: `#3DDC97`
- Ambar alerta: `#F0B429`
- Rojo error: `#FF6B6B`

Para importes no relacionados con ganancias se debe usar `FinancialAmount`. `DriverEarning` queda reservado para
ganancias del conductor.

## Capacitor y limitacion del shell remoto

- Android esta agregado en `apps/app-conductor/android`.
- La WebView carga `https://www.concer.ruumruum-moviliax.online` salvo override `RUUM_CAPACITOR_SERVER_URL`.
- Permisos declarados: `CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
- Backup Android esta deshabilitado con `android:allowBackup="false"` y reglas defensivas en `res/xml`.
- iOS no esta agregado; requiere macOS/Xcode.

Mitigacion de piloto para arranque sin red:

1. El conductor debe abrir el viaje antes de iniciar traslado.
2. La app debe permanecer abierta durante el traslado.
3. Si se pierde red, se continua solo con las capacidades ya cargadas.
4. Si la app se cierra sin red, se activa protocolo de soporte/Torre de Control.

La matriz de validacion esta en `tests/android/offline-startup-validation.md`.

## Comandos de test

```bash
pnpm --filter @ruum/app-conductor typecheck
pnpm --filter @ruum/app-conductor lint
pnpm --filter @ruum/app-conductor test
pnpm --filter @ruum/app-conductor test:a11y
pnpm --filter @ruum/app-conductor storybook:build
pnpm --filter @ruum/app-conductor build
pnpm --filter @ruum/app-conductor test:lighthouse
```

Para Android nativo:

```bash
pnpm --filter @ruum/app-conductor exec cap sync android
cd apps/app-conductor/android
./gradlew assembleDebug
```

En Windows:

```powershell
pnpm --filter @ruum/app-conductor exec cap sync android
cd apps/app-conductor/android
.\gradlew.bat assembleDebug
```

## Dispositivos probados

| Dispositivo | Android | Build | Resultado | Evidencia |
| --- | --- | --- | --- | --- |
| Telefono Android real no identificado | No documentado | Fase 5 inicial | Se detecto que faltaba ruta visible hacia Evidencia; corregido | Pendiente de acta formal |
| Pendiente | Pendiente | Pendiente | Matrices Android F5-08/F5-09/F5-10/F5 sin red pendientes de ejecucion formal | `docs/qa/fase-5-validacion.md` |

La validacion formal por dispositivo debe registrarse en `docs/qa/fase-5-validacion.md`.

## Funcionalidades pendientes reales

- Offline de arranque productivo: shell local, cache persistente de viaje activo, pantalla offline local,
  evidencia/emergencia sin servidor y sincronizacion con conflictos.
- GPS en segundo plano con Foreground Service nativo y notificacion persistente.
- Push notifications con FCM.
- Validacion real de permisos Android en dispositivo: camara, galeria, ubicacion, retorno desde ajustes,
  segundo plano y cierre forzado.
- Ejecucion formal de matrices Android con evidencia de dispositivo.
- Transport real para logging estructurado en piloto/produccion.
- Consolidar migraciones historicas solo si aun no fueron aplicadas en ambientes compartidos.
- Decidir/implementar RPC atomica equivalente para llegada a origen si Operacion requiere auditar distancia de
  recoleccion con el mismo rigor que destino.

## Fase 6 — datos bancarios para pagos a conductores

PRD §4.6 — decisión de producto actual: los cobros al usuario siguen en Stripe, pero el pago semanal al conductor
ya no usa Stripe Connect. La pantalla de Ganancias permite capturar titular, banco, CLABE y número de tarjeta;
el guardado pasa por la RPC `conductor_guarda_datos_bancarios`, queda en `datos_bancarios_conductor` con estado
`en_revision` y registra auditoría sin exponer números completos en el evento.

El resumen semanal y el detalle por viaje se calculan únicamente desde `payouts_conductor`; cuando operación
programe una transferencia, la referencia debe registrarse en `payouts_conductor.referencia_pago`.

## Chat (PRD §4.12)

`/viajes/[id]` ahora tiene chat en vivo con el usuario — mismo componente y regla de disponibilidad que
`app-usuario` (ver su README para el detalle de `chatDisponible()`). Encontré el mismo bug de "use client"
faltante que casi rompió el build de las 3 apps al construir esto — ver nota en el README raíz.

Ya está conectado: junto al chat hay un botón **"Llamar"** (Twilio Proxy, vía `crear-llamada-enmascarada`),
igual criterio que `app-usuario`. `/registro` ahora pide el teléfono real del conductor — sin eso, Twilio no
tiene a quién relacionar con el número virtual de la sesión.

## Flujo "Iniciar viaje" (recolección del vehículo)

`/viajes/[id]` reemplaza el botón plano por dos pantallas dedicadas entre "Iniciar viaje" y la evidencia inicial:

1. **Dirígete al punto de inicio** (estado `conductor_en_camino_al_origen`): dirección y ciudad de recolección,
   más un mapa estático de la ruta (Mapbox Static Images API, no `mapbox-gl` — más liviano dentro del WebView de
   Capacitor). Si hay ubicación del conductor (`obtenerUbicacionActual`, solo en el shell nativo) se dibuja la
   ruta completa con Directions; si no, solo el pin de destino. Sin `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` configurado,
   la pantalla no muestra mapa, solo la dirección en texto. Botón **"He llegado"** avanza a
   `conductor_en_punto_de_recoleccion`.
2. **Contacto y localización del vehículo** (estado `conductor_en_punto_de_recoleccion`): nombre/teléfono de quien
   entrega (con botón "Llamar" vía `tel:`) y ficha del vehículo (marca, modelo, año, color, placas, VIN). Exige
   confirmar **ambas** cosas por separado antes de habilitar "Toma evidencias", que encadena las dos transiciones
   del camino feliz (`verificacion_vehiculo_en_proceso` → `evidencia_inicial_en_proceso`) y navega directo a
   `/evidencia` — `confirmarEvidenciaCompleta` exige estar exactamente en `evidencia_inicial_en_proceso`, así que
   no se puede saltar ningún paso del PRD §6, solo la pantalla intermedia.

La dirección de origen, los contactos y color/placas/VIN no estaban expuestos en la vista `pasaporte_digital`
(sí existían en `traslados`/`vehiculos`, con RLS que ya cubría al conductor asignado) — se agregaron en la
migración `20260715000100`.
