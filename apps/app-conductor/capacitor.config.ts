import type { CapacitorConfig } from "@capacitor/cli";

const URL_PRODUCCION = "https://conductor.ruumruum-moviliax.online";

const config: CapacitorConfig = {
  appId: "com.moviliax.ruumruum.conductor",
  appName: "Ruum Ruum Conductor",
  webDir: "cap-shell",
  server: {
    androidScheme: "https",
    cleartext: false,
    url: process.env.RUUM_CAPACITOR_SERVER_URL || URL_PRODUCCION,
    allowNavigation: [
      "*.ruumruum-moviliax.online",
      "conductor.ruumruum-moviliax.online",
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
    backgroundColor: "#151515",
    allowMixedContent: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#151515"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
