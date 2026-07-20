package com.moviliax.ruumruum.conductor.tracking;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

/** Almacén cifrado exclusivo para colas de geolocalización, separado de credenciales. */
final class SecureTrackingQueuePreferences {
    private static final String FILE_NAME = "ruum_tracking_queue_encrypted";
    private SecureTrackingQueuePreferences() {}

    static SharedPreferences get(Context context) {
        try {
            MasterKey key = new MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();
            return EncryptedSharedPreferences.create(
                context,
                FILE_NAME,
                key,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (Exception error) {
            NativeErrorReporter.report(context, "secure_tracking_queue_unavailable", error);
            throw new IllegalStateException("secure_tracking_queue_unavailable", error);
        }
    }
}
