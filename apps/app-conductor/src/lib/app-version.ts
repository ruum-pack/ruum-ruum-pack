export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";
import { obtenerPoliticaVersionApp } from "@ruum/api/operations";
import { crearClienteNavegador } from "./supabase-browser";
export type VersionPolicy = { current: string; minimum: string; recommended: string; mandatory: boolean; incompatibleFeatures: string[]; message?: string };
export function compareVersions(a: string, b: string) { const pa=a.split(".").map(Number), pb=b.split(".").map(Number); for(let i=0;i<3;i++){const d=(pa[i]||0)-(pb[i]||0); if(d) return d;} return 0; }
export async function fetchVersionPolicy(): Promise<VersionPolicy | null> {
  const politica = await obtenerPoliticaVersionApp(crearClienteNavegador(), "android", APP_VERSION).catch(() => null);
  if (!politica) return null;
  return {
    current: politica.current,
    minimum: politica.minimum,
    recommended: politica.recommended,
    mandatory: politica.mandatory,
    incompatibleFeatures: politica.incompatibleFeatures,
    ...(politica.message ? { message: politica.message } : {})
  };
}
