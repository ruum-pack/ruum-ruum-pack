package com.moviliax.ruumruum.conductor.tracking;
import android.content.Context;
import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
public final class SecureTrackingPreferences {
 private SecureTrackingPreferences() {}
 public static SharedPreferences get(Context context) {
  try { MasterKey key=new MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build();
   return EncryptedSharedPreferences.create(context, TrackingContract.PREFS, key, EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV, EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
  } catch(Exception e) { throw new IllegalStateException("secure_tracking_storage_unavailable", e); }
 }
 public static void clearCredentials(Context c){ get(c).edit().remove(TrackingContract.KEY_ACCESS_TOKEN).remove(TrackingContract.KEY_REFRESH_TOKEN).remove(TrackingContract.KEY_ANON_KEY).remove(TrackingContract.KEY_SUPABASE_URL).remove(TrackingContract.KEY_TRIP_ID).remove(TrackingContract.KEY_TRIP_CODE).putBoolean(TrackingContract.KEY_ACTIVE,false).apply(); }
}
