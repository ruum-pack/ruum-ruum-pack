package com.moviliax.ruumruum.conductor.tracking;

public final class TrackingContract {
    private TrackingContract() {}
    public static final String ACTION_START = "com.moviliax.ruumruum.conductor.TRACKING_START";
    public static final String ACTION_STOP = "com.moviliax.ruumruum.conductor.TRACKING_STOP";
    public static final String ACTION_FLUSH = "com.moviliax.ruumruum.conductor.TRACKING_FLUSH";
    public static final String CHANNEL_ID = "ruum_tracking";
    public static final int NOTIFICATION_ID = 4301;
    public static final String PREFS = "ruum_tracking_prefs";
    public static final String KEY_ACTIVE = "active";
    public static final String KEY_TRIP_ID = "trip_id";
    public static final String KEY_TRIP_CODE = "trip_code";
    public static final String KEY_TRIP_STATE = "trip_state";
    public static final String KEY_SUPABASE_URL = "supabase_url";
    public static final String KEY_ANON_KEY = "anon_key";
    public static final String KEY_ACCESS_TOKEN = "access_token";
    public static final String KEY_REFRESH_TOKEN = "refresh_token";
    public static final String KEY_LAST_LOCATION_AT = "last_location_at";
    public static final String KEY_LAST_SENT_AT = "last_sent_at";
    public static final String KEY_PENDING = "pending_count";
    public static final String KEY_LAST_ERROR = "last_error";
    public static final String KEY_LAST_ERROR_AT = "last_error_at";
    public static final String KEY_STARTED_AT = "started_at";
    public static final long MAX_BOOT_RECOVERY_AGE_MS = 12L * 60L * 60L * 1000L;
}
