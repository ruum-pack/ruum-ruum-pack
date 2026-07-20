package com.moviliax.ruumruum.conductor.tracking;

import android.content.*;
import androidx.core.content.ContextCompat;

public class TrackingBootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        android.content.SharedPreferences prefs = SecureTrackingPreferences.get(context);
        if (!prefs.getBoolean(TrackingContract.KEY_ACTIVE, false)) return;
        long startedAt = prefs.getLong(TrackingContract.KEY_STARTED_AT, 0);
        long age = startedAt <= 0 ? Long.MAX_VALUE : System.currentTimeMillis() - startedAt;
        if (age < 0 || age > TrackingContract.MAX_BOOT_RECOVERY_AGE_MS) {
            prefs.edit().putBoolean(TrackingContract.KEY_ACTIVE, false).remove(TrackingContract.KEY_STARTED_AT)
                .putString(TrackingContract.KEY_LAST_ERROR, "boot_tracking_expired").apply();
            return;
        }
        Intent service = new Intent(context, DriverTrackingService.class).setAction(TrackingContract.ACTION_START);
        try { ContextCompat.startForegroundService(context, service); }
        catch (Exception error) { NativeErrorReporter.report(context, "boot_restart_blocked", error); }
    }
}
