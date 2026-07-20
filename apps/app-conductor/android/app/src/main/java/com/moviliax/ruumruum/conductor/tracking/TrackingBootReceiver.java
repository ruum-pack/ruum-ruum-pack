package com.moviliax.ruumruum.conductor.tracking;

import android.content.*;
import androidx.core.content.ContextCompat;

public class TrackingBootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        boolean active = context.getSharedPreferences(TrackingContract.PREFS, Context.MODE_PRIVATE).getBoolean(TrackingContract.KEY_ACTIVE, false);
        if (!active) return;
        Intent service = new Intent(context, DriverTrackingService.class).setAction(TrackingContract.ACTION_START);
        try { ContextCompat.startForegroundService(context, service); }
        catch (Exception error) { context.getSharedPreferences(TrackingContract.PREFS, Context.MODE_PRIVATE).edit().putString(TrackingContract.KEY_LAST_ERROR, "boot_restart_blocked").apply(); }
    }
}
