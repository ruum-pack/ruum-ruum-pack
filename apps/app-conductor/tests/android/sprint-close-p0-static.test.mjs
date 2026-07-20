import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(process.cwd());
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const requireCheck = (condition, message) => {
  if (!condition) throw new Error(`CLOSE-P0: ${message}`);
};

const securePreferences = read(
  "apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/SecureTrackingPreferences.java",
);
const secureQueue = read(
  "apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/SecureTrackingQueuePreferences.java",
);
const trackingPointStore = read(
  "apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/TrackingPointStore.java",
);
const plugin = read(
  "apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/BackgroundTrackingPlugin.java",
);
const cleanup = read("apps/app-conductor/src/lib/session-cleanup.ts");
const mainActivity = read(
  "apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/MainActivity.java",
);
const appGradle = read("apps/app-conductor/android/app/build.gradle");
const versionConfig = JSON.parse(read("config/app-version.json"));

requireCheck(
  securePreferences.includes("EncryptedSharedPreferences"),
  "las credenciales nativas no usan EncryptedSharedPreferences",
);
requireCheck(
  securePreferences.includes("MasterKey"),
  "las credenciales nativas no están respaldadas por Android Keystore",
);
requireCheck(
  secureQueue.includes("EncryptedSharedPreferences") &&
    trackingPointStore.includes("usuarioId") &&
    trackingPointStore.includes("KEY_PREFIX"),
  "la cola de telemetría no está cifrada y segmentada por usuario",
);
requireCheck(
  plugin.includes("requestBackgroundLocation"),
  "falta la solicitud nativa progresiva de background location",
);
requireCheck(
  cleanup.includes("limpiarCredencialesTrackingNativo") && cleanup.includes("detenerTrackingNativo"),
  "la limpieza integral no detiene tracking y limpia credenciales",
);
requireCheck(
  mainActivity.includes("NET_CAPABILITY_VALIDATED"),
  "el cold start no valida conectividad real",
);
requireCheck(
  mainActivity.includes("BuildConfig.RUUM_REMOTE_URL"),
  "la URL remota no está parametrizada por ambiente",
);
requireCheck(
  appGradle.includes("config/app-version.json") && appGradle.includes("versionCode"),
  "Android no consume la fuente unificada de versión",
);
requireCheck(
  typeof versionConfig.version === "string" && Number.isInteger(versionConfig.versionCode),
  "config/app-version.json no contiene versión y versionCode válidos",
);

console.log(
  `Sprint CLOSE P0 static checks: PASS (${versionConfig.version}/${versionConfig.versionCode})`,
);
