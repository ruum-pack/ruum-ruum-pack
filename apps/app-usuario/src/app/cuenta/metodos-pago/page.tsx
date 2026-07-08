import { AvisoSinSesion, LayoutCuenta, SeccionMetodosPago, obtenerCuenta } from "../cuenta-ui";

export default async function PaginaMetodosPagoCuenta() {
  const cuenta = await obtenerCuenta();

  if (!cuenta) return <AvisoSinSesion />;

  return (
    <LayoutCuenta cuenta={cuenta}>
      <SeccionMetodosPago usuario={cuenta.usuario} />
    </LayoutCuenta>
  );
}
