import type { CapacitorConfig } from "@capacitor/cli";

// Decisión registrada (ver apps/app-conductor/README.md, sección Capacitor):
// la WebView carga la app real desde Vercel en vez de un export estático
// embebido. Esto preserva Server Components, middleware y RLS exactamente
// como ya están validados — el costo real es que la app no abre sin
// conexión al inicio (solo afecta la carga de la página, no las llamadas a
// plugins nativos como cámara/GPS, que funcionan igual una vez cargada).
//
// La URL queda fija aquí (en vez de depender solo de una variable de
// entorno) porque pasar esa variable de forma confiable hasta el build de
// Gradle desde Windows agrega fricción real sin beneficio para este corte.
// RUUM_CAPACITOR_SERVER_URL sigue funcionando como override explícito si
// algún día se necesita apuntar a otro ambiente (staging, por ejemplo).
const URL_PRODUCCION = "https://ruum-ruum-pack.vercel.app";

const config: CapacitorConfig = {
  appId: "com.moviliax.ruumruum.conductor",
  appName: "Ruum Ruum Conductor",
  webDir: "cap-shell",
  server: {
    androidScheme: "https",
    url: process.env.RUUM_CAPACITOR_SERVER_URL || URL_PRODUCCION
  }
};

export default config;
