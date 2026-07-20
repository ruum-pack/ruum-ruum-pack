package com.moviliax.ruumruum.conductor.tracking;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

final class TrackingPointStore {
    private static final String PREFS = "ruum_tracking_queue";
    private static final String KEY = "points";
    private static final int MAX = 1000;

    static synchronized void append(Context context, JSONObject point) {
        JSONArray current = readArray(context);
        current.put(point);
        JSONArray bounded = new JSONArray();
        int start = Math.max(0, current.length() - MAX);
        for (int i = start; i < current.length(); i++) bounded.put(current.opt(i));
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, bounded.toString()).apply();
    }

    static synchronized List<JSONObject> peek(Context context, int limit) {
        JSONArray current = readArray(context);
        List<JSONObject> result = new ArrayList<>();
        for (int i = 0; i < Math.min(limit, current.length()); i++) {
            JSONObject item = current.optJSONObject(i);
            if (item != null) result.add(item);
        }
        return result;
    }

    static synchronized void removeFirst(Context context, int count) {
        JSONArray current = readArray(context);
        JSONArray next = new JSONArray();
        for (int i = Math.min(count, current.length()); i < current.length(); i++) next.put(current.opt(i));
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, next.toString()).apply();
    }

    static synchronized int count(Context context) { return readArray(context).length(); }

    private static JSONArray readArray(Context context) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]");
        try { return new JSONArray(raw); } catch (Exception ignored) { return new JSONArray(); }
    }
}
