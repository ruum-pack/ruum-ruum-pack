# Edge Functions — Fase 6 (Stripe + Twilio)

PRD §4.6 — decisión de producto: **Stripe** (cobro al usuario) + **Stripe Connect Express** (pago semanal al
conductor). PRD §4.12 — decisión de producto: **Twilio Proxy** (llamadas enmascaradas).

## Funciones

| Función | Quién la llama | Qué hace |
|---|---|---|
| `crear-payment-intent` | `app-usuario`: wizard de nuevo traslado (pago anticipado) y `/traslados/[id]` (pago al cierre) | Crea un PaymentIntent para el traslado y registra la fila `pagos` (estado `pendiente`) |
| `stripe-webhook` | Stripe (servidor a servidor) | Recibe los eventos de Stripe y actualiza `pagos`, `cuentas_conductor_stripe` y `payouts_conductor` |
| `crear-cuenta-conductor-stripe` | `app-conductor`, pantalla Ganancias | Crea (si no existe) la cuenta Stripe Connect Express del conductor y devuelve la URL de onboarding |
| `crear-llamada-enmascarada` | Ambas apps, pantalla de chat del traslado | Crea (o reutiliza) la sesión de Twilio Proxy del traslado y devuelve el número virtual al que el cliente abre un enlace `tel:` |
| `validar-documento-conductor` | `app-conductor`, registro y correcciones | Valida el contenido real, sanea el archivo, lo guarda en el bucket privado y registra/reemplaza la versión mediante RPC |

### Documentos de conductor

`validar-documento-conductor` recibe `multipart/form-data` y no confía en la extensión ni en el MIME enviados
por el navegador. Reconoce la firma y estructura de JPG, PNG, WEBP o PDF, exige imágenes de al menos 800 x 600,
rechaza PDF truncados/cifrados, limita a 10 MB y elimina metadatos EXIF de JPG, PNG y WEBP. La ruta final es
`auth_user_id/objetivo_id/tipo/documento`; `objetivo_id` es la solicitud durante el alta y el conductor después
de la aprobación. Un sello SHA-256 de un solo uso enlaza la validación, el upload y la RPC, por lo que un cliente
no puede saltarse la inspección llamando directamente a Storage. Si falla la RPC, elimina el objeto como compensación.

## Validado, con un límite honesto

La lógica de decisión de las 4 funciones está separada en archivos `logica.ts`, **probada de verdad con
`deno test`** — 10 casos para Stripe, 11 para Twilio, 21 en total, sin mocks. Las 4 funciones completas pasan
`deno check` (typecheck real contra los tipos oficiales de cada librería).

**Las llamadas reales a la API de Stripe ya se probaron en modo de prueba** (PaymentIntent en MXN, cuenta
Connect Express en México, Account Link de onboarding — las tres con HTTP 200). **Twilio no se pudo probar
contra su API real** — a diferencia de Stripe, no se compartieron credenciales de Twilio en esta sesión.

**`stripe-webhook/index.ts` (el handler completo, no solo `logica.ts`) ya se ejecutó de verdad**, vía
`stripe-webhook/integration-test/` (ver su README): un mock local de PostgREST + un evento de Stripe firmado
con el mismo esquema HMAC que usa Stripe de verdad (sin red hacia Stripe — es matemática local), enviado por
HTTP al `index.ts` real corriendo con `deno serve`. 6 casos, sobre el handler real: pago al cierre completado
(el camino que se cerró en este corte), pago anticipado completado (confirma que no se rompió), pago fallido,
idempotencia ante reintento de Stripe, evento no manejado, y firma inválida — los 6 pasan. Esto es más fuerte
que solo probar `logica.ts`, pero sigue sin ser un sustituto de probar contra Stripe real: la forma del evento
se armó a mano siguiendo la documentación pública de Stripe, no se copió de un evento real capturado, y no hay
Postgres/RLS de verdad detrás del mock.

Lo que **todavía no** se pudo probar para ninguna de las dos integraciones: las funciones desplegadas de verdad
en Supabase, la verificación de firma del webhook de Stripe contra un evento real *de Stripe* (la de arriba es
una firma propia, válida criptográficamente pero no emitida por Stripe), y el flujo completo end-to-end desde
la UI (incluyendo que un enlace `tel:` realmente abra el marcador nativo con el número de Twilio Proxy).

```bash
# Stripe — instalar Stripe CLI en tu máquina, luego:
stripe listen --forward-to https://<tu-proyecto>.supabase.co/functions/v1/stripe-webhook
stripe trigger payment_intent.succeeded

# Twilio — crear el Proxy Service una vez en Twilio Console (Develop → Proxy →
# Services → Create new Service), copiar su SID a TWILIO_PROXY_SERVICE_SID.
```

Un hallazgo real de `deno check` que vale la pena mencionar: los eventos `transfer.paid`/`transfer.failed` que
se habían planeado al diseñar esto **no existen** en la API de Stripe — los correctos para un objeto `Transfer`
son `transfer.created`/`transfer.reversed` (la confirmación de que el dinero llegó al banco del conductor es un
objeto `Payout` distinto, del lado de la cuenta conectada, no cubierto en este corte).

Un gap real encontrado al construir Twilio: **ni `usuarios` ni `conductores` tenían columna de teléfono** — sin
eso, Twilio Proxy no tiene a quién relacionar con el número virtual. Corregido en `0023_telefonos_twilio.sql`,
y `/registro` de ambas apps ahora lo captura.

## Gap real encontrado y cerrado: `crear-payment-intent` solo aceptaba pago anticipado

`estadoTrasladoSiguienteTrasPago` (en `stripe-webhook/logica.ts`) ya sabía manejar un pago `al_cierre` desde
hace tiempo — pero nada del lado del cliente podía llegar a dispararlo: `crear-payment-intent` rechazaba con
422 cualquier traslado cuyo `tipo_pago` no fuera `"anticipado"`, y `/traslados/[id]` no tenía ningún botón de
pago. Un traslado con pago al cierre llegaba a `pago_pendiente` y se quedaba ahí, sin manera real de cerrarse.

Corregido: la función ahora acepta `tipo_pago = "al_cierre"` siempre que el traslado esté en estado
`pago_pendiente` (el único punto del camino feliz donde ese cobro tiene sentido — ver `TRANSICIONES`,
`entrega_confirmada -> pago_pendiente -> pago_completado`); el pago anticipado sigue funcionando igual que
antes, sin ese requisito de estado. También empieza a usar `precio_final` si ya existe (en vez de cobrar
siempre `precio_cotizado`), aunque hoy ninguna pantalla escribe esa columna todavía — queda lista para cuando
se modele un ajuste de precio al cierre. Del lado de `app-usuario`, `PagoTraslado.tsx` monta el mismo
`PagoStripe` del wizard dentro del Pasaporte Digital cuando `estado === "pago_pendiente"`.

## Variables de entorno (Supabase Dashboard → Edge Functions → Secrets, nunca en el repo)

```
STRIPE_SECRET_KEY            sk_test_... (o sk_live_... en producción)
STRIPE_WEBHOOK_SECRET        whsec_... (de Stripe Dashboard → Webhooks → tu endpoint)
TWILIO_ACCOUNT_SID           AC...
TWILIO_AUTH_TOKEN            (de Twilio Console)
TWILIO_PROXY_SERVICE_SID     KS... (del Proxy Service que crees en Twilio Console)
SUPABASE_URL                 ya disponible automáticamente en Edge Functions
SUPABASE_ANON_KEY            idem
SUPABASE_SERVICE_ROLE_KEY    idem
RUUM_APP_CONDUCTOR_URL       https://www.concer.ruumruum-moviliax.online (o tu dominio)
```

## Desplegar

```bash
supabase functions deploy stripe-webhook
supabase functions deploy crear-payment-intent
supabase functions deploy crear-cuenta-conductor-stripe
supabase functions deploy crear-llamada-enmascarada
supabase functions deploy validar-documento-conductor
```

`crear-payment-intent` está configurada con `verify_jwt = false` en `supabase/config.toml` para que el gateway de
Supabase deje pasar el preflight `OPTIONS` desde el navegador. La función sigue exigiendo `Authorization` dentro del
handler y valida el traslado con RLS antes de crear el cobro.

Después de desplegar `stripe-webhook`, registra su URL en Stripe Dashboard → Developers → Webhooks, suscrita a:
`payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `transfer.created`,
`transfer.reversed`.

## Pendiente

- Confirmación de depósito bancario real al conductor (`payout.paid`/`payout.failed`) — requiere un webhook
  separado del lado de la cuenta conectada ("Connect webhooks"), no cubierto aquí.
- Registrar la duración real de cada llamada (`llamadas_enmascaradas.duracion_segundos`) — necesita el webhook
  de status callback de Twilio Voice, no cubierto en este corte.
- Cerrar la sesión de Proxy cuando el traslado se cierra (`sesiones_proxy_traslado.cerrada_en`) — hoy se crea
  pero nada la cierra automáticamente todavía.
