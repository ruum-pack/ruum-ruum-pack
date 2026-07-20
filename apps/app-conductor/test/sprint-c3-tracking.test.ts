import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

describe("Sprint C3 tracking Android", () => {
  it("declara permisos y foreground service de ubicación", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    expect(manifest).toContain("FOREGROUND_SERVICE_LOCATION");
    expect(manifest).toContain("POST_NOTIFICATIONS");
    expect(manifest).toContain("ACCESS_BACKGROUND_LOCATION");
    expect(manifest).toContain('android:foregroundServiceType="location"');
  });

  it("mantiene notificación persistente sin acción accidental de detener", () => {
    const service = read("android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/DriverTrackingService.java");
    expect(service).toContain("setOngoing(true)");
    expect(service).toContain("Ruum Ruum está compartiendo tu ubicación");
    expect(service).not.toContain("ACTION_STOP_TRACKING_NOTIFICATION");
  });

  it("usa muestreo combinado por tiempo y distancia", () => {
    const service = read("android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/DriverTrackingService.java");
    expect(service).toContain("setMinUpdateDistanceMeters");
    expect(service).toContain("sampling.intervalMs");
    expect(service).toContain("location.distanceTo(lastStoredLocation)");
  });

  it("envía lotes idempotentes al RPC", () => {
    const upload = read("android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/TrackingUploadClient.java");
    expect(upload).toContain("registrar_telemetria_lote");
    expect(upload).toContain("TrackingPointStore.peek(context, 50)");
  });
});
