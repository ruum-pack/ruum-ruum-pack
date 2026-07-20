package com.moviliax.ruumruum.conductor;

import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.moviliax.ruumruum.conductor.tracking.BackgroundTrackingPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "RuumStartup";

    @Override public void onCreate(Bundle state) {
        registerPlugin(BackgroundTrackingPlugin.class);
        super.onCreate(state);
        if (hasValidatedInternet()) {
            String remoteUrl = BuildConfig.RUUM_REMOTE_URL;
            if (remoteUrl != null && remoteUrl.startsWith("https://")) {
                getBridge().getWebView().loadUrl(remoteUrl);
            } else {
                Log.e(TAG, "remote_url_invalid");
            }
        } else {
            Log.i(TAG, "validated_network_unavailable_using_local_shell");
        }
    }

    private boolean hasValidatedInternet() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        Network network = manager.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(network);
        return capabilities != null
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }
}
