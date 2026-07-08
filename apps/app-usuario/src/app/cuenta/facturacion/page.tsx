import { AvisoSinSesion, LayoutCuenta, SeccionFacturacion, obtenerCuenta } from "../cuenta-ui";

export default async function PaginaFacturacionCuenta() {
  const cuenta = await obtenerCuenta();

  if (!cuenta) return <AvisoSinSesion />;

  return (
    <LayoutCuenta cuenta={cuenta}>
      <SeccionFacturacion empresa={cuenta.empresa} usuario={cuenta.usuario} />
    </LayoutCuenta>
  );
}
