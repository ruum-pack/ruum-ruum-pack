# Edge Functions — Fase 6 (Stripe + Twilio)

PRD §4.6 — decisión de producto: **Stripe** (cobro al usuario) + **Stripe Connect Express** (pago semanal al
conductor). PRD §4.12 — decisión de producto: **Twilio Proxy** (llamadas enmascaradas).

## Funciones

| Función | Quién la llama | Qué hace |
|---|---|---|
| `crear-payment-intent` | `app-usuario`, wizard de nuevo traslado | Crea un PaymentIntent para el traslado recién creado y registra la fila `pagos` (estado `pendiente`) |
| `stripe-webhook` | Stripe (servidor a servidor) | Recibe los eventos de Stripe y actualiza `pagos`, `cuentas_conductor_stripe` y `payouts_conductor` |
| `crear-cuenta-conductor-stripe` | `app-conductor`, pantalla Ganancias | Crea (si no existe) la cuenta Stripe Connect Express del conductor y devuelve la URL de onboarding |
| `crear-llamada-enmascarada` | Ambas apps, pantalla de chat del traslado | Crea (o reutiliza) la sesión de Twilio Proxy del traslado y devuelve el número virtual al que el cliente abre un enlace `tel:` |

## Validado, con un límite honesto

La lógica de decisión de las 4 funciones está separada en archivos `logica.ts`, **probada de verdad con
`deno test`** — 10 casos para Stripe, 11 para Twilio, 21 en total, sin mocks. Las 4 funciones completas pasan
`deno check` (typecheck real contra los tipos oficiales de cada librería).

**Las llamadas reales a la API de Stripe ya se probaron en modo de prueba** (PaymentIntent en MXN, cuenta
Connect Express en México, Account Link de onboarding — las tres con HTTP 200). **Twilio no se pudo probar
contra su API real** — a diferencia de Stripe, no se compartieron credenciales de Twilio en esta sesión.

Lo que **todavía no** se pudo probar para ninguna de las dos integraciones: las funciones desplegadas de verdad
en Supabase, la verificación de firma del webhook de Stripe contra un evento real, y el flujo completo
end-to-end desde la UI (incluyendo que un enlace `tel:` realmente abra el marcador nativo con el número de
Twilio Proxy).

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
