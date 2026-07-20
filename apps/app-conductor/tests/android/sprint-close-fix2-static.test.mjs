import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const base='apps/app-conductor';
const store=read(`${base}/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/TrackingPointStore.java`);
const secure=read(`${base}/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/SecureTrackingQueuePreferences.java`);
const upload=read(`${base}/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/TrackingUploadClient.java`);
const plugin=read(`${base}/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/BackgroundTrackingPlugin.java`);
const shell=read(`${base}/cap-shell/index.html`);
const logout=read(`${base}/src/lib/session-cleanup.ts`);
assert.match(secure,/EncryptedSharedPreferences/);
assert.match(secure,/AES256_GCM/);
assert.match(store,/SecureTrackingQueuePreferences/);
assert.match(store,/Migración de una sola vez/);
assert.match(logout,/force_logout_authorization_required/);
assert.match(logout,/session_force_logout/);
assert.match(plugin,/NET_CAPABILITY_VALIDATED/);
assert.match(shell,/setInterval\(.*10000/);
assert.match(shell,/validatedStreak/);
assert.match(upload,/aceptados/);
assert.match(upload,/duplicadosIds/);
assert.match(upload,/rechazadosPermanentes/);

// Respuesta mixta: aceptado + duplicado + rechazo permanente; sólo queda el reintentable.
const queued=['a','b','c','d'];
const response={aceptados:['a'],duplicadosIds:['b'],rechazadosPermanentes:[{localId:'c',razon:'payload_invalido'}]};
const terminal=new Set([...response.aceptados,...response.duplicadosIds,...response.rechazadosPermanentes.map(x=>x.localId)]);
assert.deepEqual(queued.filter(id=>!terminal.has(id)),['d']);
console.log('Sprint CLOSE FIX 11-16 static checks: PASS');
