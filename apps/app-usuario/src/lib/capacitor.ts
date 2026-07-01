import { Capacitor } from "@capacitor/core";

/** true solo dentro del shell nativo (Android/iOS empacado); false en navegador. */
export function esNativo(): boolean {
  return Capacitor.isNativePlatform();
}
