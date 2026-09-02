import type { CapacitorConfig } from "@capacitor/cli";

// Decisión de diseño: WebView remota al dominio de producción (ADR 002)
const URL_PRODUCCION = "https://usuario.ruumruum-moviliax.online";

const config: CapacitorConfig = {
  appId: "com.moviliax.ruumruum.usuario",
  appName: "Ruum Ruum",
  webDir: "cap-shell",
  server: {
    androidScheme: "https",
    cleartext: false,
    url: process.env.RUUM_CAPACITOR_SERVER_URL || URL_PRODUCCION,
    allowNavigation: [
      "*.ruumruum-moviliax.online",
      "usuario.ruumruum-moviliax.online",
      "*.supabase.co",
      "*.supabase.in",
      "verify.didit.me",
      "*.didit.me",
      "apx.didit.me",
      "js.stripe.com",
      "*.stripe.com",
      "*.stripe.network",
      "hooks.stripe.com",
      "*.mapbox.com",
      "api.mapbox.com",
      "events.mapbox.com"
    ]
  },
  android: {
    backgroundColor: "#070b14",
    allowMixedContent: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#070b14"
    }
  }
};

export default config;
