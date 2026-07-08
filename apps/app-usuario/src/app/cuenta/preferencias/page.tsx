import { AvisoSinSesion, LayoutCuenta, SeccionPreferencias, obtenerCuenta } from "../cuenta-ui";

export default async function PaginaPreferenciasCuenta() {
  const cuenta = await obtenerCuenta();

  if (!cuenta) return <AvisoSinSesion />;

  return (
    <LayoutCuenta cuenta={cuenta}>
      <SeccionPreferencias usuario={cuenta.usuario} />
    </LayoutCuenta>
  );
}
