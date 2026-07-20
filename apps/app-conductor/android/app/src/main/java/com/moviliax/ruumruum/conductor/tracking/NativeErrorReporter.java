package com.moviliax.ruumruum.conductor.tracking;

import android.content.Context;
import android.content.Intent;
import android.util.Log;
import org.json.JSONObject;

final class NativeErrorReporter {
    static final String ACTION_NATIVE_ERROR = "com.moviliax.ruumruum.conductor.NATIVE_ERROR";
    private NativeErrorReporter() {}
    static void report(Context context, String code, Throwable error) {
        String detail = error == null ? code : error.getClass().getSimpleName();
        Log.e("RuumNative", code, error);
        SecureTrackingPreferences.get(context).edit()
            .putString(TrackingContract.KEY_LAST_ERROR, code + ":" + detail)
            .putLong(TrackingContract.KEY_LAST_ERROR_AT, System.currentTimeMillis()).apply();
        Intent event = new Intent(ACTION_NATIVE_ERROR).setPackage(context.getPackageName());
        event.putExtra("code", code); event.putExtra("detail", detail);
        context.sendBroadcast(event);
    }
}
