package com.moviliax.ruumruum.conductor.tracking;

import android.app.*;
import android.content.*;
import android.location.Location;
import android.os.*;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.*;
import com.moviliax.ruumruum.conductor.MainActivity;
import com.moviliax.ruumruum.conductor.R;
import org.json.JSONObject;
import java.util.UUID;
import java.util.concurrent.Executors;

public class DriverTrackingService extends Service {
    private FusedLocationProviderClient locationClient;
    private LocationCallback callback;
    private final java.util.concurrent.ExecutorService uploader = Executors.newSingleThreadExecutor();
    private long lastStoredAt = 0;
    private Location lastStoredLocation;

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        locationClient = LocationServices.getFusedLocationProviderClient(this);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? TrackingContract.ACTION_START : intent.getAction();
        if (TrackingContract.ACTION_STOP.equals(action)) { stopTracking(); return START_NOT_STICKY; }
        if (TrackingContract.ACTION_FLUSH.equals(action)) { uploader.execute(() -> TrackingUploadClient.flush(this)); return START_STICKY; }
        startForeground(TrackingContract.NOTIFICATION_ID, buildNotification());
        startLocationUpdates();
        SecureTrackingPreferences.get(this).edit().putBoolean(TrackingContract.KEY_ACTIVE, true)
            .putLong(TrackingContract.KEY_STARTED_AT, SecureTrackingPreferences.get(this).getLong(TrackingContract.KEY_STARTED_AT, System.currentTimeMillis())).apply();
        return START_STICKY;
    }

    @SuppressWarnings("MissingPermission")
    private void startLocationUpdates() {
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            SecureTrackingPreferences.get(this).edit().putString(TrackingContract.KEY_LAST_ERROR, "location_permission_missing").apply();
            stopSelf(); return;
        }
        if (callback != null) return;
        SharedPreferences prefs = SecureTrackingPreferences.get(this);
        Sampling sampling = Sampling.forState(prefs.getString(TrackingContract.KEY_TRIP_STATE, "en_traslado"));
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, sampling.intervalMs)
            .setMinUpdateIntervalMillis(Math.max(5000, sampling.intervalMs / 2))
            .setMinUpdateDistanceMeters(sampling.distanceM)
            .setMaxUpdateDelayMillis(sampling.intervalMs * 2)
            .build();
        callback = new LocationCallback() {
            @Override public void onLocationResult(LocationResult result) {
                for (Location location : result.getLocations()) persist(location, sampling);
            }
        };
        locationClient.requestLocationUpdates(request, callback, Looper.getMainLooper());
    }

    private void persist(Location location, Sampling sampling) {
        long now = System.currentTimeMillis();
        if (lastStoredLocation != null && now - lastStoredAt < sampling.intervalMs && location.distanceTo(lastStoredLocation) < sampling.distanceM) return;
        try {
            SharedPreferences prefs = SecureTrackingPreferences.get(this);
            JSONObject point = new JSONObject();
            point.put("usuarioId", prefs.getString(TrackingContract.KEY_USER_ID, ""));
            point.put("localId", UUID.randomUUID().toString());
            point.put("lat", location.getLatitude());
            point.put("lng", location.getLongitude());
            point.put("precisionM", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
            point.put("velocidadMps", location.hasSpeed() ? location.getSpeed() : JSONObject.NULL);
            point.put("direccionGrados", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
            point.put("altitudM", location.hasAltitude() ? location.getAltitude() : JSONObject.NULL);
            java.text.SimpleDateFormat iso = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
            iso.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            point.put("deviceTimestamp", iso.format(new java.util.Date(location.getTime())));
            point.put("estadoViaje", prefs.getString(TrackingContract.KEY_TRIP_STATE, "desconocido"));
            point.put("fuente", "android_foreground_service");
            point.put("online", isOnline());
            point.put("bateriaPct", batteryPct());
            TrackingPointStore.append(this, point);
            prefs.edit().putLong(TrackingContract.KEY_LAST_LOCATION_AT, now).putInt(TrackingContract.KEY_PENDING, TrackingPointStore.count(this)).apply();
            lastStoredAt = now; lastStoredLocation = location;
            uploader.execute(() -> TrackingUploadClient.flush(this));
        } catch (Exception error) { NativeErrorReporter.report(this, "tracking_point_persist_failed", error); }
    }

    private boolean isOnline() {
        android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        android.net.Network network = cm.getActiveNetwork();
        android.net.NetworkCapabilities caps = network == null ? null : cm.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private int batteryPct() {
        Intent status = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (status == null) return -1;
        int level = status.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), scale = status.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        return level < 0 || scale <= 0 ? -1 : Math.round(level * 100f / scale);
    }

    private Notification buildNotification() {
        SharedPreferences prefs = SecureTrackingPreferences.get(this);
        String code = prefs.getString(TrackingContract.KEY_TRIP_CODE, "");
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, TrackingContract.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_tracking)
            .setContentTitle("Ruum Ruum está compartiendo tu ubicación")
            .setContentText(code.isEmpty() ? "Traslado en curso · Toca para volver" : "Traslado " + code + " en curso · Toca para volver")
            .setContentIntent(pending).setOngoing(true).setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE).setPriority(NotificationCompat.PRIORITY_LOW).build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(TrackingContract.CHANNEL_ID, "Seguimiento de traslados", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Notificación obligatoria mientras Ruum Ruum comparte ubicación durante un traslado activo.");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private void stopTracking() {
        if (callback != null) locationClient.removeLocationUpdates(callback);
        callback = null;
        uploader.execute(() -> TrackingUploadClient.flush(this));
        SecureTrackingPreferences.get(this).edit().putBoolean(TrackingContract.KEY_ACTIVE, false).remove(TrackingContract.KEY_STARTED_AT).apply();
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }

    @Override public void onDestroy() { if (callback != null) locationClient.removeLocationUpdates(callback); uploader.shutdown(); super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }

    static final class Sampling {
        final long intervalMs; final float distanceM;
        Sampling(long intervalMs, float distanceM) { this.intervalMs = intervalMs; this.distanceM = distanceM; }
        static Sampling forState(String state) {
            if ("incidencia".equals(state) || "emergencia".equals(state)) return new Sampling(7000, 5);
            if ("camino_origen".equals(state) || "conductor_asignado".equals(state)) return new Sampling(20000, 20);
            if ("vehiculo_detenido".equals(state) || "sin_movimiento".equals(state)) return new Sampling(60000, 40);
            return new Sampling(15000, 15);
        }
    }
}
