package com.moviliax.ruumruum.conductor;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.moviliax.ruumruum.conductor.tracking.BackgroundTrackingPlugin;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundTrackingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
