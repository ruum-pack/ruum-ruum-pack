import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
const checks=[
 ["automatic provider cache", read("apps/app-conductor/src/app/ViajeActivoContext.tsx").includes("pasaporteActivo") && !fs.existsSync("apps/app-conductor/src/app/CacheViajeActivoOffline.tsx")],
 ["single logout hook", read("apps/app-conductor/src/app/panel/page.tsx").includes("useCerrarSesion") && read("apps/app-conductor/src/app/cuenta/seguridad/page.tsx").includes("useCerrarSesion")],
 ["no direct logout outside cleanup", !read("apps/app-conductor/src/app/cuenta/seguridad/page.tsx").includes("auth.signOut")],
 ["evidence queue user bound", read("apps/app-conductor/src/lib/cola-offline.ts").includes("usuarioId") && read("apps/app-conductor/src/lib/cola-offline.ts").includes("evidence_queue_user_required")],
 ["native queue user bound", read("apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/TrackingPointStore.java").includes("KEY_PREFIX") && read("apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/TrackingPointStore.java").includes("usuarioId")],
 ["offline shell summary", read("apps/app-conductor/cap-shell/index.html").includes("Resumen operativo") && read("apps/app-conductor/cap-shell/index.html").includes("Puntos pendientes")],
 ["validated network", read("apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/MainActivity.java").includes("NET_CAPABILITY_VALIDATED")],
 ["environment remote URL", read("apps/app-conductor/android/app/build.gradle").includes("RUUM_REMOTE_URL") && read("apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/MainActivity.java").includes("BuildConfig.RUUM_REMOTE_URL")]
];
const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks) console.log(`${ok?"PASS":"FAIL"}: ${name}`);
if(failed.length) process.exit(1);
console.log("Sprint CLOSE FIX static checks: PASS");
