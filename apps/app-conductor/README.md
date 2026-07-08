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

## Capacitor (Fase 5)

**Decisión tomada:** la WebView carga la app real desde Vercel (`https://www.concer.ruumruum-moviliax.online`, fija en
`capacitor.config.ts` con `RUUM_CAPACITOR_SERVER_URL` como override opcional para otros ambientes) en vez de un
export estático embebido. Esto preserva Server Components, middleware y RLS exactamente como ya están validados
en producción — el costo real es que la app **no abre sin conexión al inicio** (solo afecta la carga de la
página; las llamadas a plugins nativos como cámara/GPS funcionan igual una vez cargada). Si más adelante se
necesita que abra sin señal en cualquier momento, eso es una migración a export estático aparte, no un ajuste de
configuración.

- `npx cap add android` ya corrido — el proyecto en `android/` es real, no un placeholder.
- **Cámara real** (`@capacitor/camera`) conectada en `/viajes/[id]/evidencia`: el botón "Tomar foto" abre la
  cámara nativa cuando corre dentro del shell; en navegador sigue mostrando "Marcar capturado" para registrar
  metadatos reales durante desarrollo web.
- **GPS real** (`@capacitor/geolocation`) etiqueta cada foto capturada con lat/lng reales.
- **Cola local offline** (`lib/cola-offline.ts`, `@capacitor/preferences`): cada foto capturada en el shell
  nativo se encola localmente con un `localId` (UUID, clave de idempotencia) antes de intentar registrarse en
  Supabase. La propuesta de arquitectura original planteaba SQLite; aquí se usa Preferences (key-value simple)
  como simplificación deliberada — alcanza para encolar unas pocas fotos pendientes, que es el caso real
  mientras Supabase Storage no esté conectado (la subida real de los bytes sigue pendiente, ver abajo).
- Permisos agregados a mano en `android/app/src/main/AndroidManifest.xml`: `CAMERA`, `ACCESS_FINE_LOCATION`,
  `ACCESS_COARSE_LOCATION` — Capacitor no los agrega solo.

**Lo que no se pudo hacer en este entorno:** este sandbox no tiene Android SDK ni Gradle completo, así que todo
lo de arriba está validado por `tsc`/`next build` (compila, tipos correctos), no por una compilación nativa real
ni una APK instalada en un dispositivo. Para compilar de verdad:

```bash
npx cap sync android
npx cap open android   # abre Android Studio
# o, con el SDK ya instalado:
cd android && ./gradlew assembleDebug
```

**iOS no se agregó** — `cap add ios` requiere macOS/Xcode, no disponible en ningún entorno de esta conversación.
Es el mismo comando (`npx cap add ios`) desde una Mac cuando llegue el momento.

## Fase 6 — Stripe Connect (pago semanal real)

PRD §4.6 — decisión de producto: Stripe Connect (Express). La pantalla de Ganancias consulta el estado real de
la cuenta del conductor (`cuentas_conductor_stripe`) y tiene un botón "Conectar Stripe" que llama la Edge Function
`crear-cuenta-conductor-stripe` (ver `supabase/functions/README.md`) y redirige al onboarding real de Stripe.
El resumen semanal y el detalle por viaje se calculan únicamente desde `payouts_conductor`.

No se pudo probar un onboarding real de Stripe Connect en este entorno — validado por `tsc`/`next build`.

## Chat (PRD §4.12)

`/viajes/[id]` ahora tiene chat en vivo con el usuario — mismo componente y regla de disponibilidad que
`app-usuario` (ver su README para el detalle de `chatDisponible()`). Encontré el mismo bug de "use client"
faltante que casi rompió el build de las 3 apps al construir esto — ver nota en el README raíz.

Ya está conectado: junto al chat hay un botón **"Llamar"** (Twilio Proxy, vía `crear-llamada-enmascarada`),
igual criterio que `app-usuario`. `/registro` ahora pide el teléfono real del conductor — sin eso, Twilio no
tiene a quién relacionar con el número virtual de la sesión.

## Pendiente (siguientes cortes de Fase 4 / Fase 5)

- Subida real de los bytes de cada foto a Supabase Storage — hoy se encolan localmente (cola offline) y se
  registra el metadato con una URL de marcador de posición; el contrato de datos ya es el definitivo.
- GPS en **segundo plano** (tracking continuo durante el traslado, no solo al tomar una foto) — necesita un
  Foreground Service nativo de Android con notificación persistente, que es código nativo adicional más allá de
  llamar un plugin JS. Documentado en el `AndroidManifest.xml`.
- Notificaciones push (FCM) — no se agregó `@capacitor/push-notifications` en este corte.
- Completar la generación operativa de `payouts_conductor` para poblar ganancias con datos productivos.
- Columna de disponibilidad en tiempo real en `conductores` — el Panel ya intenta persistirla vía API; falta
  confirmar el contrato definitivo de backend si cambia el modelo.
- Subida de documentos para la validación CONCER (PRD §16.5.2) — el registro deja al conductor en
  `pendiente_verificacion`, pero todavía no hay pantalla para subir licencia/identificación/etc.
- Reporte de incidencia, mapa de seguimiento, configuración (cuenta/preferencias/soporte) — PRD §16.5.

```
pnpm --filter @ruum/app-conductor dev
```
