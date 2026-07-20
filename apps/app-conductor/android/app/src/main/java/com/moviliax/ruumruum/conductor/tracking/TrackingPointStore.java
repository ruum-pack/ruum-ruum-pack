package com.moviliax.ruumruum.conductor.tracking;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

final class TrackingPointStore {
    private static final String KEY_PREFIX = "queue_points_";
    private static final int MAX = 1000;

    private static String userId(Context context) {
        return SecureTrackingPreferences.get(context).getString(TrackingContract.KEY_USER_ID, "");
    }
    private static String key(Context context) {
        String userId = userId(context);
        return KEY_PREFIX + (userId.isEmpty() ? "unassigned" : userId);
    }

    static synchronized void append(Context context, JSONObject point) {
        String userId = userId(context);
        if (userId.isEmpty()) { NativeErrorReporter.report(context, "tracking_queue_user_missing", null); return; }
        try { point.put("usuarioId", userId); } catch (Exception ignored) {}
        JSONArray current = readArray(context);
        current.put(point);
        JSONArray bounded = new JSONArray();
        int start = Math.max(0, current.length() - MAX);
        for (int i = start; i < current.length(); i++) bounded.put(current.opt(i));
        SecureTrackingQueuePreferences.get(context).edit().putString(key(context), bounded.toString()).apply();
    }

    static synchronized List<JSONObject> peek(Context context, int limit) {
        String userId = userId(context);
        JSONArray current = readArray(context);
        List<JSONObject> result = new ArrayList<>();
        for (int i = 0; i < current.length() && result.size() < limit; i++) {
            JSONObject item = current.optJSONObject(i);
            if (item != null && userId.equals(item.optString("usuarioId"))) result.add(item);
        }
        return result;
    }

    static synchronized void removeByLocalIds(Context context, java.util.Set<String> ids) {
        if (ids == null || ids.isEmpty()) return;
        JSONArray current = readArray(context);
        JSONArray next = new JSONArray();
        for (int i = 0; i < current.length(); i++) {
            JSONObject item = current.optJSONObject(i);
            if (item == null || !ids.contains(item.optString("localId"))) next.put(current.opt(i));
        }
        SecureTrackingQueuePreferences.get(context).edit().putString(key(context), next.toString()).apply();
    }

    static synchronized int count(Context context) { return readArray(context).length(); }
    private static JSONArray readArray(Context context) {
        String queueKey = key(context);
        SharedPreferences queuePrefs = SecureTrackingQueuePreferences.get(context);
        String raw = queuePrefs.getString(queueKey, null);
        if (raw == null) {
            // Migración de una sola vez desde el almacén cifrado anterior.
            SharedPreferences legacy = SecureTrackingPreferences.get(context);
            raw = legacy.getString(queueKey, "[]");
            if (!"[]".equals(raw)) {
                queuePrefs.edit().putString(queueKey, raw).commit();
                legacy.edit().remove(queueKey).apply();
            }
        }
        try { return new JSONArray(raw == null ? "[]" : raw); } catch (Exception error) { NativeErrorReporter.report(context, "tracking_queue_corrupt", error); return new JSONArray(); }
    }
    public static synchronized void clear(Context context) { SecureTrackingQueuePreferences.get(context).edit().remove(key(context)).apply(); }
}
