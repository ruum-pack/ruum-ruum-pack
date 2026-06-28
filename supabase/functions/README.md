# Edge Functions — Fase 6 (Stripe)

PRD §4.6 — decisión de producto: **Stripe** (cobro al usuario) + **Stripe Connect Express** (pago semanal al
conductor).

## Funciones

| Función | Quién la llama | Qué hace |
|---|---|---|
| `crear-payment-intent` | `app-usuario`, wizard de nuevo traslado | Crea un PaymentIntent para el traslado recién creado y registra la fila `pagos` (estado `pendiente`) |
| `stripe-webhook` | Stripe (servidor a servidor) | Recibe los eventos de Stripe y actualiza `pagos`, `cuentas_conductor_stripe` y `payouts_conductor` |
| `crear-cuenta-conductor-stripe` | `app-conductor`, pantalla Ganancias | Crea (si no existe) la cuenta Stripe Connect Express del conductor y devuelve la URL de onboarding |

## Validado, con un límite honesto

La lógica de decisión de `stripe-webhook` (idempotencia ante reintentos, extracción de `traslado_id`, criterio
de cuenta activa, qué tipos de evento se manejan) está en `stripe-webhook/logica.ts`, **probada de verdad con
`deno test`** — 10 casos, sin mocks. Las tres funciones completas pasan `deno check` (typecheck real contra los
tipos oficiales de la librería de Stripe, no solo "se ve bien").

**Las tres llamadas reales a la API de Stripe que hacen estas funciones ya se probaron contra la API real en
modo de prueba** (no solo contra los tipos): crear un PaymentIntent en MXN con metadata (`crear-payment-intent`),
crear una cuenta Connect Express en México (`crear-cuenta-conductor-stripe`), y crear el Account Link de
onboarding — las tres respondieron HTTP 200 con la forma exacta que el código espera. Los objetos de prueba se
limpiaron después (cuenta eliminada; el PaymentIntent, al nunca confirmarse, Stripe lo descarta solo).

Lo que **todavía no** se pudo probar: las funciones desplegadas de verdad en Supabase (Edge Functions), la
verificación de firma del webhook contra un evento real de Stripe, y el flujo completo end-to-end desde la UI.
Eso requiere desplegar (`supabase functions deploy`), configurar los secrets, y registrar el webhook:

```bash
# Instalar Stripe CLI en tu máquina, luego:
stripe listen --forward-to https://<tu-proyecto>.supabase.co/functions/v1/stripe-webhook
stripe trigger payment_intent.succeeded   # dispara un evento de prueba real
```

Un hallazgo real de `deno check` que vale la pena mencionar: los eventos `transfer.paid`/`transfer.failed` que
se habían planeado al diseñar esto **no existen** en la API de Stripe — los correctos para un objeto `Transfer`
son `transfer.created`/`transfer.reversed` (la confirmación de que el dinero llegó al banco del conductor es un
objeto `Payout` distinto, del lado de la cuenta conectada, no cubierto en este corte).

## Variables de entorno (Supabase Dashboard → Edge Functions → Secrets, nunca en el repo)

```
STRIPE_SECRET_KEY            sk_test_... (o sk_live_... en producción)
STRIPE_WEBHOOK_SECRET        whsec_... (de Stripe Dashboard → Webhooks → tu endpoint)
SUPABASE_URL                 ya disponible automáticamente en Edge Functions
SUPABASE_ANON_KEY            idem
SUPABASE_SERVICE_ROLE_KEY    idem
RUUM_APP_CONDUCTOR_URL       https://ruum-ruum-pack.vercel.app (o tu dominio)
```

## Desplegar

```bash
supabase functions deploy stripe-webhook
supabase functions deploy crear-payment-intent
supabase functions deploy crear-cuenta-conductor-stripe
```

Después de desplegar `stripe-webhook`, registra su URL en Stripe Dashboard → Developers → Webhooks, suscrita a:
`payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `transfer.created`,
`transfer.reversed`.

## Pendiente

- Confirmación de depósito bancario real al conductor (`payout.paid`/`payout.failed`) — requiere un webhook
  separado del lado de la cuenta conectada ("Connect webhooks"), no cubierto aquí.
- Twilio (llamadas enmascaradas) — depende de que exista una pantalla de chat primero (ver README raíz).
