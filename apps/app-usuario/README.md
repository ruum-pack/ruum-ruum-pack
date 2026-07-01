# @ruum/app-usuario

PRD §14 — instrucción operativa: **"La App Usuario debe enfocarse en
confianza, visibilidad y cierre documental."**

## Pantallas construidas (Fase 2, primer corte + login real)

- `/` — landing con los 3 pilares de confianza del producto (PRD §14), una
  guía de creación de cuenta verificada y estado de sesión real verificado en
  el servidor.
- `/login` — inicio de sesión real con Supabase Auth (correo + contraseña).
- `/registro` — alta de cuenta personal/empresa (PRD §3, §4.1), conectado de
  verdad: `auth.signUp()` + inserción real en `usuarios`. El nombre se guarda
  en los metadatos de Auth (no existe columna `usuarios.nombre`).
- `/traslados/nuevo` — wizard de 4 pasos (vehículo → ruta → agenda →
  servicio), con las reglas reales de
  `packages/shared` conectadas en vivo: el paso de confirmación muestra el
  momento de pago (`determinarMomentoPago`, PRD §4.6) y el aviso de política
  de cancelación (`calcularCargoCancelacion`, PRD §4.7) calculados de verdad,
  no texto estático. Si hay sesión real, usa el usuario real (historial real
  decide pago anticipado vs. al cierre); si Supabase está configurado pero no
  hay sesión, manda a `/login` en vez de fallar en silencio contra RLS.
- `/traslados/[id]` — Pasaporte Digital de Traslado (PRD §5.1): estado,
  stepper de las 7 etapas visibles para el usuario, conductor, evidencia y
  pagos, leyendo de la vista `pasaporte_digital`.

Validado con un `next build` + `next start` reales (no solo "se ve bien en
el código"): las 7 rutas compilan, y se confirmó el contenido en el HTML
real de cada una (incluyendo los valores que vienen de `packages/shared`).

## Datos reales

La app de usuario requiere `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas para iniciar sesión, registrar
cuentas, crear traslados, consultar pasaportes digitales y ejecutar acciones
del expediente. Si esas variables no existen, las pantallas muestran un aviso
de configuración y no simulan datos ni solicitudes.

## Gap real encontrado al construir esto

Ninguna de las dos tablas (`usuarios`, `conductores`) tenía política de
**INSERT** para autoservicio — solo SELECT/UPDATE sobre el propio registro
(0002/0003). El registro nunca podría haber completado bajo RLS real.
Corregido en `0021_self_registro.sql`, probado con dos casos reales bajo un
rol no-superusuario: alguien crea su propio registro (funciona) e intenta
crear el registro de otra persona (se rechaza). `admins` no recibe una
política equivalente a propósito — ver `panel-admin/README.md`.

## Segundo bug real, encontrado probando el registro contra Supabase de verdad

`0021` resolvía el caso bajo RLS, pero asumía que había sesión activa justo
después de `auth.signUp()` — falso si el proyecto tiene confirmación de
correo activada (el default de Supabase): `auth.uid()` no es nadie todavía,
así que el insert manual desde el cliente fallaba. Corregido en
`0024_trigger_alta_cuenta.sql`: un trigger sobre `auth.users` crea la fila
en `usuarios` automáticamente, leyendo `tipo_registro`/`tipo_cuenta`/
`telefono` de los metadatos que ahora manda `signUp()` — corre con
privilegios elevados, no depende de sesión. Probado con tres casos reales:
alta personal, alta empresa (verifica que `rol` quede en `titular_empresa`),
y un `signUp` sin `tipo_registro` que no debe crear nada (caso de un futuro
admin). También se atrapó ahí un bug de tipos real: un `CASE` en PL/pgSQL
devuelve texto plano por defecto, pero `rol` es un enum — necesitaba cast
explícito.

## Capacitor (Fase 5)

Misma decisión que `app-conductor` (ver su README para el detalle completo del tradeoff): WebView remota a
Vercel, no export estático. `npx cap add android` ya corrido.

Esta app no tiene todavía una pantalla que capture evidencia fotográfica (el wizard de nuevo traslado no incluye
ese paso — ver "Pendiente"), así que no se agregó `@capacitor/camera` aquí; sí se agregó
`@capacitor/geolocation`: el paso de Origen del wizard tiene un botón "Usar mi ubicación actual" (solo visible
dentro del shell nativo) que reemplaza el placeholder `lat/lng = 0` con la posición real del dispositivo.
Geocodificación real de la dirección escrita sigue pendiente — esto solo cubre "dónde está el dispositivo ahora".

Permiso agregado a mano en `android/app/src/main/AndroidManifest.xml`: `ACCESS_FINE_LOCATION` /
`ACCESS_COARSE_LOCATION`. iOS no se agregó (requiere macOS/Xcode). Igual que en app-conductor: validado por
`tsc`/`next build`, no por una compilación nativa real en este entorno.

## Fase 6 — Stripe (cobro anticipado real)

PRD §4.6 — decisión de producto: Stripe. El paso de confirmación del wizard ahora puede mostrar un formulario de
pago real (`PagoStripe.tsx`, Stripe Elements) cuando `momentoPago.momento === "anticipado"` **y**
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` está configurada. Sin esa variable, el flujo de pago anticipado
se detiene con un error visible para no crear una solicitud sin cobro. El traslado se crea primero, y el PaymentIntent se crea contra ese
`traslado_id` real (vía la Edge Function `crear-payment-intent`, ver `supabase/functions/README.md`).

No se pudo probar un cobro real contra una cuenta de Stripe en este entorno — validado por `tsc`/`next build` y,
del lado de la función, por `deno check` + `deno test` sobre su lógica de decisión.

## Chat (PRD §4.12)

`/traslados/[id]` ahora tiene chat en vivo con el conductor (componente `Chat` de `@ruum/ui`, Supabase Realtime
vía `packages/api/src/services/chat.ts`). La ventana de disponibilidad usa la regla ya resuelta y probada
`chatDisponible()` (`packages/shared/src/rules/chat-disponible.ts`, 6 tests): desde que se asigna conductor
hasta el cierre del traslado — la versión correcta, no la de "24 horas post-cierre" que quedó descartada al
revisar el PRD. Fuera de esa ventana, el campo de texto se deshabilita con el motivo visible.

Esto es lo que faltaba para conectar Twilio (llamadas enmascaradas) después — ya hay una pantalla real donde
agregar el botón de llamada.

Ya está conectado: junto al chat hay un botón **"Llamar"**, visible solo dentro de la misma ventana de
disponibilidad. Llama a la Edge Function `crear-llamada-enmascarada` (Twilio Proxy) y abre un enlace `tel:` con
el número virtual que regresa — no hay softphone embebido, es un puente hacia el marcador nativo del teléfono.
`/registro` ahora pide el teléfono (formato `+52...`), porque sin eso Twilio no tiene a quién llamar.

## Inicio (Fase 2, segundo corte)

`/` ahora tiene dos caras: la landing pública de siempre para quien no tiene sesión, y la sección de Inicio
(PRD §14) para quien sí la tiene — mensaje central, viaje activo con su estatus, notificaciones derivadas del
estado real de los traslados (no hay tabla de notificaciones en el esquema), accesos rápidos, últimos viajes y
los mismos pilares de confianza.

## Pago al cierre — gap cerrado

`PagoStripe.tsx` solo se montaba en el wizard de nuevo traslado (pago anticipado); un traslado con pago al
cierre llegaba a `pago_pendiente` sin ningún botón real para pagar — la Edge Function `crear-payment-intent`
rechazaba cualquier `tipo_pago` que no fuera `"anticipado"`. Ver el detalle del fix en
`supabase/functions/README.md`. Del lado de esta app: `traslados/[id]/PagoTraslado.tsx` monta el mismo
`PagoStripe` dentro del Pasaporte Digital cuando `estado === "pago_pendiente"`, con su propio aviso cuando
Supabase o Stripe no están configurados.


## Pendiente (siguientes cortes de Fase 2)

- Pantallas de seguimiento en tiempo real (mapa), chat, calificación y
  disputa (PRD §9).
- Geocodificación real de la dirección escrita — hoy son campos de texto
  simples. El origen puede usar GPS real dentro del shell nativo (ver
  Capacitor arriba); el destino sigue enviándose en `lat`/`lng = 0` siempre
  (no tiene sentido usar la ubicación del dispositivo para "a dónde va el
  vehículo").
- Motor de cotización automática — hoy es un monto manual con nota explícita
  en el wizard.
- Confirmación de correo de Supabase Auth (depende de la configuración del
  proyecto) — el mensaje post-registro ya avisa de esto si aplica.

```
pnpm --filter @ruum/app-usuario dev
```
