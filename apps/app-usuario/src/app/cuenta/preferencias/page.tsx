import { AvisoSinSesion, LayoutCuenta, SeccionPreferencias, obtenerCuenta } from "../cuenta-ui";
import { BotonTema } from "../../TemaProvider";
import { PassportCard } from "@ruum/ui";

export default async function PaginaPreferenciasCuenta() {
  const cuenta = await obtenerCuenta();

  if (!cuenta) return <AvisoSinSesion />;

  return (
    <LayoutCuenta cuenta={cuenta}>
      <PassportCard>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-text-primary">Apariencia</h2>
            <p className="font-body text-xs text-text-secondary">Elige tema claro u oscuro. Respetamos tu sistema por defecto y lo recordamos.</p>
          </div>
          <BotonTema />
        </div>
      </PassportCard>
      <div className="mt-4">
        <SeccionPreferencias usuario={cuenta.usuario} />
      </div>
    </LayoutCuenta>
  );
}
