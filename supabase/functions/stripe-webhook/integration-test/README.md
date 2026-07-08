# Prueba de integración local de `stripe-webhook`

Hasta este corte, lo único probado de esta función era `logica.ts` (las funciones puras de
decisión, vía `deno test`) — el archivo `index.ts` real, el que de verdad recibe la petición HTTP,
verifica la firma de Stripe y llama a Supabase, nunca se había ejecutado ni una sola vez.

Esto cierra esa brecha **localmente**, sin necesitar una cuenta de Stripe ni un proyecto de
Supabase desplegado:

- `mock-supabase.mjs` — un mock mínimo de PostgREST (lo que `@supabase/supabase-js` llama por
  debajo) que entiende exactamente las dos tablas que el webhook toca (`pagos`, `traslados`) y
  expone `/__requests` para inspeccionar qué llamó el webhook de verdad, y `/__reset` para
  reiniciar el estado entre casos.
- `runner.mjs` — firma eventos de Stripe **exactamente como Stripe los firma** (esquema
  documentado: `HMAC-SHA256("{timestamp}.{payload}", webhook_secret)`, sin llamar a ningún
  servidor de Stripe — es matemática local, no red), y los envía por HTTP al `index.ts` real
  corriendo de verdad con `deno serve`/`Deno.serve`.

## Qué prueba (6 casos, sobre el handler real, no sobre `logica.ts`)

1. Pago al cierre completado (`pago_pendiente` → `pago_completado`) — el camino que se cerró en
   este mismo corte (ver README principal de `supabase/functions`).
2. Pago anticipado completado (`solicitud_creada` → `documentacion_pendiente`) — confirma que el
   camino existente no se rompió.
3. Pago fallido — actualiza `pagos.estado` a `fallido` y **no** toca `traslados`.
4. Idempotencia — un reintento de Stripe con el mismo `event.id` no vuelve a escribir nada.
5. Tipo de evento no manejado (ej. `charge.refunded`) — responde 200 sin llamar a Supabase.
6. Firma inválida — responde 400 sin llamar a Supabase.

## Cómo correrlo

```bash
# Terminal 1
node mock-supabase.mjs

# Terminal 2 (mismo directorio: supabase/functions)
STRIPE_SECRET_KEY=sk_test_dummy_local \
STRIPE_WEBHOOK_SECRET=whsec_test_local_12345 \
SUPABASE_URL=http://localhost:8787 \
SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key \
deno run --allow-net --allow-env ../stripe-webhook/index.ts

# Terminal 3
node runner.mjs
```

## Límite honesto — lo que esto NO prueba

- Que Stripe en modo de prueba real de verdad emita estos eventos así (la forma del evento la
  armé a mano siguiendo la documentación pública de Stripe, no la copié de un evento real
  capturado).
- Que la firma que Stripe Dashboard genera con tu `STRIPE_WEBHOOK_SECRET` real coincida con esto
  en producción (debería, es el mismo algoritmo, pero no hay sustituto de probarlo con tu secreto
  real).
- RLS/Postgres reales — el mock no es Postgres, así que no valida políticas de fila ni
  constraints de la base real.
- La función ya desplegada en Supabase Edge Functions (red, cold starts, límites de tiempo).

Antes de producción, sigue siendo necesario lo que ya decía el README principal:
`stripe listen --forward-to https://<tu-proyecto>.supabase.co/functions/v1/stripe-webhook` +
`stripe trigger payment_intent.succeeded` contra tu cuenta de Stripe real.
