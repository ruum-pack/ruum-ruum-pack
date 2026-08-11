import { redirect } from "next/navigation";
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
