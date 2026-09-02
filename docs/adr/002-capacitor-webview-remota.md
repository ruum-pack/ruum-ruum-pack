# ADR 002 — Arquitectura WebView Remota vs Export Estático para Capacitor

- **Fecha:** 2026-09-02
- **Estado:** Aceptado / Implementado
- **Contexto:**
  Para compilar y empaquetar aplicaciones móviles con Capacitor (`app-conductor` y `app-usuario`), existen dos estrategias principales de entrega de la interfaz web:
  1. **Export Estático (`output: 'export'`)**: Los assets HTML/CSS/JS se precompilan y se empaquetan localmente en `android_asset/public` dentro del binario APK/AAB.
  2. **WebView Remota (`server.url`)**: La aplicación móvil actúa como un shell nativo que aloja un contenedor WebView apuntando a la URL del servidor web de producción (`https://conductor.ruumruum-moviliax.online` y `https://usuario.ruumruum-moviliax.online`).

  Las aplicaciones de Ruum están construidas con **Next.js 15 App Router** y dependen críticamente de:
  - Server Components (RSC) y Server Actions para validaciones y lógica de negocio segura.
  - Generación dinámica de Nonce CSP por petición y HSTS vía `middleware.ts`.
  - Autenticación dinámica de Supabase basada en cookies HttpOnly y refresco de tokens en servidor (`@supabase/ssr`).
  - Webhooks y flujos transaccionales con Stripe Elements y Didit Identity Verification.

  Un export estático forzaría la eliminación de Server Components, deshabilitaría el middleware de seguridad de Next.js y rompería el modelo de autenticación y transaccionalidad actual.

- **Decisión:**
  1. Adoptar **WebView Remota** configurando `server.url` en `capacitor.config.ts` mediante `process.env.RUUM_CAPACITOR_SERVER_URL || URL_PRODUCCION`.
  2. Proteger la comunicación de la WebView configurando:
     - `server.androidScheme: "https"`
     - `server.cleartext: false`
     - `android.allowMixedContent: false`
  3. Declarar explícitamente en `server.allowNavigation` únicamente los orígenes requeridos por el dominio del sistema y las integraciones de terceros autorizadas:
     - `*.ruumruum-moviliax.online`
     - `*.supabase.co`, `*.supabase.in`
     - `verify.didit.me`, `*.didit.me`, `apx.didit.me`
     - `js.stripe.com`, `*.stripe.com`, `*.stripe.network`, `hooks.stripe.com`
     - `*.mapbox.com`, `api.mapbox.com`, `events.mapbox.com`
  4. Mantener `cap-shell/` como contenedor de arranque local y fallback cuando el dispositivo se inicializa sin conectividad de red, permitiendo la interacción con la capa offline y plugins nativos (geolocalización en background, notificaciones push, cifrado Preferences en Android Keystore).

- **Consecuencias:**
  - `+` Preserva 100% de la arquitectura de Next.js App Router, Server Components y Middleware de seguridad.
  - `+` Permite despliegues y actualizaciones en caliente instantáneas de la interfaz web sin requerir re-publicación en Google Play Store / Apple App Store.
  - `+` Mantiene paridad total de código entre la versión PWA / Web y las aplicaciones móviles nativas.
  - `-` Requiere conexión a Internet para la carga inicial de páginas no cacheadas; mitigado mediante Service Worker, `OfflineShell` y persistencia en Preferences.

- **Referencias:**
  - `apps/app-conductor/capacitor.config.ts`
  - `apps/app-usuario/capacitor.config.ts`
  - `apps/app-conductor/src/app/OfflineShell.tsx`
