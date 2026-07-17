import Link from "next/link";
import { Button, Card } from "@ruum/ui";
import { CONTACTOS_SOPORTE_CONDUCTOR } from "../../../lib/contactos-soporte";
import { CuentaHeader } from "../CuentaHeader";

const SOPORTE = [
  CONTACTOS_SOPORTE_CONDUCTOR.soporte.whatsapp,
  CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono,
  CONTACTOS_SOPORTE_CONDUCTOR.soporte.correo,
  CONTACTOS_SOPORTE_CONDUCTOR.soporte.bajaCuenta
];

export default function PaginaSoporteCuenta() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <CuentaHeader titulo="Soporte" descripcion="Canales oficiales para ayuda operativa y cuenta." />
      <Card className="mt-6">
        <div className="grid gap-3">
          {SOPORTE.map((opcion) => (
            <a key={opcion.etiqueta} href={opcion.href} className="rounded-lg border border-border px-4 py-3 font-body text-sm font-semibold text-text-secondary hover:border-route-action">
              {opcion.etiqueta}
            </a>
          ))}
          <Link href="/viajes"><Button variant="secondary">Reportar problema en un viaje</Button></Link>
        </div>
      </Card>
    </div>
  );
}
