package com.moviliax.ruumruum.conductor.tracking;

import android.Manifest;
import android.content.*;
import android.os.Build;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import com.moviliax.ruumruum.conductor.BuildConfig;

@CapacitorPlugin(name = "BackgroundTracking", permissions = {
    @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
    @Permission(alias = "backgroundLocation", strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION })
})
public class BackgroundTrackingPlugin extends Plugin {
    @PluginMethod public void start(PluginCall call) {
        String userId = call.getString("userId", "");
        String tripId = call.getString("tripId", "");
        String accessToken = call.getString("accessToken", "");
        String supabaseUrl = call.getString("supabaseUrl", "");
        String anonKey = call.getString("anonKey", "");
        if (userId.isEmpty() || tripId.isEmpty() || accessToken.isEmpty() || supabaseUrl.isEmpty() || anonKey.isEmpty()) { call.reject("tracking_configuration_incomplete"); return; }
        if (getPermissionState("location") != PermissionState.GRANTED) { requestPermissionForAlias("location", call, "permissionCallback"); return; }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) { requestPermissionForAlias("notifications", call, "permissionCallback"); return; }
        startInternal(call);
    }

    @PermissionCallback private void permissionCallback(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED || (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED)) {
            call.reject("tracking_permission_denied"); return;
        }
        startInternal(call);
    }

    private void startInternal(PluginCall call) {
        SecureTrackingPreferences.get(getContext()).edit()
            .putString(TrackingContract.KEY_USER_ID, call.getString("userId", ""))
            .putString(TrackingContract.KEY_TRIP_ID, call.getString("tripId", ""))
            .putString(TrackingContract.KEY_TRIP_CODE, call.getString("tripCode", ""))
            .putString(TrackingContract.KEY_TRIP_STATE, call.getString("tripState", "en_traslado"))
            .putString(TrackingContract.KEY_SUPABASE_URL, call.getString("supabaseUrl", ""))
            .putString(TrackingContract.KEY_ANON_KEY, call.getString("anonKey", ""))
            .putString(TrackingContract.KEY_ACCESS_TOKEN, call.getString("accessToken", ""))
            .putString(TrackingContract.KEY_REFRESH_TOKEN, call.getString("refreshToken", ""))
            .putBoolean(TrackingContract.KEY_ACTIVE, true).apply();
        ContextCompat.startForegroundService(getContext(), new Intent(getContext(), DriverTrackingService.class).setAction(TrackingContract.ACTION_START));
        call.resolve(status());
    }

    @PluginMethod public void stop(PluginCall call) {
        getContext().startService(new Intent(getContext(), DriverTrackingService.class).setAction(TrackingContract.ACTION_STOP));
        call.resolve();
    }


    @PluginMethod public void requestBackgroundLocation(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) { JSObject out=new JSObject(); out.put("granted", true); out.put("state", "not_required"); call.resolve(out); return; }
        if (getPermissionState("location") != PermissionState.GRANTED) { call.reject("foreground_location_required_first"); return; }
        if (getPermissionState("backgroundLocation") == PermissionState.GRANTED) { JSObject out=new JSObject(); out.put("granted", true); out.put("state", "granted"); call.resolve(out); return; }
        requestPermissionForAlias("backgroundLocation", call, "backgroundPermissionCallback");
    }
    @PermissionCallback private void backgroundPermissionCallback(PluginCall call) { JSObject out=new JSObject(); PermissionState state=getPermissionState("backgroundLocation"); out.put("granted", state==PermissionState.GRANTED); out.put("state", state.toString().toLowerCase()); call.resolve(out); }
    @PluginMethod public void clearCredentials(PluginCall call) {
        getContext().startService(new Intent(getContext(), DriverTrackingService.class).setAction(TrackingContract.ACTION_STOP));
        TrackingPointStore.clear(getContext()); SecureTrackingPreferences.clearCredentials(getContext()); call.resolve();
    }

    @PluginMethod public void getStatus(PluginCall call) { call.resolve(status()); }

    @PluginMethod public void getValidatedNetworkStatus(PluginCall call) {
        ConnectivityManager manager = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        Network network = manager == null ? null : manager.getActiveNetwork();
        NetworkCapabilities capabilities = network == null || manager == null ? null : manager.getNetworkCapabilities(network);
        boolean validated = capabilities != null
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        JSObject out = new JSObject();
        out.put("validated", validated);
        out.put("connected", capabilities != null);
        out.put("remoteUrl", BuildConfig.RUUM_REMOTE_URL);
        call.resolve(out);
    }

    @PluginMethod public void updateTripState(PluginCall call) {
        SecureTrackingPreferences.get(getContext()).edit().putString(TrackingContract.KEY_TRIP_STATE, call.getString("tripState", "en_traslado")).apply();
        getContext().startService(new Intent(getContext(), DriverTrackingService.class).setAction(TrackingContract.ACTION_STOP));
        ContextCompat.startForegroundService(getContext(), new Intent(getContext(), DriverTrackingService.class).setAction(TrackingContract.ACTION_START));
        call.resolve(status());
    }

    private JSObject status() {
        android.content.SharedPreferences p = SecureTrackingPreferences.get(getContext());
        JSObject out = new JSObject();
        out.put("remoteUrl", BuildConfig.RUUM_REMOTE_URL);
        out.put("active", p.getBoolean(TrackingContract.KEY_ACTIVE, false));
        out.put("userId", p.getString(TrackingContract.KEY_USER_ID, null));
        out.put("tripId", p.getString(TrackingContract.KEY_TRIP_ID, null));
        out.put("lastLocationAt", p.getLong(TrackingContract.KEY_LAST_LOCATION_AT, 0));
        out.put("lastSentAt", p.getLong(TrackingContract.KEY_LAST_SENT_AT, 0));
        out.put("pendingCount", TrackingPointStore.count(getContext()));
        out.put("lastError", p.getString(TrackingContract.KEY_LAST_ERROR, null));
        return out;
    }
}
