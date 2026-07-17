import { Capacitor } from "@capacitor/core";

/** true solo dentro del shell nativo (Android/iOS empacado); false en navegador. */
export function esNativo(): boolean {
  return Capacitor.isNativePlatform();
}

export function plataformaActual(): "ios" | "android" | "web" {
  const plataforma = Capacitor.getPlatform();
  if (plataforma === "ios" || plataforma === "android") return plataforma;
  return "web";
}
