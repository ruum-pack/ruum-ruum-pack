import { redirect } from "next/navigation";

// Parámetros que Supabase puede adjuntar cuando el `redirect_to` del enlace
// de confirmación no está en la lista blanca del proyecto (o cuando algún
// intermediario -cliente de correo, proxy- reescribe la URL) y el usuario
// termina aterrizando en la raíz en vez de en /auth/callback. Sin este
// reenvío, un `redirect("/onboarding")` incondicional aquí descarta el
// `code`/`token_hash` en silencio: la cuenta queda creada en Supabase pero
// nunca se llega a confirmar (ver incidente de verificación de correo).
const PARAMETROS_CONFIRMACION_CORREO = ["code", "token_hash", "token", "confirmation_token"] as const;

export default async function PaginaInicioConductor({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = (await searchParams) ?? {};

  const traeParametrosDeConfirmacion = PARAMETROS_CONFIRMACION_CORREO.some((clave) => {
    const valor = parametros[clave];
    return typeof valor === "string" ? valor.length > 0 : Array.isArray(valor) && valor.length > 0;
  });

  if (traeParametrosDeConfirmacion) {
    const query = new URLSearchParams();
    for (const [clave, valor] of Object.entries(parametros)) {
      if (typeof valor === "string") {
        query.set(clave, valor);
      } else if (Array.isArray(valor) && valor[0] !== undefined) {
        query.set(clave, valor[0]);
      }
    }
    redirect(`/auth/callback?${query.toString()}`);
  }

  redirect("/onboarding");
}
