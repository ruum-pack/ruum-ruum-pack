import { Preferences } from "@capacitor/preferences";

/**
 * Bandera de primer arranque para el recorrido de bienvenida.
 * Usa @capacitor/preferences (igual que la cola offline) para que
 * persista tanto en el WebView de Android como en navegador.
 */
const CLAVE_ONBOARDING = "ruum_conductor_onboarding_visto";

export async function onboardingVisto(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: CLAVE_ONBOARDING });
    return value === "1";
  } catch {
    return true; // ante cualquier fallo de storage, no bloquear el login
  }
}

export async function marcarOnboardingVisto(): Promise<void> {
  try {
    await Preferences.set({ key: CLAVE_ONBOARDING, value: "1" });
  } catch {
    // sin storage disponible simplemente no persistimos la bandera
  }
}
