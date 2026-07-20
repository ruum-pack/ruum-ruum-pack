export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";
import { crearClienteNavegador } from "./supabase-browser";
export type VersionPolicy = { current: string; minimum: string; recommended: string; mandatory: boolean; incompatibleFeatures: string[]; message?: string };
export function compareVersions(a: string, b: string) { const pa=a.split(".").map(Number), pb=b.split(".").map(Number); for(let i=0;i<3;i++){const d=(pa[i]||0)-(pb[i]||0); if(d) return d;} return 0; }
export async function fetchVersionPolicy(): Promise<VersionPolicy | null> { const client=crearClienteNavegador(); const {data,error}=await client.rpc("obtener_politica_version_app", { p_plataforma:"android", p_version_actual:APP_VERSION }); if(error) return null; return data as VersionPolicy; }
