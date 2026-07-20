import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const checks=[
 ['partial response', read('apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/TrackingUploadClient.java').includes('rechazadosPermanentes')],
 ['remove by ids', read('apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/TrackingPointStore.java').includes('removeByLocalIds')],
 ['native reporter', fs.existsSync('apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/NativeErrorReporter.java')],
 ['boot expiry', read('apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/TrackingBootReceiver.java').includes('MAX_BOOT_RECOVERY_AGE_MS')],
 ['monochrome icon', fs.existsSync('apps/app-conductor/android/app/src/main/res/drawable/ic_stat_tracking.xml')],
 ['logout guard', read('apps/app-conductor/src/lib/session-cleanup.ts').includes('blocked: true')],
 ['go no-go', fs.existsSync('docs/runbooks/CLOSE-P1-GO-NO-GO-ROLLBACK.md')]
];
const failed=checks.filter(([,ok])=>!ok); if(failed.length){console.error(failed);process.exit(1)} console.log('Sprint CLOSE P1 static checks: PASS');
