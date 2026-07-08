import type { CapacitorConfig } from "@capacitor/cli";

// Misma decisión que apps/app-conductor/capacitor.config.ts: WebView remota
// al dominio real (preserva Server Components/middleware/RLS tal como están
// validados), no export estático. Ver ese archivo para el detalle del
// tradeoff (no abre sin conexión al inicio).
const URL_PRODUCCION = "https://usuario.ruumruum-moviliax.online";

const config: CapacitorConfig = {
  appId: "com.moviliax.ruumruum.usuario",
  appName: "Ruum Ruum",
  webDir: "cap-shell",
  server: {
    androidScheme: "https",
    url: process.env.RUUM_CAPACITOR_SERVER_URL || URL_PRODUCCION
  }
};

export default config;
