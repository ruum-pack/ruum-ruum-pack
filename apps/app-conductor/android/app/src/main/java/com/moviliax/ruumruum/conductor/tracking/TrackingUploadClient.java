package com.moviliax.ruumruum.conductor.tracking;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class TrackingUploadClient {
    static boolean flush(Context context) {
        SharedPreferences prefs = SecureTrackingPreferences.get(context);
        String baseUrl = prefs.getString(TrackingContract.KEY_SUPABASE_URL, "");
        String anonKey = prefs.getString(TrackingContract.KEY_ANON_KEY, "");
        String token = prefs.getString(TrackingContract.KEY_ACCESS_TOKEN, "");
        String tripId = prefs.getString(TrackingContract.KEY_TRIP_ID, "");
        if (baseUrl.isEmpty() || anonKey.isEmpty() || token.isEmpty() || tripId.isEmpty()) return false;

        List<JSONObject> points = TrackingPointStore.peek(context, 50);
        if (points.isEmpty()) return true;
        HttpURLConnection connection = null;
        try {
            JSONObject body = new JSONObject();
            body.put("p_traslado_id", tripId);
            body.put("p_puntos", new JSONArray(points));
            connection = (HttpURLConnection) new URL(baseUrl + "/rest/v1/rpc/registrar_telemetria_lote").openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("apikey", anonKey);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            try (OutputStream os = connection.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = connection.getResponseCode();
            if (code == 401 && refreshAccessToken(context, baseUrl, anonKey, prefs)) {
                connection.disconnect();
                return flush(context);
            }
            if (code >= 200 && code < 300) {
                String raw = read(connection, false);
                JSONObject result = raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
                Set<String> terminalIds = new HashSet<>();
                collectIds(result.optJSONArray("aceptados"), terminalIds);
                collectIds(result.optJSONArray("duplicadosIds"), terminalIds);
                collectIds(result.optJSONArray("rechazadosPermanentes"), terminalIds);
                if (terminalIds.isEmpty() && result.optInt("recibidos", -1) == points.size() && result.optInt("rechazados", 0) == 0) {
                    for (JSONObject point : points) terminalIds.add(point.optString("localId"));
                }
                TrackingPointStore.removeByLocalIds(context, terminalIds);
                int pending = TrackingPointStore.count(context);
                prefs.edit().putLong(TrackingContract.KEY_LAST_SENT_AT, System.currentTimeMillis())
                    .putInt(TrackingContract.KEY_PENDING, pending)
                    .putString(TrackingContract.KEY_LAST_ERROR,
                        result.optInt("rechazados", 0) > 0 ? "telemetry_partial_rejection:" + result.optInt("rechazados") : null)
                    .apply();
                return !terminalIds.isEmpty() || pending == 0;
            }
            String response = read(connection, true);
            prefs.edit().putString(TrackingContract.KEY_LAST_ERROR, "HTTP " + code + ": " + response).apply();
            NativeErrorReporter.report(context, "tracking_upload_http_" + code, null);
        } catch (Exception error) {
            NativeErrorReporter.report(context, "tracking_upload_failed", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
        return false;
    }

    private static void collectIds(JSONArray array, Set<String> target) {
        if (array == null) return;
        for (int i = 0; i < array.length(); i++) {
            Object value = array.opt(i);
            if (value instanceof String) target.add((String) value);
            else if (value instanceof JSONObject) {
                String id = ((JSONObject) value).optString("localId", "");
                if (!id.isEmpty()) target.add(id);
            }
        }
    }

    private static String read(HttpURLConnection connection, boolean error) throws Exception {
        java.io.InputStream stream = error ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null) return "";
        StringBuilder response = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream))) {
            String line; while ((line = reader.readLine()) != null) response.append(line);
        }
        return response.toString();
    }

    private static boolean refreshAccessToken(Context context, String baseUrl, String anonKey, SharedPreferences prefs) {
        String refreshToken = prefs.getString(TrackingContract.KEY_REFRESH_TOKEN, "");
        if (refreshToken.isEmpty()) return false;
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(baseUrl + "/auth/v1/token?grant_type=refresh_token").openConnection();
            connection.setRequestMethod("POST"); connection.setConnectTimeout(15000); connection.setReadTimeout(20000);
            connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("apikey", anonKey);
            JSONObject body = new JSONObject().put("refresh_token", refreshToken);
            try (OutputStream os = connection.getOutputStream()) { os.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) return false;
            JSONObject session = new JSONObject(read(connection, false));
            String nextAccess = session.optString("access_token", "");
            String nextRefresh = session.optString("refresh_token", refreshToken);
            if (nextAccess.isEmpty()) return false;
            prefs.edit().putString(TrackingContract.KEY_ACCESS_TOKEN, nextAccess).putString(TrackingContract.KEY_REFRESH_TOKEN, nextRefresh).apply();
            return true;
        } catch (Exception error) {
            NativeErrorReporter.report(context, "tracking_token_refresh_failed", error);
            return false;
        } finally { if (connection != null) connection.disconnect(); }
    }
}
