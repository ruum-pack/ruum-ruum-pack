package com.moviliax.ruumruum.conductor;
import android.net.ConnectivityManager; import android.net.Network; import android.net.NetworkCapabilities; import android.os.Bundle;
import com.getcapacitor.BridgeActivity; import com.moviliax.ruumruum.conductor.tracking.BackgroundTrackingPlugin;
public class MainActivity extends BridgeActivity {
 private static final String REMOTE_URL="https://www.concer.ruumruum-moviliax.online";
 @Override public void onCreate(Bundle b){ registerPlugin(BackgroundTrackingPlugin.class); super.onCreate(b); if(isOnline()) getBridge().getWebView().loadUrl(REMOTE_URL); }
 private boolean isOnline(){ ConnectivityManager cm=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE); Network n=cm.getActiveNetwork(); if(n==null)return false; NetworkCapabilities c=cm.getNetworkCapabilities(n); return c!=null&&(c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)||c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)||c.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)); }
}
