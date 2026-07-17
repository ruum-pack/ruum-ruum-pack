import Link from "next/link";
import { Card } from "@ruum/ui";
import { CuentaHeader } from "../CuentaHeader";

export default function PaginaLegalCuenta() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <CuentaHeader titulo="Legal" descripcion="Documentos legales vigentes de la app conductor." />
      <Card className="mt-6">
        <div className="grid gap-3">
          <Link href="/legal/terminos" className="rounded-lg border border-border px-4 py-3 font-body text-sm font-semibold text-text-secondary hover:border-route-action">
            Términos y condiciones
          </Link>
          <Link href="/legal/privacidad" className="rounded-lg border border-border px-4 py-3 font-body text-sm font-semibold text-text-secondary hover:border-route-action">
            Aviso de privacidad
          </Link>
        </div>
      </Card>
    </div>
  );
}
